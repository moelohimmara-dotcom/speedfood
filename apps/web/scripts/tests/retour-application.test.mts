import { lienIntention, lienSchema, lireCodeRetour, lireRetour, PAQUET_APPLICATION, SCHEMA_APPLICATION } from "../../src/lib/auth/retour-application";

/**
 * Retour des connexions Google et Facebook faites depuis l'application (27/11/2026). Constat : le navigateur restait sur la page « Retournez dans l'application »
 * parce que Android n'ouvre pas dans l'appli un lien web non vérifié ; la page rend maintenant la main elle-même, avec le code, par `intent://` puis par le schéma.
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
const params = (q: string) => new URLSearchParams(q);

verifier("code valable lu", lireCodeRetour("abc123-_.~XYZ"), "abc123-_.~XYZ");
verifier("code absent, vide, trop long ou avec caractères dangereux refusé", [lireCodeRetour(null), lireCodeRetour(""), lireCodeRetour("a".repeat(513)), lireCodeRetour("a b"), lireCodeRetour("a&b=c"), lireCodeRetour("a#b"), lireCodeRetour("a;end;S.browser_fallback_url=http://evil"), lireCodeRetour("../x")], [null, null, null, null, null, null, null, null]);
verifier("code de 512 caractères accepté", lireCodeRetour("a".repeat(512)) !== null, true);

verifier("intent : paquet et schéma de l'appli de production, code encodé", lienIntention("AB-12"), "intent://auth/application?code=AB-12#Intent;scheme=speedfood;package=com.speedfood.mobile;end");
verifier("le paquet et le schéma sont ceux de la production", [PAQUET_APPLICATION, SCHEMA_APPLICATION], ["com.speedfood.mobile", "speedfood"]);
verifier("schéma : même retour", lienSchema("AB-12"), "speedfood://auth/application?code=AB-12");
verifier("l'intent ne peut pas être détourné par un code piégé (jamais accepté en amont)", lireCodeRetour("x#Intent;package=evil;end"), null);

verifier("retour avec code", lireRetour(params("code=ABC123")), { etat: "code", code: "ABC123" });
verifier("retour refusé par le fournisseur", lireRetour(params("error=access_denied&error_description=refus")), { etat: "refus" });
verifier("erreur prioritaire même avec un code", lireRetour(params("error=access_denied&code=ABC123")), { etat: "refus" });
verifier("page ouverte sans rien : vide", lireRetour(params("")), { etat: "vide" });
verifier("code invalide : vide", lireRetour(params("code=a%20b")), { etat: "vide" });

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
console.log("\nTous les contrôles du retour de connexion passent.");
