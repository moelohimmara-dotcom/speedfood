import {
  DELAI_REPONSE_HEURES,
  MAX_PLATS,
  cheminImageCandidature,
  etatPourCandidat,
  lireQuartierId,
  reponseAttendueLe,
  validerCandidature,
  validerPlats,
} from "../../src/lib/referencement/candidature";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const ctx = { commune: "Ratoma", quartier: "Kipé", email: "awa@exemple.test" };
const corps = {
  nom: "Chez Awa",
  quartierId: "11111111-2222-4333-8444-555555555555",
  indications: "Face à la pharmacie, route du Niger",
  categories: "Grillades",
  horaires: "Tous les jours, 9h à 22h",
  moyensPaiement: ["especes", "orange_money"],
  services: ["livraison", "retrait"],
  responsable: { prenom: "Awa", nom: "Camara" },
  telephone: "622 12 34 56",
  plats: [{ nom: "Poulet braisé", prix: 40000 }, { nom: "Riz sauce feuille", prix: 25000 }],
};
const erreur = (c: unknown) => {
  const r = validerCandidature(c, ctx);
  return r.ok ? null : r.erreur;
};

const ok = validerCandidature(corps, ctx);
verifier("candidature valide", ok.ok, true);
if (ok.ok) {
  verifier("organisation, commune et quartier du serveur", [ok.candidature.demande.organisation, ok.candidature.demande.commune, ok.candidature.demande.quartier], ["Chez Awa", "Ratoma", "Kipé"]);
  verifier("e-mail du compte, jamais celui du corps", ok.candidature.demande.email, "awa@exemple.test");
  verifier("moyens, services, plats conservés", [ok.candidature.moyensPaiement, ok.candidature.services, ok.candidature.plats.length], [["especes", "orange_money"], ["livraison", "retrait"], 2]);
}
verifier("un e-mail dans le corps est ignoré", validerCandidature({ ...corps, email: "pirate@exemple.test", commune: "Ailleurs" }, ctx).ok && (validerCandidature({ ...corps, email: "pirate@exemple.test", commune: "Ailleurs" }, ctx) as { candidature: { demande: { email: string; commune: string } } }).candidature.demande.email === "awa@exemple.test", true);
verifier("nom manquant", erreur({ ...corps, nom: "" })?.startsWith("Indiquez le nom de votre établissement"), true);
verifier("responsable manquant", erreur({ ...corps, responsable: {} })?.includes("prénom"), true);
verifier("téléphone invalide", erreur({ ...corps, telephone: "123" })?.startsWith("Ce numéro ne semble pas valide"), true);
verifier("horaires manquants", erreur({ ...corps, horaires: "" })?.startsWith("Indiquez vos horaires"), true);
verifier("aucun service", erreur({ ...corps, services: [] })?.startsWith("Indiquez au moins un service"), true);
verifier("service inconnu", erreur({ ...corps, services: ["drone"] }), "Services invalides.");
verifier("moyen inconnu", erreur({ ...corps, moyensPaiement: ["cheque"] }), "Moyens de paiement invalides.");
verifier("moyens absents = aucun", validerCandidature({ ...corps, moyensPaiement: undefined }, ctx).ok, true);

// Menu
verifier("menu absent = vide", validerPlats(undefined), []);
verifier("prix décimal refusé", validerPlats([{ nom: "Plat", prix: 100.5 }]), null);
verifier("prix en texte refusé", validerPlats([{ nom: "Plat", prix: "2500" }]), null);
verifier("prix trop bas", validerPlats([{ nom: "Plat", prix: 10 }]), null);
verifier("prix trop haut (zéros en trop)", validerPlats([{ nom: "Plat", prix: 25_000_000 }]), null);
verifier("nom trop court", validerPlats([{ nom: "A", prix: 5000 }]), null);
verifier("trop de plats", validerPlats(Array.from({ length: MAX_PLATS + 1 }, () => ({ nom: "Plat", prix: 5000 }))), null);
verifier("80 plats acceptés", validerPlats(Array.from({ length: MAX_PLATS }, () => ({ nom: "Plat", prix: 5000 })))?.length, MAX_PLATS);
verifier("menu qui n'est pas une liste", validerPlats({ nom: "Plat" }), null);
verifier("caractères de contrôle retirés du nom", validerPlats([{ nom: "Riz\u0000 gras", prix: 5000 }]), [{ nom: "Riz gras", prix: 5000 }]);

// Quartier
verifier("quartier valide", lireQuartierId(corps), "11111111-2222-4333-8444-555555555555");
verifier("quartier non UUID", lireQuartierId({ quartierId: "../../etc" }), null);
verifier("quartier absent", lireQuartierId({}), null);
verifier("corps absent", lireQuartierId(null), null);

// Suivi
verifier("délai annoncé", DELAI_REPONSE_HEURES, 48);
verifier("nouvelle = reçue", etatPourCandidat("nouvelle"), "recue");
verifier("rappelée = en cours", etatPourCandidat("rappelee"), "en_cours");
verifier("visite prévue = en cours", etatPourCandidat("visite_prevue"), "en_cours");
verifier("accord = acceptée", etatPourCandidat("accord"), "acceptee");
verifier("créée", etatPourCandidat("creee"), "creee");
verifier("refusée", etatPourCandidat("refusee"), "refusee");
verifier("statut inconnu = reçue (jamais un faux « accepté »)", etatPourCandidat("n'importe quoi"), "recue");
verifier("réponse attendue 48 h plus tard", reponseAttendueLe("2026-10-26T10:00:00.000Z"), "2026-10-28T10:00:00.000Z");
verifier("date illisible", reponseAttendueLe("hier"), null);
verifier("chemin d'image sous le compte", cheminImageCandidature("u1", "logo", "png", "abc"), "u1/logo-abc.png");

if (ko > 0) {
  console.log(`ECHEC candidature : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK candidature");
