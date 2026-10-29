import { ORDRE_PROFILS, PROFILS, appliquerProfil, profilCorrespondant, reglagesIdentiques, resumerService, validationEffective, type ReglagesSurPlace } from "../../src/lib/table/profils";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const base: ReglagesSurPlace = { actif: true, service: "table", sansCompte: false, validation: "premiere" };

verifier("chaque profil se reconnaît lui-même", ORDRE_PROFILS.map((p) => profilCorrespondant({ service: PROFILS[p].service, validation: PROFILS[p].validation })), ["fast_food", "restaurant", "haut_de_gamme"]);
verifier("réglage hors profil : personnalisé", [profilCorrespondant({ service: "comptoir", validation: "toutes" }), profilCorrespondant({ service: "table", validation: "aucune" })], [null, null]);
verifier("un profil ne touche JAMAIS à « sans compte » ni à l'activation", appliquerProfil({ ...base, sansCompte: true, actif: false }, "fast_food"), { actif: false, service: "comptoir", sansCompte: true, validation: "aucune" });
verifier("appliquer « restaurant » sur du comptoir", appliquerProfil({ ...base, service: "comptoir", validation: "aucune" }, "restaurant"), { actif: true, service: "table", sansCompte: false, validation: "premiere" });
verifier("l'application d'un profil ne modifie pas l'objet d'origine", (() => { const o = { ...base }; appliquerProfil(o, "haut_de_gamme"); return o; })(), base);
verifier("validation effective : sans compte + aucune → première", [validationEffective({ validation: "aucune", sansCompte: true }), validationEffective({ validation: "aucune", sansCompte: false }), validationEffective({ validation: "toutes", sansCompte: true })], ["premiere", "aucune", "toutes"]);
verifier("résumé : service éteint", resumerService({ ...base, actif: false }), "Service sur place : désactivé");
verifier("résumé : à table avec compte", resumerService(base), "Service sur place : activé · À table (une note par table) · Compte requis · Première commande validée");
verifier("résumé : comptoir sans compte, sans validation", resumerService({ actif: true, service: "comptoir", sansCompte: true, validation: "aucune" }), "Service sur place : activé · Au comptoir (numéro d'appel) · Commande sans compte autorisée · Aucune validation");
verifier("réglages identiques / différents", [reglagesIdentiques(base, { ...base }), reglagesIdentiques(base, { ...base, sansCompte: true }), reglagesIdentiques(base, { ...base, actif: false })], [true, false, false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
