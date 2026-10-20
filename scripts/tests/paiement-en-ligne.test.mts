import { ETATS_PAIEMENT, EVENEMENTS_PAIEMENT, estMontantGnf, estOperateur, type EtatPaiement } from "../../src/lib/paiement/en-ligne/types";
import { argentRecu, peutLiberer, transitionPaiement } from "../../src/lib/paiement/en-ligne/machine";
import { appliquerRemboursementPartiel, calculerRepartition, fraisMobile, type EntreeRepartition } from "../../src/lib/paiement/en-ligne/repartition";
import {
  COMPTES,
  ecrituresEncaissement,
  ecrituresFraisMobile,
  ecrituresLiberation,
  ecrituresRemboursementApresLiberation,
  ecrituresRemboursementAvantLiberation,
  ecrituresVersement,
  estEquilibre,
  soldes,
  type Ecriture,
} from "../../src/lib/paiement/en-ligne/ecritures";
import { REGLES_LITIGES_SIMULATION, decider } from "../../src/lib/paiement/en-ligne/litiges";
import { calculerSignature, signatureValide } from "../../src/lib/paiement/en-ligne/signature";
import { creerPasserelleSimulation } from "../../src/lib/paiement/en-ligne/simulation";
import { creerPasserelleChapChap, etatDepuisStatutChapChap } from "../../src/lib/paiement/en-ligne/chapchap";
import { ErreurPasserelle } from "../../src/lib/paiement/en-ligne/fournisseur";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
async function leve(f: () => Promise<unknown>): Promise<string> {
  try {
    await f();
    return "aucune erreur";
  } catch (e) {
    return e instanceof ErreurPasserelle ? e.code : e instanceof Error ? "erreur:" + e.message : "inconnu";
  }
}

// Générateur pseudo-aléatoire déterministe (les tests sont reproductibles).
let graine = 20261021;
const alea = () => {
  graine = (graine * 1664525 + 1013904223) % 4294967296;
  return graine / 4294967296;
};
const entier = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));

// ---------------------------------------------------------------- types
verifier("montant GNF : entiers positifs ou nuls seulement", [estMontantGnf(0), estMontantGnf(25_000), estMontantGnf(-1), estMontantGnf(1.5), estMontantGnf("5"), estMontantGnf(Number.NaN), estMontantGnf(2 ** 60)], [true, true, false, false, false, false, false]);
verifier("opérateurs reconnus", [estOperateur("orange_money"), estOperateur("mtn_momo"), estOperateur("cash")], [true, true, false]);

