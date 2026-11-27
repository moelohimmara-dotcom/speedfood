import { ADRESSE_LIVRAISON_MAX, ADRESSE_POSITION_SEULE, PRECISIONS_MAX, REPERE_MAX, composerAdresse, nettoyerSaisie } from "../../src/lib/commande/adresse-livraison";

/**
 * Adresse de livraison à Conakry (27/11/2026) : un repère connu (obligatoire) et des précisions (facultatives) sont composés en UNE ligne de 5 à 300 caractères,
 * car le serveur, la console du restaurant et l'écran du livreur n'ont qu'une adresse. Avec une position partagée, le repère devient facultatif.
 */

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const sans = { position: false };
const avec = { position: true };

verifier("repère seul", composerAdresse({ repere: "en face de la pharmacie", precisions: "", ...sans }), { adresse: "Repère : en face de la pharmacie", erreurs: {} });
verifier("repère et précisions", composerAdresse({ repere: "derrière la mosquée", precisions: "portail bleu, 2e étage", ...sans }), { adresse: "Repère : derrière la mosquée. Précisions : portail bleu, 2e étage", erreurs: {} });
verifier("espaces multiples et point final nettoyés", composerAdresse({ repere: "  près   du   marché. ", precisions: " portail bleu . ", ...sans }), { adresse: "Repère : près du marché. Précisions : portail bleu", erreurs: {} });
verifier("nettoyerSaisie", nettoyerSaisie("  a \n b ... "), "a b");
verifier("sans repère ni position : refusé avec un exemple", composerAdresse({ repere: "   ", precisions: "portail bleu", ...sans }).adresse, null);
verifier("message du repère manquant cite un exemple", /pharmacie/.test(composerAdresse({ repere: "", precisions: "", ...sans }).erreurs.repere ?? ""), true);
verifier("repère trop court", composerAdresse({ repere: "ab", precisions: "", ...sans }).adresse, null);
verifier("repère de 3 caractères accepté", composerAdresse({ repere: "abc", precisions: "", ...sans }).adresse, "Repère : abc");
verifier("repère trop long", composerAdresse({ repere: "x".repeat(REPERE_MAX + 1), precisions: "", ...sans }).adresse, null);
verifier("précisions trop longues", composerAdresse({ repere: "près du marché", precisions: "y".repeat(PRECISIONS_MAX + 1), ...sans }).erreurs.precisions !== undefined, true);
verifier("position partagée sans texte : texte par défaut", composerAdresse({ repere: "", precisions: "", ...avec }), { adresse: ADRESSE_POSITION_SEULE, erreurs: {} });
verifier("position partagée et précisions seules", composerAdresse({ repere: "", precisions: "portail bleu", ...avec }), { adresse: "Précisions : portail bleu", erreurs: {} });
verifier("position partagée et repère trop court : toujours refusé", composerAdresse({ repere: "a", precisions: "", ...avec }).adresse, null);
verifier("le texte par défaut passe les 5 caractères minimum du serveur", ADRESSE_POSITION_SEULE.length >= 5, true);
const pleine = composerAdresse({ repere: "x".repeat(REPERE_MAX), precisions: "y".repeat(PRECISIONS_MAX), ...sans });
verifier("cas le plus long : sous la limite de 300 du serveur", pleine.adresse !== null && pleine.adresse.length <= ADRESSE_LIVRAISON_MAX, true);
verifier("valeur absente : traitée comme vide", composerAdresse({ repere: undefined as unknown as string, precisions: null as unknown as string, ...avec }).adresse, ADRESSE_POSITION_SEULE);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
console.log("\nTous les contrôles passent.");
