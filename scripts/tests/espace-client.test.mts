import { LIBELLES_MODE_PREFERE, MODES_PREFERES, formaterDateCommande, formaterMontantClient, libellePaiementClient, libelleStatutCommandeClient, lireModePrefere, validerAdresseClient } from "../../src/lib/client/espace";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("statuts en cours : attente, acceptée, prête", ["en_attente", "acceptee", "prete"].map((s) => libelleStatutCommandeClient(s, "retrait").enCours), [true, true, true]);
verifier("statuts terminés : terminée, refusée, annulée", ["terminee", "refusee", "annulee"].map((s) => libelleStatutCommandeClient(s, "retrait").enCours), [false, false, false]);
verifier("terminée : « Livrée », « Servie » ou « Remise » selon le mode", ["livraison", "sur_place", "retrait"].map((m) => libelleStatutCommandeClient("terminee", m).libelle), ["Livrée", "Servie", "Remise"]);
verifier("prête en livraison : le client sait qu'elle part", libelleStatutCommandeClient("prete", "livraison").libelle, "Prête, en cours de livraison");
verifier("refusée et annulée : ton d'alerte ; acceptée : ton positif", [libelleStatutCommandeClient("refusee", "retrait").ton, libelleStatutCommandeClient("annulee", "retrait").ton, libelleStatutCommandeClient("acceptee", "retrait").ton], ["danger", "danger", "succes"]);
verifier("statut inconnu : neutre, jamais d'exception", libelleStatutCommandeClient("n_importe_quoi", "retrait"), { libelle: "Statut inconnu", ton: "neutre", enCours: false });

verifier("paiement : en ligne, classique, déclaré, espèces, contesté, rien", [
  libellePaiementClient("recu", "speedfood"),
  libellePaiementClient("recu", "orange_money"),
  libellePaiementClient("declare", "mtn_momo"),
  libellePaiementClient("especes", "especes"),
  libellePaiementClient("non_recu", "orange_money"),
  libellePaiementClient("non_demande", null),
], ["Payée en ligne", "Payée", "Paiement déclaré, en attente de confirmation du restaurant", "À régler en espèces", "Paiement non retrouvé par le restaurant", null]);

verifier("date : jour, mois abrégé, année, heure de Conakry", formaterDateCommande("2026-10-21T14:05:00Z"), "21 oct. 2026 à 14:05");
verifier("date : début d'année et minuit", formaterDateCommande("2027-01-01T00:07:00Z"), "1 janv. 2027 à 00:07");
verifier("date illisible : texte vide, pas d'exception", formaterDateCommande("pas une date"), "");
verifier("montant : milliers séparés, GNF, jamais négatif", [formaterMontantClient(25000), formaterMontantClient(1500), formaterMontantClient(999), formaterMontantClient(-5)], ["25 000 GNF", "1 500 GNF", "999 GNF", "0 GNF"]);

verifier("adresse valide : espaces nettoyés", validerAdresseClient("  Maison  ", " Kaloum,   près du marché "), { ok: true, libelle: "Maison", adresse: "Kaloum, près du marché" });
verifier("adresse : nom trop court ou trop long, adresse trop courte ou trop longue refusés", [
  validerAdresseClient("X", "Kaloum, près du marché").ok,
  validerAdresseClient("N".repeat(31), "Kaloum, près du marché").ok,
  validerAdresseClient("Maison", "abc").ok,
  validerAdresseClient("Maison", "a".repeat(301)).ok,
], [false, false, false, false]);
verifier("adresse : les messages d'erreur disent quoi faire", [validerAdresseClient("X", "Kaloum, près du marché"), validerAdresseClient("Maison", "abc")].map((r) => (r.ok ? "" : r.erreur.includes("Donnez") || r.erreur.includes("Décrivez"))), [true, true]);
verifier("mode préféré : trois modes, vide = aucune préférence, inconnu refusé", [lireModePrefere("livraison"), lireModePrefere(""), lireModePrefere(null), lireModePrefere("drone"), lireModePrefere(42)], ["livraison", null, null, undefined, undefined]);
verifier("chaque mode préféré a son libellé", MODES_PREFERES.map((m) => typeof LIBELLES_MODE_PREFERE[m]), ["string", "string", "string"]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nEspace client vérifié.");
