import {
  chiffresWhatsApp,
  libelleStatutPaiement,
  lienWhatsAppVers,
  lireCodeMarchand,
  lireReferencePaiement,
  optionsPaiement,
  paiementOuvert,
  peutDeclarer,
  texteRecuWhatsApp,
} from "../../src/lib/paiement/regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC paiement : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    paiement : ${nom}`);
  }
}

// Codes marchands
verifier("code vide = absent", lireCodeMarchand("   "), null);
verifier("code numérique accepté", lireCodeMarchand("123456"), "123456");
verifier("espaces retirés", lireCodeMarchand("12 34 56"), "123456");
verifier("code alphanumérique accepté (MTN)", lireCodeMarchand("MTN8842"), "MTN8842");
verifier("code trop court refusé", lireCodeMarchand("12"), "invalide");
verifier("symboles refusés (injection)", lireCodeMarchand("123;DROP"), "invalide");
verifier("trop long refusé", lireCodeMarchand("1".repeat(21)), "invalide");

// Référence de transaction
verifier("référence vide acceptée", lireReferencePaiement(""), { ok: true, valeur: null });
verifier("référence classique", lireReferencePaiement("PP260105.1234.A56789"), { ok: true, valeur: "PP260105.1234.A56789" });
verifier("référence trop courte refusée", lireReferencePaiement("ab"), { ok: false });
verifier("balise refusée", lireReferencePaiement("<script>alert(1)</script>"), { ok: false });
verifier("espaces multiples ramenés à un", lireReferencePaiement("PP  1234  AB"), { ok: true, valeur: "PP 1234 AB" });

// Options proposées au client
const codes = { orange: "123456", mtn: null };
verifier("Orange déclaré avec code : proposé ; MTN sans code : non", optionsPaiement(["orange_money", "mtn_momo", "especes"], codes).map((o) => o.mode), ["orange_money", "especes"]);
verifier("le code est transmis", optionsPaiement(["orange_money"], codes)[0].code, "123456");
verifier("Orange déclaré mais sans code : non proposé", optionsPaiement(["orange_money"], { orange: null, mtn: null }).map((o) => o.mode), ["especes"].filter(() => false));
verifier("rien de déclaré : espèces par défaut", optionsPaiement([], { orange: null, mtn: null }).map((o) => o.mode), ["especes"]);
verifier("code renseigné mais mode non déclaré : non proposé", optionsPaiement(["especes"], codes).map((o) => o.mode), ["especes"]);

// Ouverture du paiement : seulement après acceptation
verifier("en attente : pas de paiement", paiementOuvert("en_attente", false), false);
verifier("acceptée : paiement ouvert", paiementOuvert("acceptee", false), true);
verifier("prête : paiement ouvert", paiementOuvert("prete", false), true);
verifier("refusée : pas de paiement", paiementOuvert("refusee", false), false);
verifier("annulée : pas de paiement", paiementOuvert("annulee", false), false);
verifier("proposition de prix en cours : pas de paiement", paiementOuvert("acceptee", true), false);
verifier("déclaration possible tant que non confirmé", [peutDeclarer("declare"), peutDeclarer("non_recu"), peutDeclarer("recu")], [true, true, false]);

// Textes
verifier("libellé espèces encaissées", libelleStatutPaiement("recu", "especes"), "Espèces encaissées");
verifier("libellé déclaré", libelleStatutPaiement("declare", "orange_money"), "Paiement déclaré, en attente de confirmation du restaurant");

// WhatsApp
verifier("chiffres d'un numéro guinéen", chiffresWhatsApp("+224 622 00 00 00"), "224622000000");
verifier("numéro trop court refusé", chiffresWhatsApp("123"), null);
const lien = lienWhatsAppVers("+224622000000", "Bonjour & merci");
verifier("lien wa.me avec texte encodé", lien, "https://wa.me/224622000000?text=Bonjour%20%26%20merci");
const texte = texteRecuWhatsApp({ restaurant: "Chez Fatoumata", reference: "SF-AB12", total: 25000, statut: "recu", lien: "https://exemple.test/suivi/x/recu" });
verifier("texte du reçu confirmé", texte.includes("Paiement confirmé.") && texte.includes("SF-AB12") && texte.endsWith("https://exemple.test/suivi/x/recu"), true);
verifier("texte du reçu non confirmé ne dit pas « payé »", /pay|confirmé\./i.test(texteRecuWhatsApp({ restaurant: "R", reference: "SF-1", total: 1000, statut: "declare", lien: "https://x.test" })), false);

console.log(`\n${total - ko}/${total} tests paiement passés`);
process.exit(ko > 0 ? 1 : 0);
