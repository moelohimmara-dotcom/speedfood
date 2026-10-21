import { TAILLE_CORPS_MAX_OCTETS, corpsTropGros, lireBearer, statutHttp } from "../../src/lib/api/v1-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.c2lnbmF0dXJlLWRlLXRlc3Q";
verifier("jeton porteur bien formé accepté", lireBearer(`Bearer ${jwt}`), jwt);
verifier("espaces autour tolérés", lireBearer(`  Bearer ${jwt}  `), jwt);
verifier("en-tête absent", [lireBearer(null), lireBearer(undefined), lireBearer("")], [null, null, null]);
verifier("autre schéma refusé (Basic, jeton nu, minuscules)", [lireBearer(`Basic ${jwt}`), lireBearer(jwt), lireBearer(`bearer ${jwt}`)], [null, null, null]);
verifier("jeton qui n'a pas la forme d'un JWT refusé", [lireBearer("Bearer abc"), lireBearer("Bearer aaaaaaaa.bbbbbbbb"), lireBearer("Bearer a b c")], [null, null, null]);
verifier("caractères interdits refusés (injection d'en-tête)", [lireBearer(`Bearer ${jwt}\r\nX-Evil: 1`), lireBearer(`Bearer ${jwt};`), lireBearer(`Bearer ${jwt}'`)], [null, null, null]);
verifier("jeton démesuré refusé", lireBearer(`Bearer ${"a".repeat(9000)}.${"b".repeat(9)}.${"c".repeat(9)}`), null);

verifier("codes HTTP du contrat d'erreur", [
  statutHttp("NON_AUTHENTIFIE"),
  statutHttp("NON_AUTORISE"),
  statutHttp("VALIDATION"),
  statutHttp("INTROUVABLE"),
  statutHttp("CONFLIT_ETAT"),
  statutHttp("TROP_DE_REQUETES"),
  statutHttp("ERREUR_SERVEUR"),
], [401, 403, 400, 404, 409, 429, 500]);

verifier("taille de corps : sous la limite acceptée, au-dessus refusée", [corpsTropGros(String(TAILLE_CORPS_MAX_OCTETS)), corpsTropGros(String(TAILLE_CORPS_MAX_OCTETS + 1)), corpsTropGros(null), corpsTropGros("abc")], [false, true, false, false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRègles de l'API native vérifiées.");
