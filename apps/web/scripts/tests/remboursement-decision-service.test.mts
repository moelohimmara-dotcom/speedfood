import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decider } from "../../src/lib/paiement/en-ligne/litiges";
import { roleAPermission, type RoleSysteme } from "../../src/lib/system-admin/permissions";
import {
  changerReglageEspeces,
  enregistrerDecision,
  type CibleDecision,
  type DecisionEnregistree,
  type LigneDecision,
  type PortsDecision,
  type PortsReglage,
} from "../../src/lib/paiement/en-ligne/remboursement-decision-service";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const lire = (rel: string) => readFileSync(join(racine, rel), "utf8");

// ---------------------------------------------------------------------------------------------------------------- mémoire de test
const CIBLE: CibleDecision = {
  orderId: "ordre-1",
  paiementId: "paiement-1",
  litigeId: "litige-1",
  totalGnf: 30_000,
  modeOrigine: "chapchap",
  regleAutomatique: decider({ situation: "restaurant_refuse_ou_annule", repasGnf: 25_000, fraisLivraisonGnf: 5_000 }),
};

function memoire(options: { cible?: CibleDecision | null; especes?: boolean | "erreur"; insertion?: "ok" | "conflit" | "erreur" } = {}) {
  const decisions: DecisionEnregistree[] = [];
  const appels = { chargerCible: 0, inserer: 0, lireEspeces: 0 };
  const ports: PortsDecision = {
    async lireEspecesAutorise() {
      appels.lireEspeces++;
      if (options.especes === "erreur") throw new Error("base indisponible");
      return options.especes === true;
    },
    async chargerCible() {
      appels.chargerCible++;
      return options.cible === undefined ? CIBLE : options.cible;
    },
    async decisionCourante(orderId) {
      const liste = decisions.filter((d) => d.orderId === orderId);
      return liste[liste.length - 1] ?? null;
    },
    async historique(orderId) {
      return decisions.filter((d) => d.orderId === orderId);
    },
    async inserer(ligne: LigneDecision) {
      appels.inserer++;
      if (options.insertion === "conflit") return { ok: false, raison: "conflit" };
      if (options.insertion === "erreur") return { ok: false, raison: "erreur" };
      const id = `dec-${decisions.length + 1}`;
      decisions.push({ ...ligne, id, decideLe: `2026-11-1${decisions.length}T10:00:00.000Z` });
      return { ok: true, id };
    },
  };
  return { ports, decisions, appels };
}
const permissionsDe = (role: RoleSysteme) => (p: "parametres.editer" | "commande.support") => roleAPermission(role, p);
const saisieOk = { issue: "rembourser_total", montantGnf: null, moyen: "mobile_money_manuel", motif: "Annulation par le restaurant", referenceAvis: "", reconnaitArgentChezRestaurant: false };

// ---------------------------------------------------------------------------------------------------------------- accès : super administrateur seulement
for (const role of ["support", "operations", "content_editor"] as const) {
  const m = memoire();
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe(role), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier(`accès : le rôle « ${role} » ne peut pas enregistrer de décision`, !r.ok && r.erreur.includes("super administrateur"), true);
  verifier(`accès : le rôle « ${role} » : aucune lecture ni écriture n'a eu lieu`, m.appels, { chargerCible: 0, inserer: 0, lireEspeces: 0 });
}
{
  const m = memoire();
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier("accès : le super administrateur enregistre une décision", r.ok, true);
}
{
  const m = memoire();
  const r = await enregistrerDecision(m.ports, { aPermission: () => false, utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier("accès : sans aucune permission, refusé", r.ok, false);
  const sansAuteur = await enregistrerDecision(memoire().ports, { aPermission: () => true, utilisateurId: "", identifiant: "paiement-1", saisie: saisieOk });
  verifier("accès : sans auteur identifié, refusé", sansAuteur.ok, false);
}

// ---------------------------------------------------------------------------------------------------------------- tout est relu côté serveur
{
  const m = memoire();
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: { ...saisieOk, montantGnf: 1 } });
  verifier("montant : un total à 1 GNF envoyé par le navigateur est refusé", !r.ok, true);
  const r2 = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier("montant : le total vient du serveur (30 000 GNF)", r2.ok && m.decisions[0]?.montantGnf === 30_000, true);
  verifier("la décision enregistrée garde l'auteur, le dossier et le mode d'origine lus par le serveur", { auteur: m.decisions[0]?.decideParId, orderId: m.decisions[0]?.orderId, paiementId: m.decisions[0]?.paiementId, mode: m.decisions[0]?.modeOrigine }, { auteur: "u-1", orderId: "ordre-1", paiementId: "paiement-1", mode: "chapchap" });
}
{
  const m = memoire({ cible: null });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "inconnu", saisie: saisieOk });
  verifier("dossier introuvable : refusé, rien écrit", !r.ok && m.appels.inserer === 0, true);
}
{
  // Le total ne vient JAMAIS de la saisie : un champ « totalGnf » glissé dans la requête n'a aucun effet.
  const m = memoire();
  const glisse = { ...saisieOk, totalGnf: 1 } as typeof saisieOk;
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: glisse });
  verifier("montant : un total glissé dans la saisie est ignoré (le total reste celui de la base)", r.ok && m.decisions[0]?.montantGnf === 30_000, true);
}
{
  // Correction : nouvelle décision qui REMPLACE la précédente, choisie par le serveur (aucune bifurcation possible).
  const m = memoire();
  const a = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  const b = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: { ...saisieOk, issue: "ne_pas_rembourser", moyen: "aucun", referenceAvis: "Avis du conseil, point 3" } });
  verifier("correction : la première décision ne remplace rien", a.ok && a.remplaceId === null && m.decisions[0]?.remplaceId === null, true);
  verifier("correction : la seconde remplace la première, choisie par le serveur", b.ok && b.remplaceId === "dec-1" && m.decisions[1]?.remplaceId === "dec-1", true);
  verifier("correction : l'historique garde les deux décisions (rien n'est modifié ni supprimé)", m.decisions.length, 2);
}

