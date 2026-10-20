import { creerServicePaiement, masquerNumero } from "../../src/lib/paiement/en-ligne/service";
import { creerPasserelleSimulation, type PasserelleSimulation } from "../../src/lib/paiement/en-ligne/simulation";
import { ErreurPasserelle } from "../../src/lib/paiement/en-ligne/fournisseur";
import { estEquilibre, soldes } from "../../src/lib/paiement/en-ligne/ecritures";
import { creerDepotMemoire, reglagesParDefaut } from "./depot-memoire";
import type { CommandePourPaiement } from "../../src/lib/paiement/en-ligne/service";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const commande = (id: string, surcharge: Partial<CommandePourPaiement> = {}): CommandePourPaiement => ({
  id,
  restaurantId: "resto-1",
  statut: "acceptee",
  mode: "livraison",
  sousTotalGnf: 25_000,
  fraisLivraisonGnf: 5_000,
  livraisonMode: "speedfood",
  livreurId: "liv-1",
  ...surcharge,
});

/** Banc d'essai : un service, un dépôt en mémoire, une passerelle de simulation dont on peut compter les appels et provoquer des pannes. */
function banc(options: { commandes?: CommandePourPaiement[]; reglages?: ReturnType<typeof reglagesParDefaut> } = {}) {
  const { depot, etat } = creerDepotMemoire({ commandes: options.commandes ?? [commande("cmd-1")], reglages: options.reglages });
  const base = creerPasserelleSimulation({ cle: "cle-test" });
  const appels = { verser: 0, rembourser: 0, encaisser: 0 };
  const pannes = { verser: false, rembourser: false, encaisser: false };
  const passerelle: PasserelleSimulation = {
    ...base,
    async encaisser(d) {
      appels.encaisser++;
      if (pannes.encaisser) throw new ErreurPasserelle("reseau", "panne");
      return base.encaisser(d);
    },
    async verser(d) {
      appels.verser++;
      if (pannes.verser) throw new ErreurPasserelle("reseau", "panne");
      return base.verser(d);
    },
    async rembourser(d) {
      appels.rembourser++;
      if (pannes.rembourser) throw new ErreurPasserelle("reseau", "panne");
      return base.rembourser(d);
    },
  };
  let n = 0;
  const service = creerServicePaiement({ depot, passerelle, genererReference: (p) => `${p}-TEST${String(++n).padStart(4, "0")}` });
  let evt = 0;
  const payer = (referenceExterne: string, montantGnf: number | null, etatOp: "succes" | "echec" | "annule" | "expire" | "en_attente" = "succes", identifiant?: string) => {
    const f = passerelle.fabriquerNotification({ identifiant: identifiant ?? `evt-${++evt}`, referenceExterne, referenceInterne: null, etat: etatOp, montantGnf });
    return service.appliquerNotification(f.corps, f.entetes);
  };
  const ajouterComptes = (verifie = true) => {
    etat.comptes.set("restaurant|resto-1", { id: "cv-r", operateur: "orange_money", numero: "+224620000001", verifie });
    etat.comptes.set("livreur|liv-1", { id: "cv-l", operateur: "mtn_momo", numero: "+224660000001", verifie });
  };
  return { depot, etat, service, passerelle, appels, pannes, payer, ajouterComptes };
}

async function ouvrirEtPayer(b: ReturnType<typeof banc>, orderId = "cmd-1", operateur: "orange_money" | "mtn_momo" = "orange_money") {
  const o = await b.service.ouvrirPaiement({ orderId, operateur });
  if (!o.ok) throw new Error("ouverture refusée : " + o.raison);
  const p = (await b.depot.paiementParId(o.paiementId))!;
  const r = await b.payer(p.referenceExterne!, p.totalGnf);
  return { o, p, r };
}

