import { destinationSelonPiste, lireRoleChoisi, roleDepuisSuite, typeDeCompte, verifierPiste } from "../../src/lib/auth/acces";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("piste lue : client, restaurateur ; tout le reste = aucune", [lireRoleChoisi("client"), lireRoleChoisi("restaurateur"), lireRoleChoisi("admin"), lireRoleChoisi(""), lireRoleChoisi(null), lireRoleChoisi(42)], ["client", "restaurateur", null, null, null, null]);

verifier("piste déduite d'une page protégée", ["/restaurant/commandes", "/restaurant", "/system/acces", "/compte/commandes", "/commande", "/suivi", "/restaurants/abc", "/aide", ""].map(roleDepuisSuite), ["restaurateur", "restaurateur", "systeme", "client", null, null, null, null, null]);
verifier("« /restaurants » (catalogue public) n'est PAS la piste restaurateur", roleDepuisSuite("/restaurants"), null);

const t = (roleSysteme: boolean, membreRestaurant: boolean, profilClient: boolean) => typeDeCompte({ roleSysteme, membreRestaurant, profilClient });
verifier("type de compte : restaurateur, système, client, nouveau", [t(false, true, false), t(true, false, false), t(false, false, true), t(false, false, false)], ["restaurateur", "systeme", "client", "nouveau"]);
verifier("un membre de restaurant qui a aussi un rôle système reste restaurateur", t(true, true, false), "restaurateur");

verifier("piste client avec un compte restaurateur : refusé, renvoyé vers la piste restaurateur", verifierPiste("client", "restaurateur"), { ok: false, message: "Ce compte est un compte restaurateur. Choisissez « Je suis restaurateur » pour vous connecter. Pour commander comme client, utilisez une autre adresse e-mail.", versLaBonnePiste: "/connexion?role=restaurateur" });
verifier("piste client avec un compte système : refusé aussi", verifierPiste("client", "systeme").ok, false);
verifier("piste restaurateur avec un compte client : refusé, renvoyé vers la piste client", verifierPiste("restaurateur", "client"), { ok: false, message: "Ce compte est un compte client. Choisissez « Je suis client » pour vous connecter. Pour gérer un restaurant, utilisez une autre adresse e-mail.", versLaBonnePiste: "/connexion?role=client" });
verifier("pistes cohérentes : acceptées", [verifierPiste("client", "client").ok, verifierPiste("restaurateur", "restaurateur").ok, verifierPiste("restaurateur", "systeme").ok], [true, true, true]);
verifier("compte tout neuf : suit la piste choisie, quelle qu'elle soit", [verifierPiste("client", "nouveau").ok, verifierPiste("restaurateur", "nouveau").ok], [true, true]);
verifier("aucune piste choisie (administration, ancien lien) : jamais bloqué", ["restaurateur", "systeme", "client", "nouveau"].map((r) => verifierPiste(null, r as "client").ok), [true, true, true, true]);

verifier("destination après connexion : restaurateur → console, client → son compte, mauvais cas → routage habituel", [
  destinationSelonPiste("restaurateur", "nouveau"),
  destinationSelonPiste("restaurateur", "restaurateur"),
  destinationSelonPiste("client", "nouveau"),
  destinationSelonPiste("client", "client"),
  destinationSelonPiste("client", "restaurateur"),
  destinationSelonPiste(null, "client"),
], ["/restaurant", "/restaurant", "/compte", "/compte", null, null]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nPistes d'entrée vérifiées.");
