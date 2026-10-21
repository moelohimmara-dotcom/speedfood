import { LIBELLES_STATUTS_REFERENCEMENT, STATUTS_REFERENCEMENT, lireStatutReferencement, lireTypeEtablissement, validerDemandeReferencement } from "../../src/lib/site/referencement";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const base = { type: "restaurant", organisation: "Chez Awa", commune: "Kaloum", quartier: "Almamya", indications: "Face à la pharmacie", latitude: "9.5092", longitude: "-13.7122", categories: "Grillades", specialites: "Poulet braisé", prenom: "Awa", nom: "Diallo", email: "Awa@Exemple.org", telephone: "622 00 00 00" };

verifier("types lus : restaurant et épicerie seulement", [lireTypeEtablissement("restaurant"), lireTypeEtablissement("epicerie"), lireTypeEtablissement("pharmacie"), lireTypeEtablissement(null)], ["restaurant", "epicerie", null, null]);
verifier("statuts : un libellé par statut", STATUTS_REFERENCEMENT.every((s) => typeof LIBELLES_STATUTS_REFERENCEMENT[s] === "string"), true);
verifier("statut lu : valeurs connues seulement", [lireStatutReferencement("accord"), lireStatutReferencement("supprimee")], ["accord", null]);

const bon = validerDemandeReferencement(base);
verifier("demande valide : e-mail en minuscules, téléphone normalisé, GPS lu", bon.ok && [bon.demande.email, bon.demande.telephone, bon.demande.latitude, bon.demande.longitude], ["awa@exemple.org", "+224622000000", 9.5092, -13.7122]);
verifier("GPS facultatif", (() => { const r = validerDemandeReferencement({ ...base, latitude: "", longitude: "" }); return r.ok && [r.demande.latitude, r.demande.longitude]; })(), [null, null]);
verifier("virgule décimale acceptée", (() => { const r = validerDemandeReferencement({ ...base, latitude: "9,5092", longitude: "-13,7122" }); return r.ok && r.demande.latitude; })(), 9.5092);
verifier("champs facultatifs vides = null", (() => { const r = validerDemandeReferencement({ ...base, indications: " ", categories: "", specialites: "" }); return r.ok && [r.demande.indications, r.demande.categories, r.demande.specialites]; })(), [null, null, null]);

verifier("type inconnu refusé", validerDemandeReferencement({ ...base, type: "garage" }).ok, false);
verifier("nom d'établissement trop court refusé", validerDemandeReferencement({ ...base, organisation: "A" }).ok, false);
verifier("commune manquante refusée", validerDemandeReferencement({ ...base, commune: "" }).ok, false);
verifier("quartier manquant refusé", validerDemandeReferencement({ ...base, quartier: "" }).ok, false);
verifier("GPS à moitié rempli refusé", validerDemandeReferencement({ ...base, longitude: "" }).ok, false);
verifier("GPS non numérique refusé", validerDemandeReferencement({ ...base, latitude: "neuf" }).ok, false);
verifier("GPS hors de Guinée refusé (signe oublié)", validerDemandeReferencement({ ...base, longitude: "13.7122" }).ok, false);
verifier("GPS inversé refusé", validerDemandeReferencement({ ...base, latitude: "-13.7122", longitude: "9.5092" }).ok, false);
verifier("e-mail invalide refusé", validerDemandeReferencement({ ...base, email: "awa" }).ok, false);
verifier("un numéro n'est pas accepté comme e-mail", validerDemandeReferencement({ ...base, email: "622000000" }).ok, false);
verifier("téléphone invalide refusé", validerDemandeReferencement({ ...base, telephone: "12345" }).ok, false);
verifier("responsable sans prénom refusé", validerDemandeReferencement({ ...base, prenom: " " }).ok, false);
verifier("entrées non textuelles sans plantage", validerDemandeReferencement({ ...base, organisation: {}, commune: [], quartier: null, latitude: {}, email: 3 }).ok, false);
verifier("caractères de contrôle nettoyés", (() => { const r = validerDemandeReferencement({ ...base, organisation: "Chez\u0000  Awa\u0007" }); return r.ok && r.demande.organisation; })(), "Chez Awa");

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nDemandes de référencement vérifiées.");
