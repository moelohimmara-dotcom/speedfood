import { calculerPretEstimeeLe, DELAI_PREPARATION_MAX, DELAI_PREPARATION_MIN, heureDepuisIso, lireDelaiPreparation } from "../../src/lib/commande/estimation";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Bornes : les mêmes que la contrainte de la base (5 à 240).
verifier("bornes du délai", [DELAI_PREPARATION_MIN, DELAI_PREPARATION_MAX], [5, 240]);

// Validation du délai saisi (console du site et application).
verifier("délai : vide, absent ou null = aucune estimation", [lireDelaiPreparation(""), lireDelaiPreparation(null), lireDelaiPreparation(undefined), lireDelaiPreparation("   ")], [
  { ok: true, valeur: null },
  { ok: true, valeur: null },
  { ok: true, valeur: null },
  { ok: true, valeur: null },
]);
verifier("délai : texte ou nombre valide", [lireDelaiPreparation("25"), lireDelaiPreparation(25), lireDelaiPreparation("  30 "), lireDelaiPreparation("5"), lireDelaiPreparation("240")], [
  { ok: true, valeur: 25 },
  { ok: true, valeur: 25 },
  { ok: true, valeur: 30 },
  { ok: true, valeur: 5 },
  { ok: true, valeur: 240 },
]);
for (const mauvais of ["4", "241", "0", "-10", "12.5", "abc", "1e2", "25 min", "99999"]) {
  verifier(`délai refusé : « ${mauvais} »`, lireDelaiPreparation(mauvais).ok, false);
}
verifier("délai refusé : ni nombre ni texte", [lireDelaiPreparation({}).ok, lireDelaiPreparation(true).ok], [false, false]);
verifier("délai : le message dit les bornes", (lireDelaiPreparation("3") as { message: string }).message.includes("entre 5 et 240"), true);

// Heure estimée de préparation : acceptation + délai, seulement tant que la commande est « acceptée ».
const ev = (statutSuivant: string, horodatage: string) => ({ commandeId: "c1", statutPrecedent: null, statutSuivant, acteur: "x", horodatage }) as never;
const historique = [ev("en_attente", "2026-10-29T12:00:00.000Z"), ev("acceptee", "2026-10-29T12:10:00.000Z")];
verifier("prête vers : acceptation + 25 min", calculerPretEstimeeLe("acceptee", 25, historique), "2026-10-29T12:35:00.000Z");
verifier("prête vers : rien avant l'acceptation", calculerPretEstimeeLe("en_attente", 25, [ev("en_attente", "2026-10-29T12:00:00.000Z")]), null);
verifier("prête vers : rien sans délai déclaré", [calculerPretEstimeeLe("acceptee", null, historique), calculerPretEstimeeLe("acceptee", undefined, historique)], [null, null]);
verifier("prête vers : rien une fois prête, terminée ou close", ["prete", "terminee", "refusee", "annulee"].map((s) => calculerPretEstimeeLe(s as never, 25, historique)), [null, null, null, null]);
verifier("prête vers : sans événement d'acceptation, null (pas d'invention)", calculerPretEstimeeLe("acceptee", 25, [ev("en_attente", "2026-10-29T12:00:00.000Z")]), null);
verifier("prête vers : horodatage illisible, null", calculerPretEstimeeLe("acceptee", 25, [ev("acceptee", "pas une date")]), null);
verifier("prête vers : retient la dernière acceptation", calculerPretEstimeeLe("acceptee", 10, [ev("acceptee", "2026-10-29T12:00:00.000Z"), ev("acceptee", "2026-10-29T13:00:00.000Z")]), "2026-10-29T13:10:00.000Z");
verifier("prête vers : passe minuit sans erreur", calculerPretEstimeeLe("acceptee", 60, [ev("acceptee", "2026-10-29T23:30:00.000Z")]), "2026-10-30T00:30:00.000Z");

// Heure affichée : heure de Conakry (UTC+0).
verifier("heure : 14:35", heureDepuisIso("2026-10-29T14:35:00Z"), "14:35");
verifier("heure : zéros devant", heureDepuisIso("2026-10-29T00:05:00Z"), "00:05");
verifier("heure : illisible = vide", heureDepuisIso("n'importe quoi"), "");

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nheure estimée de préparation : tous les contrôles passent");
