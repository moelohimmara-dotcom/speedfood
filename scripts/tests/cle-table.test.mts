// Clé de table du QR (revue du 19 octobre 2026, I-1) : dérivation, vérification, isolation entre restaurants et entre tables.
import { cleTableCorrespond, cleTableDeForme, deriverCleTable } from "../../src/lib/table/cle-calcul";

let echecs = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown): void {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`${ok ? "OK  " : "KO  "}  ${nom}${ok ? "" : ` : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
  if (!ok) echecs += 1;
}

const S = "secret-de-test-1";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const k5 = deriverCleTable(S, A, "5");
verifier("la clé a 16 caractères hexadécimaux", /^[0-9a-f]{16}$/.test(k5), true);
verifier("la clé est stable (même entrée, même sortie)", deriverCleTable(S, A, "5"), k5);
verifier("deux tables du même restaurant ont des clés différentes", deriverCleTable(S, A, "6") !== k5, true);
verifier("le même numéro dans deux restaurants a des clés différentes", deriverCleTable(S, B, "5") !== k5, true);
verifier("un autre secret donne une autre clé", deriverCleTable("autre", A, "5") !== k5, true);
verifier("espaces superflus normalisés", deriverCleTable(S, A, "  5 "), k5);

verifier("la bonne clé est acceptée", cleTableCorrespond(S, A, "5", k5), true);
verifier("la clé d'une autre table est refusée", cleTableCorrespond(S, A, "6", k5), false);
verifier("la clé d'un autre restaurant est refusée", cleTableCorrespond(S, B, "5", k5), false);
verifier("sans clé : refusé", cleTableCorrespond(S, A, "5", null), false);
verifier("clé vide : refusée", cleTableCorrespond(S, A, "5", ""), false);
verifier("clé de mauvaise forme : refusée", cleTableCorrespond(S, A, "5", "ZZZZZZZZZZZZZZZZ"), false);
verifier("sans numéro de table : refusé", cleTableCorrespond(S, A, null, k5), false);
verifier("numéro de table invalide : refusé", cleTableCorrespond(S, A, "!!!", k5), false);
verifier("clé non textuelle : refusée", cleTableCorrespond(S, A, "5", 123), false);
verifier("forme valide", cleTableDeForme(k5), true);
verifier("forme invalide (trop courte)", cleTableDeForme("abc"), false);

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nTout est bon (clé de table).");
