import {
  LIBELLES_REGLEMENT,
  MODES_REGLEMENT,
  MODES_REGLEMENT_LISIBLES,
  appelPossible,
  compteDansAddition,
  estModeReglement,
  estModeReglementPropose,
  estReglageValidation,
  estServiceTable,
  etatTable,
  prenomSeul,
  prochainNumeroAppel,
  totalAddition,
  validationRequise,
  verifierModeReglementCloture,
} from "../../src/lib/table/regles";

import { readFileSync } from "node:fs";
import { join } from "node:path";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- validation par le serveur
verifier("première : validée seulement tant que la table n'est pas validée", [validationRequise({ reglage: "premiere", tableDejaValidee: false, sansCompte: false }), validationRequise({ reglage: "premiere", tableDejaValidee: true, sansCompte: false })], [true, false]);
verifier("toutes : toujours", [validationRequise({ reglage: "toutes", tableDejaValidee: true, sansCompte: false }), validationRequise({ reglage: "toutes", tableDejaValidee: false, sansCompte: true })], [true, true]);
verifier("aucune avec compte : jamais", validationRequise({ reglage: "aucune", tableDejaValidee: false, sansCompte: false }), false);
verifier("aucune SANS compte : retombe sur « première »", [validationRequise({ reglage: "aucune", tableDejaValidee: false, sansCompte: true }), validationRequise({ reglage: "aucune", tableDejaValidee: true, sansCompte: true })], [true, false]);

// --- addition
verifier("addition : somme des commandes qui comptent", totalAddition([{ statut: "acceptee", sousTotal: 15000 }, { statut: "terminee", sousTotal: 8000 }, { statut: "prete", sousTotal: 2000 }]), 25000);
verifier("addition : refusée et annulée ne comptent pas", totalAddition([{ statut: "refusee", sousTotal: 9000 }, { statut: "annulee", sousTotal: 4000 }, { statut: "en_attente", sousTotal: 3000 }]), 3000);
verifier("addition : valeurs invalides ignorées (jamais de flottant)", totalAddition([{ statut: "acceptee", sousTotal: 1000.5 }, { statut: "acceptee", sousTotal: -5 }, { statut: "acceptee", sousTotal: 2000 }]), 2000);
verifier("addition vide", totalAddition([]), 0);
verifier("compteDansAddition", [compteDansAddition("en_attente"), compteDansAddition("refusee"), compteDansAddition("annulee")], [true, false, false]);

// --- prénom seul (vue du convive)
verifier("prénom seul : premier mot, nom complet ignoré", [prenomSeul("Mariama Diallo"), prenomSeul("  Ibrahima   Sow ")], ["Mariama", "Ibrahima"]);
verifier("prénom seul : vide ou blanc → Convive", [prenomSeul(""), prenomSeul("   "), prenomSeul(undefined as unknown as string)], ["Convive", "Convive", "Convive"]);
verifier("prénom seul : tronqué à 24 caractères", prenomSeul("Abcdefghijklmnopqrstuvwxyz").length, 24);
verifier("prénom seul : un emoji n'est pas coupé en deux", prenomSeul("😀".repeat(30)), "😀".repeat(24));

// --- numéro d'appel
verifier("numéro d'appel", [prochainNumeroAppel(null), prochainNumeroAppel(0), prochainNumeroAppel(41), prochainNumeroAppel(Number.NaN)], [1, 1, 42, 1]);

// --- listes fermées
verifier("réglages reconnus", [estReglageValidation("premiere"), estReglageValidation("tout"), estServiceTable("comptoir"), estServiceTable("terrasse"), estModeReglement("mtn_momo"), estModeReglement("carte")], [true, false, true, false, true, false]);

// --- appels
const t0 = new Date("2026-10-18T12:00:00Z");
verifier("appel : le premier passe", appelPossible(null, t0), true);
verifier("appel : refusé avant 60 s, accepté après", [appelPossible("2026-10-18T11:59:30Z", t0), appelPossible("2026-10-18T11:58:59Z", t0)], [false, true]);