// ---------------------------------------------------------------- machine à états
const t = (e: EtatPaiement, ev: (typeof EVENEMENTS_PAIEMENT)[number]) => transitionPaiement(e, ev);
verifier("machine : parcours nominal cree → en_attente → confirme → libere", [t("cree", "demander"), t("en_attente", "notification_succes"), t("confirme", "liberer")].map((r) => (r.ok ? r.etat : "refuse")), ["en_attente", "confirme", "libere"]);
verifier("machine : échec, annulation, expiration", [t("en_attente", "notification_echec"), t("en_attente", "notification_annulation"), t("en_attente", "expiration")].map((r) => (r.ok ? r.etat : "refuse")), ["echoue", "annule", "expire"]);
verifier("machine : remboursement total depuis confirmé", t("confirme", "remboursement_total").ok && (t("confirme", "remboursement_total") as { etat: string }).etat, "rembourse");
verifier("machine : litige puis libération ou remboursement", [t("confirme", "ouvrir_litige"), t("libere", "ouvrir_litige"), t("en_litige", "clore_litige_liberer"), t("en_litige", "clore_litige_rembourser")].map((r) => (r.ok ? r.etat : "refuse")), ["en_litige", "en_litige", "libere", "rembourse"]);
verifier("machine : succès tardif après expiration ou annulation → confirmé (l'argent n'est jamais perdu de vue)", [t("expire", "notification_succes"), t("annule", "notification_succes")].map((r) => (r.ok ? r.etat : "refuse")), ["confirme", "confirme"]);
verifier("machine : notification de succès rejouée après libération, litige ou remboursement = sans effet", ["libere", "en_litige", "rembourse", "confirme"].map((e) => { const r = t(e as EtatPaiement, "notification_succes"); return r.ok ? r.change : "refuse"; }), [false, false, false, false]);
verifier("machine : double libération = sans effet (idempotence)", (() => { const r = t("libere", "liberer"); return r.ok ? [r.etat, r.change] : "refuse"; })(), ["libere", false]);
verifier("machine : double demande ou double annulation = sans effet", [t("en_attente", "demander"), t("annule", "annuler")].map((r) => (r.ok ? r.change : "refuse")), [false, false]);
verifier("machine : transitions interdites refusées", [t("libere", "demander"), t("echoue", "notification_succes"), t("confirme", "notification_echec"), t("cree", "liberer"), t("en_attente", "liberer"), t("rembourse", "liberer"), t("expire", "liberer"), t("annule", "liberer")].map((r) => r.ok), [false, false, false, false, false, false, false, false]);
verifier("machine : on ne libère JAMAIS sans avoir confirmé (aucun état autre que confirmé ou litige n'y mène)", (() => {
  const sources: string[] = [];
  for (const e of ETATS_PAIEMENT) for (const ev of EVENEMENTS_PAIEMENT) { const r = t(e, ev); if (r.ok && r.change && r.etat === "libere") sources.push(`${e}/${ev}`); }
  return sources.sort();
})(), ["confirme/liberer", "en_litige/clore_litige_liberer"]);
verifier("machine : un événement valide ne mène jamais à un état inconnu", ETATS_PAIEMENT.flatMap((e) => EVENEMENTS_PAIEMENT.map((ev) => t(e, ev))).every((r) => !r.ok || (ETATS_PAIEMENT as readonly string[]).includes(r.etat)), true);
verifier("machine : argent reçu / libérable", [argentRecu("confirme"), argentRecu("libere"), argentRecu("en_attente"), argentRecu("expire"), peutLiberer("confirme"), peutLiberer("en_litige"), peutLiberer("libere")], [true, true, false, false, true, false, false]);

// ---------------------------------------------------------------- répartition
const base = (extra: Partial<EntreeRepartition> = {}): EntreeRepartition => ({ repasGnf: 25_000, fraisLivraisonGnf: 0, fraisSpeedfoodGnf: 1_000, tauxFraisMobilePermille: 15, livraisonPar: "aucune", ...extra });
const rep = (e: EntreeRepartition) => { const r = calculerRepartition(e); if (!r.ok) throw new Error(r.raison); return r.repartition; };

