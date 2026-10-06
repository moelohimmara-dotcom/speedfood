import { analyserTexteRiche, segmenter, MAX_BLOCS, MAX_CARACTERES } from "../../src/lib/cms/texte-riche";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("entrée vide", analyserTexteRiche(""), []);
verifier("espaces seuls", analyserTexteRiche("  \n \n"), []);
verifier("titre et sous-titre", analyserTexteRiche("# Un\n## Deux"), [
  { type: "titre", niveau: 1, segments: [{ type: "texte", valeur: "Un" }] },
  { type: "titre", niveau: 2, segments: [{ type: "texte", valeur: "Deux" }] },
]);
verifier("### n'est pas un titre", analyserTexteRiche("### Trois")[0].type, "paragraphe");
verifier("deux paragraphes", analyserTexteRiche("a\nb\n\nc").map((b) => b.type), ["paragraphe", "paragraphe"]);
verifier("saut de ligne dans un paragraphe", analyserTexteRiche("a\nb")[0], {
  type: "paragraphe",
  segments: [{ type: "texte", valeur: "a" }, { type: "saut" }, { type: "texte", valeur: "b" }],
});
verifier("liste", analyserTexteRiche("- x\n- y\n\nfin"), [
  { type: "liste", elements: [[{ type: "texte", valeur: "x" }], [{ type: "texte", valeur: "y" }]] },
  { type: "paragraphe", segments: [{ type: "texte", valeur: "fin" }] },
]);
verifier("gras", segmenter("un **fort** mot"), [
  { type: "texte", valeur: "un " },
  { type: "gras", valeur: "fort" },
  { type: "texte", valeur: " mot" },
]);
verifier("lien interne", segmenter("[a](/p/aide)"), [{ type: "lien", libelle: "a", href: "/p/aide" }]);
verifier("lien https", segmenter("[a](https://ok.test/x)"), [{ type: "lien", libelle: "a", href: "https://ok.test/x" }]);
for (const mauvais of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "http://pas-liste.test", "JaVaScRiPt:alert(1)"]) {
  verifier(`lien refusé ${mauvais}`, segmenter(`[clic](${mauvais})`), [{ type: "texte", valeur: "clic" }]);
}
verifier("charge script rendue en texte", analyserTexteRiche("<script>alert(1)</script>"), [
  { type: "paragraphe", segments: [{ type: "texte", valeur: "<script>alert(1)</script>" }] },
]);
verifier("charge dans un lien refusé", segmenter("[<img src=x onerror=alert(1)>](javascript:x)"), [
  { type: "texte", valeur: "<img src=x onerror=alert(1)>" },
]);
const beaucoup = Array.from({ length: 500 }, (_, i) => `ligne ${i}`).join("\n\n");
verifier("maximum de blocs", analyserTexteRiche(beaucoup).length, MAX_BLOCS);
const long = "a".repeat(MAX_CARACTERES + 5000);
const bloc = analyserTexteRiche(long)[0];
verifier("maximum de caractères lus", bloc.type === "paragraphe" && bloc.segments[0].type === "texte" && bloc.segments[0].valeur.length, MAX_CARACTERES);
verifier("entrée non textuelle", analyserTexteRiche(undefined as unknown as string), []);

// Entrées hostiles : coût borné (aucune explosion quadratique).
for (const [nom, entree] of [["crochets", "[".repeat(20000)], ["lien ouvert", "[a](".repeat(5000)], ["gras ouvert", "**a*".repeat(5000)], ["parenthèses", "(".repeat(20000)], ["crochets+parenthèses", "[a](".repeat(4000) + "(".repeat(10000)]] as const) {
  const debut = performance.now();
  segmenter(entree);
  analyserTexteRiche(entree);
  const ms = performance.now() - debut;
  verifier(`entrée hostile ${nom} sous 250 ms (${Math.round(ms)} ms)`, ms < 250, true);
}
console.log(ko === 0 ? "\nTous les tests texte riche passent." : `\n${ko} echec(s).`);
process.exit(ko === 0 ? 0 : 1);