// ---------------------------------------------------------------------------------------------------------------- espèces : le serveur relit le réglage
const especes = { ...saisieOk, moyen: "especes_dernier_recours", referenceAvis: "Avis du conseil, point 7" };
{
  const m = memoire({ especes: false });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: especes });
  verifier("espèces : refusées quand le réglage est faux, même si le navigateur envoie le moyen (appel direct)", !r.ok && r.erreur.includes("espèces"), true);
  verifier("espèces refusées : rien n'est écrit", m.appels.inserer, 0);
}
{
  const m = memoire({ especes: "erreur" });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: especes });
  verifier("espèces : réglage illisible = fermé", !r.ok && m.appels.inserer === 0, true);
}
{
  const m = memoire({ especes: true });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: especes });
  verifier("espèces : acceptées quand le réglage est vrai et l'avis fourni", r.ok && m.decisions[0]?.moyen === "especes_dernier_recours", true);
}
{
  const m = memoire({ especes: true });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: { ...especes, referenceAvis: "" } });
  verifier("espèces : refusées sans référence d'avis, même réglage vrai", !r.ok, true);
}
{
  const m = memoire();
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: { ...saisieOk, moyen: "chapchap", referenceAvis: "Avis du conseil, point 7" } });
  verifier("chapchap : refusé clairement, rien écrit", !r.ok && r.erreur.startsWith("Non disponible") && m.appels.inserer === 0, true);
}

