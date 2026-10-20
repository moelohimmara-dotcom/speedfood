import { CONTENU_NOTIFICATION_PAR_DEFAUT, TYPES_NOTIFICATION_CLIENT, contenuNotificationClient, typeDepuisStatutCommande } from "../../src/lib/client/notifications-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("statuts notifiés : acceptée, prête, refusée, annulée, terminée ; pas « en attente »", ["en_attente", "acceptee", "prete", "refusee", "annulee", "terminee", "n_importe_quoi"].map(typeDepuisStatutCommande), [null, "acceptee", "prete", "refusee", "annulee", "terminee", null]);

for (const type of TYPES_NOTIFICATION_CLIENT) {
  const c = contenuNotificationClient(type, "Chez Fanta", "retrait");
  verifier(`${type} : titre, corps, page interne, étiquette`, [c.titre.length > 3, c.corps.includes("Chez Fanta") || type === "terminee" || type === "annulee", c.url.startsWith("/") && !c.url.startsWith("//"), c.tag], [true, true, true, "speedfood-suivi"]);
}
verifier("la page ouverte au clic est toujours interne (jamais une adresse extérieure)", TYPES_NOTIFICATION_CLIENT.every((t) => contenuNotificationClient(t, "X", "livraison").url === "/compte/commandes"), true);
verifier("prête : la livraison est mentionnée seulement en livraison", [contenuNotificationClient("prete", "Chez Fanta", "livraison").corps.includes("livraison"), contenuNotificationClient("prete", "Chez Fanta", "retrait").corps.includes("livraison")], [true, false]);
verifier("terminée : « livrée » en livraison, « terminée » sinon", [contenuNotificationClient("terminee", "R", "livraison").titre, contenuNotificationClient("terminee", "R", "sur_place").titre], ["Commande livrée", "Commande terminée"]);
verifier("refusée : rappelle qu'aucun montant n'a été encaissé par Speedfood", contenuNotificationClient("refusee", "R", "retrait").corps.includes("Aucun montant"), true);
verifier("aucune notification ne contient de chiffre (ni montant, ni numéro, ni adresse)", TYPES_NOTIFICATION_CLIENT.every((t) => !/\d/.test(contenuNotificationClient(t, "Chez Fanta", "livraison").corps)), true);
verifier("nom de restaurant vide ou démesuré : repli propre, longueur bornée", [contenuNotificationClient("acceptee", "   ", "retrait").corps, contenuNotificationClient("acceptee", "A".repeat(200), "retrait").corps.length <= 60 + 40], ["Le restaurant prépare votre commande.", true]);
verifier("texte de repli : interne et sans donnée", [CONTENU_NOTIFICATION_PAR_DEFAUT.url, /\d/.test(CONTENU_NOTIFICATION_PAR_DEFAUT.corps)], ["/compte/commandes", false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nNotifications du client vérifiées.");