verifier("frais mobile : arrondi au GNF supérieur", [fraisMobile(25_000, 15), fraisMobile(30_000, 17), fraisMobile(10_001, 15), fraisMobile(1, 15), fraisMobile(0, 15), fraisMobile(1000, 0)], [375, 510, 151, 1, 0, 0]);
verifier("répartition : retrait, repas 25 000, frais fixe 1 000, 1,5 %", rep(base()), { totalClientGnf: 25_000, restaurantGnf: 24_000, livreurGnf: 0, speedfoodBrutGnf: 1_000, fraisMobileGnf: 375, fraisVersementTotalGnf: 0, speedfoodNetGnf: 625, deficit: false, fraisSpeedfoodAppliqueGnf: 1_000 });
verifier("répartition : livraison indépendante, 5 000 de frais, 1,7 %", (() => { const r = rep(base({ fraisLivraisonGnf: 5_000, livraisonPar: "livreur_independant", tauxFraisMobilePermille: 17 })); return [r.totalClientGnf, r.restaurantGnf, r.livreurGnf, r.fraisMobileGnf, r.speedfoodNetGnf]; })(), [30_000, 24_000, 5_000, 510, 490]);
verifier("répartition : livraison par le restaurant → les frais lui reviennent", (() => { const r = rep(base({ fraisLivraisonGnf: 5_000, livraisonPar: "restaurant" })); return [r.restaurantGnf, r.livreurGnf]; })(), [29_000, 0]);
verifier("répartition : le frais fixe ne dépasse jamais le repas", (() => { const r = rep(base({ repasGnf: 800, fraisSpeedfoodGnf: 1_000 })); return [r.fraisSpeedfoodAppliqueGnf, r.restaurantGnf, r.speedfoodBrutGnf]; })(), [800, 0, 800]);
verifier("répartition : un net négatif est signalé comme déficit", (() => { const r = rep(base({ fraisSpeedfoodGnf: 100 })); return [r.speedfoodNetGnf, r.deficit]; })(), [-275, true]);
verifier("répartition : frais de versement par bénéficiaire payé", (() => { const r = rep(base({ fraisLivraisonGnf: 5_000, livraisonPar: "livreur_independant", fraisVersementGnf: 100 })); return [r.fraisVersementTotalGnf, r.speedfoodNetGnf]; })(), [200, 1_000 - 450 - 200]);
verifier("répartition : entrées invalides refusées", [
  calculerRepartition(base({ repasGnf: 0 })).ok,
  calculerRepartition(base({ repasGnf: -5 })).ok,
  calculerRepartition(base({ repasGnf: 1.5 })).ok,
  calculerRepartition(base({ tauxFraisMobilePermille: 101 })).ok,
  calculerRepartition(base({ fraisLivraisonGnf: 3_000, livraisonPar: "aucune" })).ok,
  calculerRepartition(base({ fraisSpeedfoodGnf: Number.NaN })).ok,
], [false, false, false, false, false, false]);
verifier("répartition : 3 000 entrées aléatoires, la somme des parts égale toujours le total, tout est entier et positif", (() => {
  let violations = 0;
  for (let i = 0; i < 3_000; i++) {
    const par = (["aucune", "livreur_independant", "restaurant"] as const)[entier(0, 2)];
    const r = calculerRepartition({ repasGnf: entier(1, 600_000), fraisLivraisonGnf: par === "aucune" ? 0 : entier(0, 40_000), fraisSpeedfoodGnf: entier(0, 20_000), tauxFraisMobilePermille: entier(0, 100), livraisonPar: par, fraisVersementGnf: entier(0, 500) });
    if (!r.ok) { violations++; continue; }
    const x = r.repartition;
    const entiers = [x.totalClientGnf, x.restaurantGnf, x.livreurGnf, x.speedfoodBrutGnf, x.fraisMobileGnf].every((v) => Number.isSafeInteger(v) && v >= 0);
    if (!entiers || x.restaurantGnf + x.livreurGnf + x.speedfoodBrutGnf !== x.totalClientGnf) violations++;
  }
  return violations;
})(), 0);
verifier("répartition : remboursement partiel supporté par le restaurant", (() => { const r = rep(base()); const a = appliquerRemboursementPartiel(r, 4_000); return a.ok ? [a.repartition.totalClientGnf, a.repartition.restaurantGnf, a.repartition.speedfoodBrutGnf] : "refuse"; })(), [21_000, 20_000, 1_000]);
verifier("répartition : remboursement partiel au-delà de la part du restaurant refusé", [appliquerRemboursementPartiel(rep(base()), 24_001).ok, appliquerRemboursementPartiel(rep(base()), 0).ok, appliquerRemboursementPartiel(rep(base()), 1.5).ok], [false, false, false]);

// ---------------------------------------------------------------- livre de comptes
verifier("écritures : chaque événement produit un groupe équilibré", [
  estEquilibre(ecrituresEncaissement(30_000)),
  estEquilibre(ecrituresFraisMobile(450)),
  estEquilibre(ecrituresLiberation(rep(base({ fraisLivraisonGnf: 5_000, livraisonPar: "livreur_independant" })))),
  estEquilibre(ecrituresVersement("restaurant", 24_000, 100)),
  estEquilibre(ecrituresRemboursementAvantLiberation(30_000)),
  estEquilibre(ecrituresRemboursementApresLiberation(5_000)),
], [true, true, true, true, true, true]);
verifier("écritures : un montant nul ne produit aucune ligne", [ecrituresEncaissement(0), ecrituresFraisMobile(0), ecrituresVersement("livreur", 0)], [[], [], []]);
verifier("écritures : un montant invalide est refusé", (() => { try { ecrituresEncaissement(-1); return "accepté"; } catch { return "refusé"; } })(), "refusé");
verifier("écritures : une répartition incohérente est refusée", (() => { try { ecrituresLiberation({ ...rep(base()), restaurantGnf: 1 }); return "accepté"; } catch { return "refusé"; } })(), "refusé");

