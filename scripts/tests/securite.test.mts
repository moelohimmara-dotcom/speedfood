import { estCheminInterneSur, estLienBanniereSur } from "../../src/lib/auth/redirection";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const antislash = String.fromCharCode(92);

for (const [valeur, attendu] of [
  ["/restaurants", true],
  ["//evil.com", false],
  ["/" + antislash + "evil", false],
  ["javascript:alert(1)", false],
  ["", false],
] as const) {
  verifier(`chemin interne ${JSON.stringify(valeur)}`, estCheminInterneSur(valeur), attendu);
}

for (const [valeur, attendu] of [
  ["/restaurants", true],
  ["https://exemple.com/page?a=1", true],
  ["javascript:alert(1)", false],
  ["JaVaScRiPt:alert(1)", false],
  ["data:text/html,<script>1</script>", false],
  ["http://exemple.com", false],
  ["//evil.com", false],
  ["https://", false],
  ["https://exemple.com/a b", false],
  ["https://exemple.com/" + antislash + "x", false],
  ["https://" + "a".repeat(600), false],
] as const) {
  verifier(`lien banniere ${JSON.stringify(valeur.slice(0, 40))}`, estLienBanniereSur(valeur), attendu);
}

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