// ------------------------------------------------------------------ ouverture
{
  const b = banc({ reglages: reglagesParDefaut({ actif: false }) });
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  verifier("interrupteur éteint : l'ouverture est refusée, rien n'est créé", [o.ok, b.etat.paiements.size, b.appels.encaisser], [false, 0, 0]);
  verifier("interrupteur éteint : la raison est « desactive »", o.ok ? "ok" : o.raison, "desactive");
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = o.ok ? await b.depot.paiementParId(o.paiementId) : null;
  verifier("ouverture : paiement en attente, référence du prestataire posée", [o.ok, p?.etat, p?.referenceExterne?.startsWith("SIM-")], [true, "en_attente", true]);
  verifier("ouverture : répartition = 35 000 → restaurant 24 000, livreur 5 000, Speedfood 1 000", [p?.totalGnf, p?.restaurantGnf, p?.livreurGnf, p?.speedfoodBrutGnf], [30_000, 24_000, 5_000, 1_000]);
  verifier("ouverture : frais mobile arrondis au GNF supérieur (30 000 × 1,5 % = 450)", p?.fraisMobileGnf, 450);
  verifier("ouverture : aucune écriture avant la confirmation du prestataire", b.etat.ecritures.length, 0);
  const encore = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "mtn_momo" });
  verifier("ouverture rejouée : renvoie le même paiement, sans second appel au prestataire", [encore.ok && encore.deja, b.etat.paiements.size, b.appels.encaisser], [true, 1, 1]);
}
{
  const b = banc({ commandes: [commande("cmd-1", { mode: "retrait", livraisonMode: "speedfood", fraisLivraisonGnf: 5_000 })] });
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = o.ok ? await b.depot.paiementParId(o.paiementId) : null;
  verifier("retrait : pas de frais de livraison ni de livreur, tout vient de la commande", [p?.livraisonPar, p?.fraisLivraisonGnf, p?.livreurGnf, p?.totalGnf], ["aucune", 0, 0, 25_000]);
}
{
  const b = banc({ commandes: [commande("cmd-1", { livraisonMode: "propre" })] });
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "mtn_momo" });
  const p = o.ok ? await b.depot.paiementParId(o.paiementId) : null;
  verifier("livraison par le restaurant : il touche les frais de livraison, pas de livreur indépendant", [p?.livraisonPar, p?.restaurantGnf, p?.livreurGnf], ["restaurant", 29_000, 0]);
}
{
  const b = banc({ reglages: reglagesParDefaut({ plafondPaiementGnf: 20_000 }) });
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  verifier("plafond dépassé : refusé, rien n'est créé", [o.ok, o.ok ? null : o.raison, b.etat.paiements.size], [false, "plafond_depasse", 0]);
}
{
  const b = banc({ commandes: [commande("cmd-1", { statut: "terminee" })] });
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  verifier("commande déjà terminée : non payable en ligne", [o.ok, o.ok ? null : o.raison], [false, "commande_non_payable"]);
  const inconnue = await b.service.ouvrirPaiement({ orderId: "nulle-part", operateur: "orange_money" });
  verifier("commande inconnue : refusée", [inconnue.ok, inconnue.ok ? null : inconnue.raison], [false, "commande_introuvable"]);
}
{
  const b = banc();
  b.pannes.encaisser = true;
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = [...b.etat.paiements.values()][0];
  verifier("prestataire en panne à l'ouverture : paiement annulé, aucune écriture, le client choisira un autre mode", [o.ok, o.ok ? null : o.raison, p?.etat, b.etat.ecritures.length], [false, "passerelle_indisponible", "annule", 0]);
}

