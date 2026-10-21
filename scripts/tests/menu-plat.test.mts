import { validerOption, validerPlat } from "../../src/lib/menu/regles-plat";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const MAX = 5_000_000;
const ok = (nom: string, description: string, prix: number, prixPromo: number | null) => ({ ok: true, valeurs: { nom, description, prix, prixPromo } });

verifier("plat valide, textes rognés", validerPlat({ nom: "  Riz gras  ", description: " Avec poulet ", prix: 35000, prixPromo: null }, MAX), ok("Riz gras", "Avec poulet", 35000, null));
verifier("promo absente = null", validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: undefined }, MAX), ok("A", "", 1000, null));
verifier("promo valide, égale au prix ou à zéro", [validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: 1000 }, MAX).ok, validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: 0 }, MAX).ok], [true, true]);
verifier("promo au-dessus du prix refusée", validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: 1001 }, MAX).ok, false);
verifier("promo négative ou à virgule refusée", [validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: -1 }, MAX).ok, validerPlat({ nom: "A", description: "", prix: 1000, prixPromo: 10.5 }, MAX).ok], [false, false]);
verifier("nom vide ou trop long refusé", [validerPlat({ nom: "   ", description: "", prix: 1, prixPromo: null }, MAX).ok, validerPlat({ nom: "x".repeat(121), description: "", prix: 1, prixPromo: null }, MAX).ok, validerPlat({ nom: "x".repeat(120), description: "", prix: 1, prixPromo: null }, MAX).ok], [false, false, true]);
verifier("nom non texte refusé", validerPlat({ nom: 42, description: "", prix: 1, prixPromo: null }, MAX).ok, false);
verifier("description trop longue refusée", [validerPlat({ nom: "A", description: "d".repeat(501), prix: 1, prixPromo: null }, MAX).ok, validerPlat({ nom: "A", description: "d".repeat(500), prix: 1, prixPromo: null }, MAX).ok], [false, true]);
verifier("prix hors bornes ou non entier refusé", [
  validerPlat({ nom: "A", description: "", prix: -1, prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: MAX + 1, prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: 1000.5, prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: "1000", prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: Number.NaN, prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: MAX, prixPromo: null }, MAX).ok,
  validerPlat({ nom: "A", description: "", prix: 0, prixPromo: null }, MAX).ok,
], [false, false, false, false, false, true, true]);
verifier("message de prix avec le plafond lisible", (validerPlat({ nom: "A", description: "", prix: -1, prixPromo: null }, MAX) as { erreur: string }).erreur.includes("entre 0 et"), true);

verifier("supplément valide", validerOption({ nom: " Piment ", prix: 500 }, MAX), { ok: true, valeurs: { nom: "Piment", prix: 500 } });
verifier("supplément : nom vide, trop long, prix invalide refusés", [
  validerOption({ nom: "", prix: 500 }, MAX).ok,
  validerOption({ nom: "x".repeat(81), prix: 500 }, MAX).ok,
  validerOption({ nom: "x".repeat(80), prix: 500 }, MAX).ok,
  validerOption({ nom: "Piment", prix: -5 }, MAX).ok,
  validerOption({ nom: "Piment", prix: 1.5 }, MAX).ok,
  validerOption({ nom: "Piment", prix: 0 }, MAX).ok,
], [false, false, true, false, false, true]);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nRègles de plat et de supplément vérifiées.");
