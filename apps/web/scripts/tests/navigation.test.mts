import { entreeActive } from "../../src/lib/system-admin/navigation";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const commandes = ["/system/commandes", "/system/livraisons", "/system/livraisons/livreurs"];

verifier("la sous-page la plus précise gagne (Livreurs, pas Livraisons)", entreeActive("/system/livraisons/livreurs", commandes), "/system/livraisons/livreurs");
verifier("la page parente reste active sur sa propre adresse", entreeActive("/system/livraisons", commandes), "/system/livraisons");
verifier("une page enfant d'une entrée sans sous-entrée active l'entrée", entreeActive("/system/livraisons/abc-123", commandes), "/system/livraisons");
verifier("une page enfant de la sous-entrée active la sous-entrée", entreeActive("/system/livraisons/livreurs/x", commandes), "/system/livraisons/livreurs");
verifier("autre famille", entreeActive("/system/commandes/42", commandes), "/system/commandes");
verifier("aucune correspondance", entreeActive("/system/audit", commandes), null);
verifier("un préfixe de texte n'est pas un préfixe de chemin (livraisons-test ≠ livraisons)", entreeActive("/system/livraisons-test", commandes), null);
verifier("liste vide", entreeActive("/system", []), null);
verifier("l'ordre de la liste ne change rien", entreeActive("/system/livraisons/livreurs", [...commandes].reverse()), "/system/livraisons/livreurs");
verifier("deux niveaux d'écart (catalogue)", entreeActive("/system/catalogue/restaurants/abc", ["/system/catalogue/restaurants", "/system/catalogue"]), "/system/catalogue/restaurants");

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
