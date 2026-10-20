import { LIBELLES_FORMES, LIBELLES_STATUTS, FORMES_PARTENARIAT, lireForme, lireStatut, validerDemandePartenariat } from "../../src/lib/site/partenariat";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const base = { forme: "investir", organisation: "Fonds Kaloum", nomContact: "Aïssatou Diallo", contact: "aissatou@exemple.org", message: "Nous souhaitons financer l'équipement de dix restaurants de quartier." };

verifier("formes et libellés alignés", FORMES_PARTENARIAT.every((f) => typeof LIBELLES_FORMES[f] === "string"), true);
verifier("forme lue : valeurs connues seulement", [lireForme("investir"), lireForme("restaurant"), lireForme(""), lireForme(null)], ["investir", null, null, null]);
verifier("statut lu : valeurs connues seulement", [lireStatut("traitee"), lireStatut("supprimee"), lireStatut(undefined)], ["traitee", null, null]);
verifier("statuts : quatre libellés", Object.keys(LIBELLES_STATUTS).length, 4);

const bon = validerDemandePartenariat(base);
verifier("demande valide (e-mail)", bon.ok && [bon.demande.forme, bon.demande.contactType, bon.demande.contact], ["investir", "email", "aissatou@exemple.org"]);
const tel = validerDemandePartenariat({ ...base, contact: "622 00 00 00" });
verifier("demande valide (téléphone guinéen)", tel.ok && tel.demande.contactType, "telephone");
verifier("l'e-mail est mis en minuscules", (() => { const r = validerDemandePartenariat({ ...base, contact: "Aissatou@Exemple.ORG" }); return r.ok && r.demande.contact; })(), "aissatou@exemple.org");

verifier("forme absente refusée", validerDemandePartenariat({ ...base, forme: "restaurant" }).ok, false);
verifier("organisation trop courte refusée", validerDemandePartenariat({ ...base, organisation: "A" }).ok, false);
verifier("nom du contact trop court refusé", validerDemandePartenariat({ ...base, nomContact: " " }).ok, false);
verifier("contact invalide refusé", validerDemandePartenariat({ ...base, contact: "pas un contact" }).ok, false);
verifier("message trop court refusé", validerDemandePartenariat({ ...base, message: "Bonjour" }).ok, false);

const long = validerDemandePartenariat({ ...base, message: "x".repeat(5000) });
verifier("message borné à 1500 caractères", long.ok && long.demande.message.length, 1500);
const sale = validerDemandePartenariat({ ...base, organisation: "  Fonds\u0000   Kaloum \u0007 " });
verifier("caractères de contrôle et espaces multiples nettoyés", sale.ok && sale.demande.organisation, "Fonds Kaloum");
verifier("entrées non textuelles sans plantage", validerDemandePartenariat({ forme: "investir", organisation: {}, nomContact: [], contact: 42, message: null }).ok, false);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nDemandes de partenariat vérifiées.");
