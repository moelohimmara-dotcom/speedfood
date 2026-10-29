import { lireIdentiteDocuments, mentionRegime, texteDocumentWhatsApp, titreDocument, tvaIncluse } from "../../src/lib/paiement/documents-regles";
import { libelleMode, lireNumeroTable, versModeCommande } from "../../src/lib/commande/mode";
import { estRobotApercu, lienCourt, lireSourceScan } from "../../src/lib/partage/scans";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC documents : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    documents : ${nom}`);
  }
}

// Titres et mentions
verifier("titre reçu", titreDocument("recu"), "Reçu de paiement");
verifier("titre facture", titreDocument("facture"), "Facture");
verifier("mention non fiscale explicite", mentionRegime("non_fiscal").startsWith("Document non fiscal"), true);
verifier("mention fiscal déclaré ne certifie rien", /ne certifie pas/.test(mentionRegime("fiscal_declare")), true);

// TVA incluse (GNF entiers)
verifier("TVA 18 % incluse dans 118 000", tvaIncluse(118000, 18), 18000);
verifier("TVA 18 % incluse dans 25 000", tvaIncluse(25000, 18), 3814);
verifier("pas de taux : pas de TVA", tvaIncluse(25000, null), null);
verifier("taux 0 : pas de TVA", tvaIncluse(25000, 0), null);

// Identité : non fiscal par défaut, aucun champ obligatoire
const vide = lireIdentiteDocuments({});
verifier("identité vide acceptée en non fiscal", vide.ok && vide.valeur.regime, "non_fiscal");
const fiscalSansNif = lireIdentiteDocuments({ regime: "fiscal_declare" });
verifier("fiscal déclaré sans NIF refusé", fiscalSansNif.ok, false);
const fiscal = lireIdentiteDocuments({ regime: "fiscal_declare", nif: "123 456/A", tva_taux: "18", raison_sociale: "Chez Fatoumata SARL" });
verifier("fiscal déclaré complet accepté", fiscal.ok && [fiscal.valeur.nif, fiscal.valeur.tvaTaux], ["123 456/A", 18]);
const nonFiscalAvecTva = lireIdentiteDocuments({ regime: "non_fiscal", tva_taux: "18", nif: "12345" });
verifier("en non fiscal la TVA n'est pas conservée", nonFiscalAvecTva.ok && nonFiscalAvecTva.valeur.tvaTaux, null);
verifier("NIF avec symbole refusé", lireIdentiteDocuments({ regime: "fiscal_declare", nif: "12;DROP" }).ok, false);
verifier("TVA hors bornes refusée", lireIdentiteDocuments({ regime: "fiscal_declare", nif: "12345", tva_taux: "99" }).ok, false);
verifier("TVA non numérique refusée", lireIdentiteDocuments({ regime: "fiscal_declare", nif: "12345", tva_taux: "dix" }).ok, false);
verifier("nom d'un caractère refusé", lireIdentiteDocuments({ raison_sociale: "A" }).ok, false);
verifier("mention trop longue refusée", lireIdentiteDocuments({ mention: "x".repeat(201) }).ok, false);
verifier("régime inconnu retombe sur non fiscal", lireIdentiteDocuments({ regime: "autre" }).ok && (lireIdentiteDocuments({ regime: "autre" }) as { ok: true; valeur: { regime: string } }).valeur.regime, "non_fiscal");

// Texte WhatsApp
const t = texteDocumentWhatsApp({ type: "facture", numero: "F-2026-0007", restaurant: "Chez Fatoumata", total: 125000, lien: "https://x.test/suivi/a/recu?doc=facture" });
verifier("texte facture", t.includes("F-2026-0007") && t.includes("125 000 GNF") && t.endsWith("?doc=facture"), true);

// Sources de scan
verifier("source connue", lireSourceScan("affiche"), "affiche");
verifier("source inconnue → lien", lireSourceScan("<script>"), "lien");
verifier("source absente → lien", lireSourceScan(null), "lien");
verifier("lien court", lienCourt("https://site.test/", "ab12cd", "qr"), "https://site.test/r/ab12cd?s=qr");
verifier("aperçu WhatsApp non compté", estRobotApercu("WhatsApp/2.23 A"), true);
verifier("robot non compté", estRobotApercu("Googlebot/2.1"), true);
verifier("absence d'agent non comptée", estRobotApercu(null), true);
verifier("navigateur mobile compté", estRobotApercu("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), false);

// Commande à table
verifier("table 7", lireNumeroTable("7"), "7");
verifier("table A12 avec espaces", lireNumeroTable("  A 12 "), "A 12");
verifier("table vide", lireNumeroTable(""), null);
verifier("table trop longue", lireNumeroTable("12345678901"), null);
verifier("table avec balise", lireNumeroTable("<b>1"), null);
verifier("table non texte", lireNumeroTable(7), null);
verifier("libellé à table", libelleMode("sur_place", "7"), "À table, table 7");
verifier("libellé retrait", libelleMode("retrait"), "Retrait sur place");
verifier("mode inconnu retombe sur retrait", versModeCommande("x"), "retrait");
verifier("mode sur_place conservé", versModeCommande("sur_place"), "sur_place");
verifier("lien court avec table", lienCourt("https://s.test", "ab12cd", "table", "A 12"), "https://s.test/r/ab12cd?s=table&t=A%2012");

console.log(`\n${total - ko}/${total} tests documents passés`);
process.exit(ko > 0 ? 1 : 0);