// ------------------------------------------------------------------ notification
{
  const b = banc();
  const { p, r } = await ouvrirEtPayer(b);
  verifier("succès signé : le paiement passe à « confirmé »", [r.statut, (await b.depot.paiementParId(p.id))?.etat], ["applique", "confirme"]);
  const s = soldes(b.etat.ecritures);
  verifier("livre après encaissement : 30 000 chez le prestataire moins 450 de frais, 30 000 à libérer", [s.fonds_operateur, s.fonds_a_liberer, s.charge_frais_mobile], [29_550, -30_000, 450]);
  verifier("livre : équilibré", estEquilibre(b.etat.ecritures), true);
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = (await b.depot.paiementParId(o.ok ? o.paiementId : ""))!;
  const f = b.passerelle.fabriquerNotification({ identifiant: "e-1", referenceExterne: p.referenceExterne!, referenceInterne: null, etat: "succes", montantGnf: p.totalGnf });
  const r1 = await b.service.appliquerNotification(f.corps, f.entetes);
  const r2 = await b.service.appliquerNotification(f.corps, f.entetes);
  const lignes = b.etat.ecritures.length;
  verifier("même notification reçue deux fois : la seconde est ignorée (doublon)", [r1.statut, r2.statut], ["applique", "doublon"]);
  verifier("rejeu : le livre n'a reçu qu'une fois les écritures", lignes, 4);
  const autre = b.passerelle.fabriquerNotification({ identifiant: "e-2", referenceExterne: p.referenceExterne!, referenceInterne: null, etat: "succes", montantGnf: p.totalGnf });
  const r3 = await b.service.appliquerNotification(autre.corps, autre.entetes);
  verifier("succès renvoyé sous un autre identifiant : sans effet, aucune écriture de plus", [r3.statut, b.etat.ecritures.length], ["applique", lignes]);
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = (await b.depot.paiementParId(o.ok ? o.paiementId : ""))!;
  const f = b.passerelle.fabriquerNotification({ identifiant: "e-1", referenceExterne: p.referenceExterne!, referenceInterne: null, etat: "succes", montantGnf: p.totalGnf });
  const mauvaise = await b.service.appliquerNotification(f.corps, { "x-simulation-signature": "00".repeat(32) });
  const absente = await b.service.appliquerNotification(f.corps, {});
  const falsifie = await b.service.appliquerNotification(f.corps.replace(String(p.totalGnf), "1"), f.entetes);
  verifier("signature fausse, absente ou corps modifié : refusé", [mauvaise.statut, absente.statut, falsifie.statut], ["refuse", "refuse", "refuse"]);
  verifier("notification refusée : le paiement n'a pas bougé et rien n'est enregistré", [(await b.depot.paiementParId(p.id))?.etat, b.etat.evenements.size, b.etat.ecritures.length], ["en_attente", 0, 0]);
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const p = (await b.depot.paiementParId(o.ok ? o.paiementId : ""))!;
  const r = await b.payer(p.referenceExterne!, p.totalGnf - 1000);
  verifier("succès pour un AUTRE montant : jamais confirmé automatiquement", [r.statut, (await b.depot.paiementParId(p.id))?.etat, b.etat.ecritures.length], ["ignore", "en_attente", 0]);
  const inconnu = await b.payer("SIM-INCONNU", 100);
  verifier("notification pour une référence inconnue : classée « inconnu »", inconnu.statut, "inconnu");
  const attente = await b.payer(p.referenceExterne!, null, "en_attente");
  verifier("notification « en attente » : sans effet", [attente.statut, (await b.depot.paiementParId(p.id))?.etat], ["ignore", "en_attente"]);
  const echec = await b.payer(p.referenceExterne!, null, "echec");
  verifier("échec signalé par le prestataire : paiement « échoué », aucune écriture", [echec.statut, (await b.depot.paiementParId(p.id))?.etat, b.etat.ecritures.length], ["applique", "echoue", 0]);
}

// ------------------------------------------------------------------ libération et versements
{
  const b = banc();
  const { p } = await ouvrirEtPayer(b);
  const l = await b.service.libererPaiement(p.id);
  verifier("libération sans comptes de versement : paiement libéré, versements « à verser » (visibles pour l'exploitation)", [l.ok, (await b.depot.paiementParId(p.id))?.etat, [...b.etat.versements.values()].map((v) => v.etat)], [true, "libere", ["a_verser", "a_verser"]]);
  verifier("sans compte : le prestataire n'est jamais appelé pour verser", b.appels.verser, 0);
  b.ajouterComptes(false);
  await b.service.reprendreVersements(p.id);
  verifier("compte non vérifié : toujours pas de versement", [b.appels.verser, [...b.etat.versements.values()].map((v) => v.etat)], [0, ["a_verser", "a_verser"]]);
  b.ajouterComptes(true);
  await b.service.reprendreVersements(p.id);
  verifier("comptes vérifiés : les deux versements partent", [b.appels.verser, [...b.etat.versements.values()].map((v) => v.etat)], [2, ["confirme", "confirme"]]);
  await b.service.reprendreVersements(p.id);
  await b.service.libererPaiement(p.id);
  verifier("reprise et libération rejouées : aucun second versement", b.appels.verser, 2);
  const s = soldes(b.etat.ecritures);
  verifier("cycle complet : plus rien à verser, Speedfood garde 1 000 − 450 = 550 net", [s.a_verser_restaurant, s.a_verser_livreur, s.fonds_a_liberer, s.produit_speedfood, s.charge_frais_mobile, s.fonds_operateur], [0, 0, 0, -1_000, 450, 550]);
  verifier("cycle complet : le livre est équilibré", estEquilibre(b.etat.ecritures), true);
}
{
  const b = banc();
  b.ajouterComptes();
  const { p } = await ouvrirEtPayer(b);
  const [a, c] = await Promise.all([b.service.libererPaiement(p.id), b.service.libererPaiement(p.id)]);
  verifier("deux libérations simultanées : une seule fait le travail", [b.appels.verser, b.etat.versements.size, [a.ok, c.ok].filter(Boolean).length >= 1], [2, 2, true]);
  const liberations = b.etat.ecritures.filter((e) => e.cle === "liberation").length;
  verifier("deux libérations simultanées : le livre n'a qu'un jeu d'écritures de libération (4 lignes)", liberations, 4);
}
{
  const b = banc({ commandes: [commande("cmd-1", { livreurId: null })] });
  b.ajouterComptes();
  const { p } = await ouvrirEtPayer(b);
  const l = await b.service.libererPaiement(p.id);
  verifier("livreur à payer mais inconnu : AUCUNE libération, le paiement reste confirmé", [l.ok, l.ok ? null : l.raison, (await b.depot.paiementParId(p.id))?.etat, b.etat.versements.size], [false, "livreur_inconnu", "confirme", 0]);
}
{
  const b = banc();
  b.ajouterComptes();
  b.pannes.verser = true;
  const { p } = await ouvrirEtPayer(b);
  await b.service.libererPaiement(p.id);
  verifier("prestataire en panne au versement : versements « échoués », paiement libéré, aucune écriture de versement", [[...b.etat.versements.values()].map((v) => v.etat), b.etat.ecritures.some((e) => e.cle.startsWith("versement:"))], [["echoue", "echoue"], false]);
  b.pannes.verser = false;
  await b.service.reprendreVersements(p.id);
  verifier("reprise après la panne : les versements aboutissent, avec leur référence stable", [[...b.etat.versements.values()].map((v) => v.etat), [...b.etat.versements.values()].map((v) => v.referenceInterne)], [["confirme", "confirme"], ["SF-PAY-TEST0001-R", "SF-PAY-TEST0001-L"]]);
}
verifier("numéro masqué : seuls les deux derniers chiffres", [masquerNumero("+224620000045"), masquerNumero("12")], ["•••• •• 45", "••••"]);