function cycleComplet(e: EntreeRepartition): { ecritures: Ecriture[]; r: ReturnType<typeof rep> } {
  const r = rep(e);
  const fv = e.fraisVersementGnf ?? 0;
  const ecritures = [
    ...ecrituresEncaissement(r.totalClientGnf),
    ...ecrituresFraisMobile(r.fraisMobileGnf),
    ...ecrituresLiberation(r),
    ...ecrituresVersement("restaurant", r.restaurantGnf, r.restaurantGnf > 0 ? fv : 0),
    ...ecrituresVersement("livreur", r.livreurGnf, r.livreurGnf > 0 ? fv : 0),
  ];
  return { ecritures, r };
}
verifier("écritures : cycle complet, il ne reste chez le prestataire que le net de Speedfood", (() => {
  const { ecritures, r } = cycleComplet(base({ fraisLivraisonGnf: 5_000, livraisonPar: "livreur_independant", fraisVersementGnf: 100 }));
  const s = soldes(ecritures);
  return [estEquilibre(ecritures), s.fonds_operateur === r.speedfoodNetGnf, s.fonds_a_liberer, s.a_verser_restaurant, s.a_verser_livreur, -s.produit_speedfood === r.speedfoodBrutGnf, s.charge_frais_mobile === r.fraisMobileGnf + r.fraisVersementTotalGnf];
})(), [true, true, 0, 0, 0, true, true]);
verifier("écritures : 1 500 cycles aléatoires, toujours équilibrés, dettes soldées, fonds restants = net de Speedfood", (() => {
  let violations = 0;
  for (let i = 0; i < 1_500; i++) {
    const par = (["aucune", "livreur_independant", "restaurant"] as const)[entier(0, 2)];
    const e: EntreeRepartition = { repasGnf: entier(1, 500_000), fraisLivraisonGnf: par === "aucune" ? 0 : entier(0, 30_000), fraisSpeedfoodGnf: entier(0, 15_000), tauxFraisMobilePermille: entier(0, 40), livraisonPar: par, fraisVersementGnf: entier(0, 300) };
    const { ecritures, r } = cycleComplet(e);
    const s = soldes(ecritures);
    if (!estEquilibre(ecritures) || s.fonds_a_liberer !== 0 || s.a_verser_restaurant !== 0 || s.a_verser_livreur !== 0 || s.fonds_operateur !== r.speedfoodNetGnf) violations++;
  }
  return violations;
})(), 0);
verifier("écritures : remboursement total avant libération, plus rien chez le prestataire hors frais", (() => {
  const total = 30_000;
  const s = soldes([...ecrituresEncaissement(total), ...ecrituresFraisMobile(450), ...ecrituresRemboursementAvantLiberation(total)]);
  return [s.fonds_operateur, s.fonds_a_liberer, s.charge_frais_mobile];
})(), [-450, 0, 450]);
verifier("écritures : remboursement après libération = perte de Speedfood enregistrée", (() => {
  const { ecritures } = cycleComplet(base());
  const s = soldes([...ecritures, ...ecrituresRemboursementApresLiberation(2_000)]);
  return [s.charge_remboursement, s.fonds_operateur];
})(), [2_000, 625 - 2_000]);
verifier("écritures : tous les comptes sont déclarés", COMPTES.length, 7);

