import { SEUIL_LENT_MS, SEUIL_TRES_LENT_MS, alertesDepuis, classerLatence, etatGlobal, libelleLatence, type MesuresOperationnelles, type ServiceSupervise } from "../../src/lib/system-admin/supervision-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Latence : un appel qui échoue est une panne, une forte lenteur est dégradée, le reste va bien.
verifier("appel échoué = panne", classerLatence(null), "panne");
verifier("rapide = ok", classerLatence(120), "ok");
verifier("limite basse = ok", classerLatence(SEUIL_TRES_LENT_MS), "ok");
verifier("très lent = dégradé", classerLatence(SEUIL_TRES_LENT_MS + 1), "degrade");
verifier("libellé panne", libelleLatence(null), "ne répond pas");
verifier("libellé normal", libelleLatence(SEUIL_LENT_MS), `répond en ${SEUIL_LENT_MS} ms`);
verifier("libellé lent", libelleLatence(SEUIL_LENT_MS + 1), `lent (${SEUIL_LENT_MS + 1} ms)`);
verifier("libellé très lent", libelleLatence(SEUIL_TRES_LENT_MS + 1), `très lent (${SEUIL_TRES_LENT_MS + 1} ms)`);

// État d'ensemble : le pire gagne ; « inconnu » ne masque pas une panne et ne passe pas pour « ok ».
const service = (etat: ServiceSupervise["etat"]): ServiceSupervise => ({ cle: etat, libelle: etat, etat, detail: "" });
verifier("tout ok", etatGlobal([service("ok"), service("ok")]), "ok");
verifier("un dégradé", etatGlobal([service("ok"), service("degrade")]), "degrade");
verifier("panne l'emporte", etatGlobal([service("degrade"), service("panne"), service("ok")]), "panne");
verifier("inconnu n'est pas ok", etatGlobal([service("ok"), service("inconnu")]), "inconnu");
verifier("inconnu ne masque pas un dégradé", etatGlobal([service("inconnu"), service("degrade")]), "degrade");
verifier("aucun service", etatGlobal([]), "ok");

// Alertes.
const calme: MesuresOperationnelles = {
  commandesSansReponse: 0, delaiCommandeMinutes: 10, versementsEchoues: 0, litigesAHumain: 0,
  fcmConfigure: true, appareilsPush: 3, paiementActif: false, paiementValide: false,
};
verifier("rien à signaler", alertesDepuis(calme), []);
verifier("paiement inactif sans barème : pas d'alerte", alertesDepuis({ ...calme, paiementActif: false, paiementValide: false }).length, 0);
verifier("une commande sans réponse (singulier)", alertesDepuis({ ...calme, commandesSansReponse: 1 })[0]?.libelle, "1 commande attend une réponse depuis plus de 10 minutes.");
verifier("deux commandes (pluriel)", alertesDepuis({ ...calme, commandesSansReponse: 2 })[0]?.libelle, "2 commandes attendent une réponse depuis plus de 10 minutes.");
verifier("versement échoué critique", alertesDepuis({ ...calme, versementsEchoues: 1 }).map((a) => [a.cle, a.gravite]), [["versements_echoues", "critique"]]);
verifier("paiement actif sans barème critique", alertesDepuis({ ...calme, paiementActif: true, paiementValide: false }).map((a) => a.cle), ["paiement_sans_bareme"]);
verifier("paiement actif et validé : rien", alertesDepuis({ ...calme, paiementActif: true, paiementValide: true }), []);
verifier("litige à humain : attention", alertesDepuis({ ...calme, litigesAHumain: 2 }).map((a) => [a.cle, a.gravite]), [["litiges_a_traiter", "attention"]]);
verifier("Firebase absent", alertesDepuis({ ...calme, fcmConfigure: false, appareilsPush: 0 }).map((a) => a.cle), ["notifications_non_configurees"]);
verifier("Firebase sans appareil", alertesDepuis({ ...calme, appareilsPush: 0 }).map((a) => a.cle), ["aucun_appareil"]);
verifier(
  "les urgentes passent avant",
  alertesDepuis({ ...calme, litigesAHumain: 1, fcmConfigure: false, versementsEchoues: 1, commandesSansReponse: 1 }).map((a) => a.cle),
  ["commandes_sans_reponse", "versements_echoues", "litiges_a_traiter", "notifications_non_configurees"],
);

if (ko > 0) {
  console.log(`ECHEC supervision : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK supervision");