// --- état d'une table
const base = { commandes: [{ statut: "acceptee" }], validee: true, appelServeur: false, additionDemandee: false };
verifier("table : en cours", etatTable(base), "en_cours");
verifier("table : à valider (non validée avec une commande en attente)", etatTable({ ...base, validee: false, commandes: [{ statut: "en_attente" }] }), "a_valider");
verifier("table : à valider prime sur l'addition", etatTable({ ...base, validee: false, commandes: [{ statut: "en_attente" }], additionDemandee: true }), "a_valider");
verifier("table : addition avant appel simple, appel avant en cours", [etatTable({ ...base, additionDemandee: true, appelServeur: true }), etatTable({ ...base, appelServeur: true })], ["addition_demandee", "appel"]);

// --- règlement d'une table : plus d'espèces proposées (règle du 3 novembre 2026), anciennes valeurs encore lisibles
verifier("modes proposés : mobile money seulement", [...MODES_REGLEMENT], ["orange_money", "mtn_momo"]);
verifier("modes lisibles : espèces reste reconnue pour les anciennes lignes", [...MODES_REGLEMENT_LISIBLES], ["especes", "orange_money", "mtn_momo"]);
verifier("chaque mode lisible a son libellé", MODES_REGLEMENT_LISIBLES.map((m) => typeof LIBELLES_REGLEMENT[m]), ["string", "string", "string"]);
verifier("lecture tolérante : estModeReglement accepte toujours espèces", [estModeReglement("especes"), estModeReglement("orange_money"), estModeReglement("carte")], [true, true, false]);
verifier("estModeReglementPropose : refuse espèces et l'inconnu", [estModeReglementPropose("especes"), estModeReglementPropose("orange_money"), estModeReglementPropose("mtn_momo"), estModeReglementPropose("carte"), estModeReglementPropose(null)], [false, true, true, false, false]);
verifier("clôture : un mode proposé passe", [verifierModeReglementCloture("orange_money"), verifierModeReglementCloture("mtn_momo")], [{ ok: true, mode: "orange_money" }, { ok: true, mode: "mtn_momo" }]);
const refusEspeces = verifierModeReglementCloture("especes");
verifier("clôture : espèces refusée avec un message clair", [refusEspeces.ok, !refusEspeces.ok && /espèces/.test(refusEspeces.erreur) && /Orange Money/.test(refusEspeces.erreur)], [false, true]);
verifier("clôture : mode absent ou inconnu refusé", [verifierModeReglementCloture(undefined).ok, verifierModeReglementCloture("carte").ok, verifierModeReglementCloture(42).ok], [false, false, false]);

// Câblage (motifs de code) : la clôture passe par le contrôle partagé AVANT toute lecture ou écriture en base ; l'écran de la salle ne boucle que sur les modes proposés.
const racineTable = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const lireSource = (rel: string) => readFileSync(join(racineTable, rel), "utf8");
const serviceTable = lireSource("src/lib/table/service.ts");
const debutCloture = serviceTable.indexOf("export async function cloturerTable(");
const corpsCloture = serviceTable.slice(debutCloture, serviceTable.indexOf("export async function annulerTable("));
verifier("câblage : cloturerTable contrôle le mode avant la base et n'écrit que le mode contrôlé", [corpsCloture.indexOf("verifierModeReglementCloture(args.mode)") > -1 && corpsCloture.indexOf("verifierModeReglementCloture(args.mode)") < corpsCloture.indexOf("clientLivraison()"), /paiement_mode: args.mode/.test(corpsCloture)], [true, false]);
const salle = lireSource("src/app/restaurant/(console)/salle/SalleTables.tsx");
verifier("câblage : l'écran de la salle ne propose que les modes proposés", [/MODES_REGLEMENT.map/.test(salle), /MODES_REGLEMENT_LISIBLES/.test(salle)], [true, false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