// ------------------------------------------------------------------ commande refusée, annulée, terminée
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const r = await b.service.surCommandeAnnulee("cmd-1");
  verifier("commande annulée avant paiement : paiement annulé", [r?.ok, (await b.depot.paiementParId(o.ok ? o.paiementId : ""))?.etat], [true, "annule"]);
  const p = (await b.depot.paiementParId(o.ok ? o.paiementId : ""))!;
  const tard = await b.payer(p.referenceExterne!, p.totalGnf);
  verifier("l'argent arrive APRÈS l'annulation : il est remboursé automatiquement", [tard.statut, (await b.depot.paiementParId(p.id))?.etat, b.appels.rembourser], ["applique", "rembourse", 1]);
  const s = soldes(b.etat.ecritures);
  verifier("succès tardif : le client est rendu en entier, Speedfood n'a perdu que les frais du prestataire", [s.fonds_operateur, s.fonds_a_liberer, s.charge_frais_mobile], [-450, 0, 450]);
}
{
  const b = banc();
  const { p } = await ouvrirEtPayer(b);
  const r = await b.service.surCommandeAnnulee("cmd-1");
  verifier("commande refusée après paiement : remboursement total", [r?.ok, (await b.depot.paiementParId(p.id))?.etat, (await b.depot.paiementParId(p.id))?.rembourseGnf], [true, "rembourse", 30_000]);
  const encore = await b.service.surCommandeAnnulee("cmd-1");
  verifier("remboursement demandé deux fois : un seul appel au prestataire", [encore?.ok, b.appels.rembourser], [true, 1]);
  verifier("aucun versement après un remboursement", [(await b.service.libererPaiement(p.id)).ok, b.appels.verser], [false, 0]);
}
{
  const b = banc();
  const { p } = await ouvrirEtPayer(b);
  b.pannes.rembourser = true;
  const r = await b.service.surCommandeAnnulee("cmd-1");
  verifier("remboursement impossible (prestataire en panne) : le paiement reste confirmé, rien n'est écrit", [r?.ok, (await b.depot.paiementParId(p.id))?.etat, b.etat.ecritures.some((e) => e.cle === "remboursement")], [false, "confirme", false]);
}
{
  const b = banc();
  b.ajouterComptes();
  const { p } = await ouvrirEtPayer(b);
  const r = await b.service.surCommandeTerminee("cmd-1");
  verifier("commande terminée : libération et versements", [r?.ok, (await b.depot.paiementParId(p.id))?.etat, b.appels.verser], [true, "libere", 2]);
  const aucun = banc();
  verifier("commande sans paiement en ligne : aucun effet", [await aucun.service.surCommandeTerminee("cmd-1"), await aucun.service.surCommandeAnnulee("cmd-1")], [null, null]);
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const id = o.ok ? o.paiementId : "";
  verifier("paiement resté en attente : expiré", [await b.service.expirerSiBesoin(id), (await b.depot.paiementParId(id))?.etat], [true, "expire"]);
  verifier("expiration rejouée : sans effet", await b.service.expirerSiBesoin(id), false);
}

