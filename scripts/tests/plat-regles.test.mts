import { validerPlat } from "../../src/lib/system-admin/plat-regles";

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
const ok = (r: ReturnType<typeof validerPlat>) => (r.ok ? r.plat : r.erreur);

verifier("plat valide", ok(validerPlat({ nom: "Poulet braisé", description: "Avec attiéké", prix: "35000", prixPromo: "" }, MAX)), { nom: "Poulet braisé", description: "Avec attiéké", prix: 35000, prixPromo: null });
verifier("prix écrit avec séparateurs de milliers", ok(validerPlat({ nom: "Riz", description: "", prix: "25 000", prixPromo: "20.000" }, MAX)), { nom: "Riz", description: "", prix: 25000, prixPromo: 20000 });
verifier("espace insécable accepté", (() => { const r = validerPlat({ nom: "Riz", description: "", prix: "25 000", prixPromo: "" }, MAX); return r.ok && r.plat.prix; })(), 25000);
verifier("prix zéro accepté (offert)", (() => { const r = validerPlat({ nom: "Eau", description: "", prix: "0", prixPromo: "" }, MAX); return r.ok && r.plat.prix; })(), 0);
verifier("prix promo égal au prix accepté", (() => { const r = validerPlat({ nom: "Riz", description: "", prix: "10000", prixPromo: "10000" }, MAX); return r.ok && r.plat.prixPromo; })(), 10000);

verifier("nom vide refusé", validerPlat({ nom: "  ", description: "", prix: "1000", prixPromo: "" }, MAX).ok, false);
verifier("nom de 121 caractères refusé", validerPlat({ nom: "x".repeat(121), description: "", prix: "1000", prixPromo: "" }, MAX).ok, false);
verifier("description de 501 caractères refusée", validerPlat({ nom: "Riz", description: "x".repeat(501), prix: "1000", prixPromo: "" }, MAX).ok, false);
verifier("prix absent refusé", validerPlat({ nom: "Riz", description: "", prix: "", prixPromo: "" }, MAX).ok, false);
verifier("prix négatif refusé", validerPlat({ nom: "Riz", description: "", prix: "-5", prixPromo: "" }, MAX).ok, false);
verifier("prix décimal refusé : « 1000,50 » ne devient jamais 100 050", validerPlat({ nom: "Riz", description: "", prix: "1000,50", prixPromo: "" }, MAX).ok, false);
verifier("séparateur mal placé refusé", validerPlat({ nom: "Riz", description: "", prix: "25.00", prixPromo: "" }, MAX).ok, false);
verifier("prix avec lettres refusé", validerPlat({ nom: "Riz", description: "", prix: "10k", prixPromo: "" }, MAX).ok, false);
verifier("prix au-dessus du maximum refusé", validerPlat({ nom: "Riz", description: "", prix: "5000001", prixPromo: "" }, MAX).ok, false);
verifier("prix promo supérieur au prix refusé", validerPlat({ nom: "Riz", description: "", prix: "10000", prixPromo: "10001" }, MAX).ok, false);
verifier("prix promo illisible refusé", validerPlat({ nom: "Riz", description: "", prix: "10000", prixPromo: "bientôt" }, MAX).ok, false);
verifier("entrées non textuelles sans plantage", validerPlat({ nom: {}, description: [], prix: null, prixPromo: undefined }, MAX).ok, false);
verifier("espaces multiples du nom ramenés à un", ok(validerPlat({ nom: "Poisson   grillé", description: "", prix: "1000", prixPromo: "" }, MAX)) as unknown, { nom: "Poisson grillé", description: "", prix: 1000, prixPromo: null });

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRègles de saisie des plats vérifiées.");