// ---------------------------------------------------------------------------------------------------------------- historique en ajout seul
{
  const m = memoire();
  const a = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  const b = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-2", identifiant: "paiement-1", saisie: { ...saisieOk, issue: "ne_pas_rembourser", moyen: "aucun", motif: "Avis reçu : pas de remboursement", referenceAvis: "Avis du conseil du 14 novembre" } });
  verifier("historique : une correction est une NOUVELLE décision", m.decisions.length, 2);
  verifier("historique : la correction remplace la précédente (choisie par le serveur)", b.ok && b.remplaceId === "dec-1", true);
  verifier("historique : la première décision reste intacte", { issue: m.decisions[0]?.issue, moyen: m.decisions[0]?.moyen, remplaceId: m.decisions[0]?.remplaceId }, { issue: "rembourser_total", moyen: "mobile_money_manuel", remplaceId: null });
  verifier("historique : la première décision n'avait remplacé personne", a.ok && a.remplaceId === null, true);
  verifier("historique : lecture complète", (await m.ports.historique("ordre-1")).map((d) => d.id), ["dec-1", "dec-2"]);
}
{
  const m = memoire({ insertion: "conflit" });
  const r = await enregistrerDecision(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier("conflit d'enregistrement : message de rechargement", !r.ok && r.erreur.includes("Rechargez"), true);
  const e = await enregistrerDecision(memoire({ insertion: "erreur" }).ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", identifiant: "paiement-1", saisie: saisieOk });
  verifier("erreur d'enregistrement : rien n'a été modifié", !e.ok && e.erreur.includes("Rien n'a été modifié"), true);
}
const source = lire("src/lib/paiement/en-ligne/remboursement-decision-service.ts");
const interfacePorts = source.slice(source.indexOf("export interface PortsDecision"), source.indexOf("export interface PortsReglage"));
verifier("les ports d'une décision n'offrent ni modification ni suppression", /modifier|supprimer|update|delete|remplacer\(/i.test(interfacePorts.replace(/\/\*[\s\S]*?\*\//g, "")), false);
const lecture = lire("src/lib/paiement/en-ligne/remboursement-lecture.ts");
verifier("le dépôt Supabase de la décision n'écrit que par insertion", [...lecture.matchAll(/from\("remboursement_decisions"\)\s*\.(insert|update|delete|upsert)/g)].map((x) => x[1]), ["insert"]);
verifier("le dépôt n'efface ni ne remplace le journal du réglage", /from\("parametres_remboursement_journal"\)\s*\.(insert|update|delete|upsert)/.test(lecture), false);

// ---------------------------------------------------------------------------------------------------------------- réglage des espèces
function memoireReglage(initial: boolean | "erreur" = false) {
  let valeur = initial === true;
  const ecritures: { valeur: boolean; par: string; motif: string }[] = [];
  const ports: PortsReglage = {
    async lireEspecesAutorise() {
      if (initial === "erreur") throw new Error("illisible");
      return valeur;
    },
    async ecrireEspecesAutorise(v, par, motif) {
      ecritures.push({ valeur: v, par, motif });
      valeur = v;
      return { ok: true };
    },
  };
  return { ports, ecritures };
}
for (const role of ["support", "operations", "content_editor"] as const) {
  const m = memoireReglage();
  const r = await changerReglageEspeces(m.ports, { aPermission: permissionsDe(role), utilisateurId: "u-1", valeur: true, motif: "Demande du conseil" });
  verifier(`réglage : le rôle « ${role} » ne peut pas le changer`, !r.ok && m.ecritures.length === 0, true);
}
{
  const m = memoireReglage();
  const r = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: true, motif: "Avis du conseil du 14 novembre" });
  verifier("réglage : le super administrateur l'active, avec son identité et son motif", r.ok && !r.inchange && m.ecritures[0]?.par === "u-1" && m.ecritures[0]?.motif === "Avis du conseil du 14 novembre" && m.ecritures[0]?.valeur === true, true);
  const sans = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: false, motif: "ok" });
  verifier("réglage : sans motif suffisant, refusé", !sans.ok && m.ecritures.length === 1, true);
  const long = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: false, motif: "x".repeat(201) });
  verifier("réglage : motif trop long, refusé", !long.ok, true);
  const memeValeur = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: true, motif: "Je confirme l'état" });
  verifier("réglage : même valeur = aucun changement, rien n'est écrit", memeValeur.ok && memeValeur.inchange && m.ecritures.length === 1, true);
  const invalide = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: "oui", motif: "Avis du conseil" });
  verifier("réglage : valeur qui n'est pas un booléen, refusée", !invalide.ok, true);
}
{
  const m = memoireReglage("erreur");
  const r = await changerReglageEspeces(m.ports, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: true, motif: "Avis du conseil" });
  verifier("réglage : lecture impossible, rien n'est modifié", !r.ok && m.ecritures.length === 0, true);
}
{
  const refus = await changerReglageEspeces({ lireEspecesAutorise: async () => false, ecrireEspecesAutorise: async () => ({ ok: false }) }, { aPermission: permissionsDe("super_admin"), utilisateurId: "u-1", valeur: true, motif: "Avis du conseil" });
  verifier("réglage : écriture refusée, message sans promesse", !refus.ok && refus.erreur.includes("Rien n'a été modifié"), true);
}

// ---------------------------------------------------------------------------------------------------------------- actions serveur (sources)
const actions = lire("src/lib/system-admin/remboursement-decisions.ts");
verifier("les actions de décision exigent la permission « parametres.editer » (super administrateur)", (actions.match(/verifierPermission\("parametres\.editer"\)/g) ?? []).length, 1);
verifier("aucune action de décision n'accepte la permission d'assistance", /commande\.support/.test(actions.replace(/\/\*[\s\S]*?\*\//g, "")), false);
verifier("les deux actions passent par contexteSuperAdmin", (actions.match(/await contexteSuperAdmin\(\)/g) ?? []).length, 2);
verifier("le service revérifie la permission (défense en profondeur)", (actions.match(/aPermission: \(p\) => roleAPermission\(contexte\.role, p\)/g) ?? []).length, 2);
verifier("l'action n'appelle aucun service de paiement (aucun mouvement d'argent)", /obtenirServicePaiement|trancherLitige|rembourserTotal|rembourserManuellement/.test(actions), false);
verifier("le journal d'audit ne reprend ni le motif ni la référence de l'avis", /motif: `\$\{r\.decision\.issue\}, moyen \$\{r\.decision\.moyen\}, \$\{r\.decision\.montantGnf\} GNF/.test(actions) && !/motif: .*(saisie|referenceAvis)/.test(actions.slice(actions.indexOf("await journaliserActionSysteme"))), true);

if (ko > 0) {
  console.log(`ECHEC remboursement-decision-service : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK remboursement-decision-service");
