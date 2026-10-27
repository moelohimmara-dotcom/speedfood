import {
  DELAI_REPONSE_HEURES,
  MAX_PLATS,
  cheminImageCandidature,
  etatPourCandidat,
  ficheDepuisCandidature,
  platsPourCatalogue,
  purgeDue,
  lireQuartierId,
  platsDepuisLecture,
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

// Lecture d'une photo de menu
const lecture = platsDepuisLecture({
  plats: [{ nom: "Poulet braisé", prix: 40000 }, { nom: "Eau", prix: 50 }, { nom: "Festin", prix: 25_000_000 }, { nom: "Riz", prix: 25000.5 }],
  refuses: [{ brut: "Brochettes", raison: "prix illisible — à saisir à la main" }],
  etat: "plats",
});
verifier("seul le plat dans les bornes est gardé", lecture.plats, [{ nom: "Poulet braisé", prix: 40000 }]);
verifier("les plats hors bornes passent dans les refusés, avec leur raison", lecture.refuses.map((r) => r.brut), ["Brochettes", "Eau (50 GNF)", "Festin (25000000 GNF)", "Riz (25000.5 GNF)"]);
verifier("la raison est dite", lecture.refuses[1].raison.startsWith("prix hors limites"), true);
verifier("état « plats » conservé", lecture.etat, "plats");
verifier("plus aucun plat valable : état indéterminé, jamais « plats »", platsDepuisLecture({ plats: [{ nom: "Festin", prix: 99_999_999 }], refuses: [], etat: "plats" }).etat, "indetermine");
verifier("une carte vide reste vide", platsDepuisLecture({ plats: [], refuses: [], etat: "vide" }).etat, "vide");
const beaucoup = platsDepuisLecture({ plats: Array.from({ length: MAX_PLATS + 3 }, (_, i) => ({ nom: `Plat ${i}`, prix: 5000 })), refuses: [], etat: "plats" });
verifier("au plus 80 plats gardés", beaucoup.plats.length, MAX_PLATS);
verifier("les 3 en trop sont signalés", beaucoup.refuses.length, 3);

// Fiche et plats d'un établissement créé depuis une candidature
verifier("fiche : livraison propre et sur place", ficheDepuisCandidature({ horaires: " Tous les jours 9h-22h ", moyens_paiement: ["especes", "orange_money", "especes", "bitcoin"], services: ["livraison", "sur_place", "drone"] }), { horaires: "Tous les jours 9h-22h", moyens_paiement: ["especes", "orange_money"], accepte_sur_place: true, livraison_mode: "propre" });
verifier("fiche : retrait seul = aucune livraison", ficheDepuisCandidature({ horaires: "9h-22h", moyens_paiement: [], services: ["retrait"] }).livraison_mode, "aucune");
verifier("fiche : données illisibles ne cassent rien", ficheDepuisCandidature({ horaires: null, moyens_paiement: "x", services: undefined }), { horaires: "", moyens_paiement: [], accepte_sur_place: false, livraison_mode: "aucune" });
verifier("plats du catalogue revalidés", platsPourCatalogue([{ nom: "Riz", prix: 25000 }]), [{ nom: "Riz", prix: 25000 }]);
verifier("un brouillon corrompu donne un catalogue vide, pas une erreur", platsPourCatalogue([{ nom: "Riz", prix: -5 }]), []);
verifier("brouillon absent", platsPourCatalogue(null), []);

// Conservation des images d'une candidature refusée : 30 jours
const maintenantPurge = Date.parse("2026-11-30T12:00:00Z");
verifier("refus il y a 30 jours pile : à effacer", purgeDue("2026-10-31T12:00:00Z", maintenantPurge), true);
verifier("refus il y a 29 jours : on garde", purgeDue("2026-11-01T12:00:00Z", maintenantPurge), false);
verifier("jamais traitée : on garde", purgeDue(null, maintenantPurge), false);
verifier("date illisible : on garde (jamais d'effacement sur une donnée douteuse)", purgeDue("hier", maintenantPurge), false);

if (ko > 0) {
  console.log(`ECHEC candidature : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK candidature");