// ---------------------------------------------------------------- litiges
const ctx = (situation: Parameters<typeof decider>[0]["situation"], extra: Record<string, unknown> = {}) => decider({ situation, repasGnf: 25_000, fraisLivraisonGnf: 5_000, ...extra } as Parameters<typeof decider>[0]);
verifier("litige : le restaurant refuse ou annule → remboursement total, personne payé", (() => { const d = ctx("restaurant_refuse_ou_annule"); return [d.decision, d.remboursementClientGnf, d.restaurantPaye, d.livreurPaye, d.perteSpeedfoodGnf]; })(), ["rembourser_total", 30_000, false, false, 0]);
verifier("litige : le livreur ne livre pas avant récupération → remboursement total, personne payé", (() => { const d = ctx("livreur_ne_livre_pas", { commandeRecupereeParLivreur: false }); return [d.remboursementClientGnf, d.restaurantPaye, d.perteSpeedfoodGnf, d.regle]; })(), [30_000, false, 0, "livreur_ne_livre_pas_avant_recuperation"]);
verifier("litige : le livreur ne livre pas après récupération → client remboursé, restaurant payé aux frais de Speedfood", (() => { const d = ctx("livreur_ne_livre_pas", { commandeRecupereeParLivreur: true }); return [d.remboursementClientGnf, d.restaurantPaye, d.livreurPaye, d.perteSpeedfoodGnf]; })(), [30_000, true, false, 25_000]);
verifier("litige : client injoignable → pas de remboursement, restaurant et livreur payés", (() => { const d = ctx("client_injoignable"); return [d.decision, d.remboursementClientGnf, d.restaurantPaye, d.livreurPaye]; })(), ["aucun_remboursement", 0, true, true]);
verifier("litige : plat manquant, petit montant avec preuve → remboursement partiel automatique", (() => { const d = ctx("plat_manquant_ou_errone", { montantDemandeGnf: 5_000, preuveFournie: true }); return [d.decision, d.remboursementClientGnf, d.regle]; })(), ["rembourser_partiel", 5_000, "plat_manquant_partiel_automatique"]);
verifier("litige : plat manquant, cas renvoyés à un humain", [
  ctx("plat_manquant_ou_errone", { montantDemandeGnf: 5_000, preuveFournie: false }).regle,
  ctx("plat_manquant_ou_errone", { montantDemandeGnf: 9_000, preuveFournie: true }).regle,
  ctx("plat_manquant_ou_errone", { montantDemandeGnf: 30_000, preuveFournie: true }).regle,
  ctx("plat_manquant_ou_errone", { montantDemandeGnf: 0, preuveFournie: true }).regle,
  ctx("plat_manquant_ou_errone", { preuveFournie: true }).regle,
  decider({ situation: "plat_manquant_ou_errone", repasGnf: 400_000, fraisLivraisonGnf: 0, montantDemandeGnf: 60_000, preuveFournie: true }).regle,
], ["preuve_absente", "montant_demande_au_dessus_du_plafond_automatique", "montant_demande_superieur_au_repas", "montant_demande_invalide", "montant_demande_invalide", "montant_demande_au_dessus_du_seuil"]);
verifier("litige : contestation après libération → humain", ctx("contestation_apres_liberation").decision, "humain");
verifier("litige : données invalides → humain, jamais de décision hors règle", [decider({ situation: "client_injoignable", repasGnf: -1, fraisLivraisonGnf: 0 }).decision, decider({ situation: "client_injoignable", repasGnf: 0, fraisLivraisonGnf: 0 }).decision], ["humain", "humain"]);
verifier("litige : les seuils sont réglables", decider({ situation: "plat_manquant_ou_errone", repasGnf: 25_000, fraisLivraisonGnf: 0, montantDemandeGnf: 9_000, preuveFournie: true }, { ...REGLES_LITIGES_SIMULATION, plafondRemboursementAutoPourMille: 400 }).decision, "rembourser_partiel");