// ------------------------------------------------------------------ litiges
{
  const b = banc();
  const { p } = await ouvrirEtPayer(b);
  const r = await b.service.ouvrirLitige({ paiementId: p.id, ouvertPar: "restaurant", situation: "restaurant_refuse_ou_annule" });
  verifier("litige « le restaurant refuse » : remboursement total automatique, litige clos", [r.ok && r.decision.decision, (await b.depot.paiementParId(p.id))?.etat, [...b.etat.litiges.values()][0]?.etat], ["rembourser_total", "rembourse", "clos"]);
}
{
  const b = banc();
  b.ajouterComptes();
  const { p } = await ouvrirEtPayer(b);
  const r = await b.service.ouvrirLitige({ paiementId: p.id, ouvertPar: "livreur", situation: "client_injoignable" });
  verifier("litige « client injoignable » : pas de remboursement, tout le monde est payé", [r.ok && r.decision.decision, (await b.depot.paiementParId(p.id))?.etat, b.appels.verser, [...b.etat.litiges.values()][0]?.etat], ["aucun_remboursement", "libere", 2, "clos"]);
}
{
  const b = banc();
  const { p } = await ouvrirEtPayer(b);
  const r = await b.service.ouvrirLitige({ paiementId: p.id, ouvertPar: "client", situation: "plat_manquant_ou_errone", montantDemandeGnf: 20_000, preuveFournie: true });
  verifier("plat manquant au-dessus du plafond automatique : un humain décide, l'argent est gelé", [r.ok && r.decision.decision, (await b.depot.paiementParId(p.id))?.etat, [...b.etat.litiges.values()][0]?.etat], ["humain", "en_litige", "a_humain"]);
  verifier("paiement en litige : ni libération par la commande, ni remboursement, ni versement", [(await b.service.surCommandeTerminee("cmd-1"))?.ok, (await b.service.libererPaiement(p.id)).ok, b.appels.verser, b.appels.rembourser], [false, false, 0, 0]);
}
{
  const b = banc();
  b.ajouterComptes();
  const { p } = await ouvrirEtPayer(b);
  await b.service.libererPaiement(p.id);
  const r = await b.service.ouvrirLitige({ paiementId: p.id, ouvertPar: "client", situation: "contestation_apres_liberation" });
  verifier("contestation APRÈS libération : toujours un humain, l'argent déjà versé n'est pas repris automatiquement", [r.ok && r.decision.decision, (await b.depot.paiementParId(p.id))?.etat, b.appels.rembourser], ["humain", "en_litige", 0]);
  const rb = await b.service.rembourserTotal(p.id);
  verifier("remboursement automatique refusé quand l'argent est déjà parti", [rb.ok, b.appels.rembourser], [false, 0]);
}
{
  const b = banc();
  const o = await b.service.ouvrirPaiement({ orderId: "cmd-1", operateur: "orange_money" });
  const r = await b.service.ouvrirLitige({ paiementId: o.ok ? o.paiementId : "", ouvertPar: "client", situation: "restaurant_refuse_ou_annule" });
  verifier("litige sur un paiement non confirmé : refusé", [r.ok, r.ok ? null : r.raison], [false, "etat_incompatible"]);
}

// ------------------------------------------------------------------ invariant global
{
  const b = banc({ commandes: [commande("c1"), commande("c2", { mode: "retrait" }), commande("c3", { livraisonMode: "propre" })] });
  b.ajouterComptes();
  for (const id of ["c1", "c2", "c3"]) {
    const { p } = await ouvrirEtPayer(b, id, id === "c2" ? "mtn_momo" : "orange_money");
    await b.service.surCommandeTerminee(id);
    verifier(`invariant ${id} : restaurant + livreur + Speedfood = total`, p.restaurantGnf + p.livreurGnf + p.speedfoodBrutGnf, p.totalGnf);
  }
  const s = soldes(b.etat.ecritures);
  verifier("trois commandes terminées : le livre est équilibré, plus rien à verser, l'argent restant chez le prestataire est le net de Speedfood", [estEquilibre(b.etat.ecritures), s.a_verser_restaurant, s.a_verser_livreur, s.fonds_a_liberer, s.fonds_operateur === -(s.produit_speedfood + s.charge_frais_mobile)], [true, 0, 0, 0, true]);
}

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nService de paiement vérifié.");