// ---------------------------------------------------------------- signature
verifier("signature : vecteur de test officiel HMAC-SHA256 (RFC 4231, cas 2)", calculerSignature("what do ya want for nothing?", "Jefe"), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
const corps = '{"identifiant":"n1","referenceExterne":"X","etat":"succes"}';
const sig = calculerSignature(corps, "secret");
verifier("signature : valide, insensible à la casse et aux espaces autour", [signatureValide(corps, sig, "secret"), signatureValide(corps, sig.toUpperCase(), "secret"), signatureValide(corps, ` ${sig} `, "secret")], [true, true, true]);
verifier("signature : refusée si le corps, la clé ou la signature changent", [signatureValide(corps + " ", sig, "secret"), signatureValide(corps, sig, "autre"), signatureValide(corps, sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0"), "secret"), signatureValide(corps, sig.slice(0, 30), "secret")], [false, false, false, false]);
verifier("signature : absente, vide ou sans clé = refusée sans exception", [signatureValide(corps, undefined, "secret"), signatureValide(corps, null, "secret"), signatureValide(corps, "", "secret"), signatureValide(corps, sig, "")], [false, false, false, false]);
verifier("signature : encodage base64", [signatureValide(corps, calculerSignature(corps, "secret", "base64"), "secret", "base64"), signatureValide(corps, sig, "secret", "base64")], [true, false]);

// ---------------------------------------------------------------- simulation
const sim = creerPasserelleSimulation({ cle: "cle-test" });
const enc = await sim.encaisser({ referenceInterne: "P-1", montantGnf: 30_000, operateur: "orange_money", description: "Commande" });
verifier("simulation : encaissement sans réseau, référence déterministe", enc, { referenceExterne: "SIM-P-1", urlPaiement: null });
const n = sim.fabriquerNotification({ identifiant: "evt-1", referenceExterne: "SIM-P-1", referenceInterne: "P-1", etat: "succes", montantGnf: 30_000 });
verifier("simulation : une notification fabriquée est acceptée et relue", sim.verifierNotification(n.corps, n.entetes), { ok: true, evenement: { identifiant: "evt-1", referenceExterne: "SIM-P-1", referenceInterne: "P-1", etat: "succes", montantGnf: 30_000 } });
verifier("simulation : signature falsifiée ou absente refusées", [sim.verifierNotification(n.corps.replace("30000", "99999"), n.entetes), sim.verifierNotification(n.corps, {})], [{ ok: false, raison: "signature_invalide" }, { ok: false, raison: "signature_invalide" }]);
const signe = (o: unknown) => { const c = JSON.stringify(o); return { c, e: { "x-simulation-signature": calculerSignature(c, "cle-test") } }; };
verifier("simulation : champs manquants, état inconnu, montant invalide refusés", [
  (() => { const s = signe({ referenceExterne: "X", etat: "succes", montantGnf: 1 }); return sim.verifierNotification(s.c, s.e); })(),
  (() => { const s = signe({ identifiant: "a", referenceExterne: "X", etat: "gagne", montantGnf: 1 }); return sim.verifierNotification(s.c, s.e); })(),
  (() => { const s = signe({ identifiant: "a", referenceExterne: "X", etat: "succes", montantGnf: -5 }); return sim.verifierNotification(s.c, s.e); })(),
  (() => { const s = signe({ identifiant: "a", referenceExterne: "X", etat: "succes", montantGnf: 1.5 }); return sim.verifierNotification(s.c, s.e); })(),
].map((r) => (r.ok ? "accepté" : r.raison)), ["champs_manquants", "etat_inconnu", "montant_invalide", "montant_invalide"]);
verifier("simulation : corps illisible refusé sans exception", (() => { const c = "pas du json"; const r = sim.verifierNotification(c, { "x-simulation-signature": calculerSignature(c, "cle-test") }); return r.ok ? "accepté" : r.raison; })(), "corps_illisible");
verifier("simulation : versement et remboursement réussissent sans réseau", [(await sim.verser({ referenceInterne: "V-1", montantGnf: 24_000, operateur: "mtn_momo", numero: "620000000" })).etat, (await sim.rembourser({ referenceExterneEncaissement: "SIM-P-1", referenceInterne: "R-1", montantGnf: 5_000 })).etat], ["succes", "succes"]);

// ---------------------------------------------------------------- adaptateur Chap Chap Pay (squelette)
verifier("chapchap : statuts de notification connus convertis, `error` et inconnus = indéterminés", ["success", "failed", "canceled", "expired", "error", "autre", ""].map(etatDepuisStatutChapChap), ["succes", "echec", "annule", "expire", null, null, null]);
const sansCles = creerPasserelleChapChap({ cleApi: null, cleSignature: null });
const avecCles = creerPasserelleChapChap({ cleApi: "k", cleSignature: "s" });
const demande = { referenceInterne: "P-2", montantGnf: 10_000, operateur: "orange_money" as const, description: "x" };
verifier("chapchap : sans clés, refuse proprement", await leve(() => sansCles.encaisser(demande)), "non_configuree");
verifier("chapchap : avec clés mais sans référence API, refuse explicitement plutôt que de deviner", [await leve(() => avecCles.encaisser(demande)), await leve(() => avecCles.lireStatut("X")), await leve(() => avecCles.verser({ referenceInterne: "V", montantGnf: 1, operateur: "mtn_momo", numero: "6" })), await leve(() => avecCles.rembourser({ referenceExterneEncaissement: "X", referenceInterne: "R", montantGnf: 1 }))], ["non_implemente", "non_implemente", "non_implemente", "non_implemente"]);
verifier("chapchap : toute notification est refusée tant que le format est inconnu", avecCles.verifierNotification("{}", { "ccp-hmac-signature": "abc" }), { ok: false, raison: "adaptateur_non_implemente" });

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon (paiement en ligne).");
