import { analyserPosition } from "../../src/lib/restaurant/position";
import { libellesMoyensPaiement, moyensPaiementValides, normaliserMoyensPaiement } from "../../src/lib/restaurant/paiement";
import { formaterDelaiValidation, lienWhatsAppAssistance, liensCarte } from "../../src/lib/parametres/assistance-format";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Position
verifier("position vide = aucune", analyserPosition("", " "), { ok: true, position: null });
verifier("position valide (virgule décimale)", analyserPosition("9,5370", "-13.6785"), {
  ok: true,
  position: { latitude: 9.537, longitude: -13.6785 },
});
verifier("arrondi à 6 décimales", analyserPosition("9.123456789", "-13.1"), {
  ok: true,
  position: { latitude: 9.123457, longitude: -13.1 },
});
verifier("une seule coordonnée refusée", analyserPosition("9.5", "").ok, false);
verifier("texte refusé", analyserPosition("abc", "-13").ok, false);
verifier("hors Guinée refusé (Paris)", analyserPosition("48.85", "2.35").ok, false);
verifier("longitude positive refusée", analyserPosition("9.5", "13.6").ok, false);
verifier("notation scientifique refusée", analyserPosition("9e1", "-13").ok, false);

// Moyens de paiement
verifier("moyens connus valides", moyensPaiementValides(["especes", "mtn_momo"]), true);
verifier("moyen inconnu refusé", moyensPaiementValides(["especes", "bitcoin"]), false);
verifier("valeur non texte refusée", moyensPaiementValides([1]), false);
verifier("normalisation sans doublon, ordre fixe", normaliserMoyensPaiement(["mtn_momo", "especes", "especes"]), ["especes", "mtn_momo"]);
verifier("libellés", libellesMoyensPaiement(["orange_money"]), ["Orange Money"]);

// Assistance
verifier("délai en heures", formaterDelaiValidation(24), "24 h");
verifier("délai arrondi au jour dès 48 h", formaterDelaiValidation(48), "2 jours");
verifier("délai 50 h = 3 jours", formaterDelaiValidation(50), "3 jours");
verifier(
  "lien WhatsApp",
  lienWhatsAppAssistance("224620000000", "Bonjour & merci"),
  "https://wa.me/224620000000?text=Bonjour%20%26%20merci"
);
verifier("liens de carte", liensCarte(9.537, -13.6785), {
  voir: "https://www.openstreetmap.org/?mlat=9.537&mlon=-13.6785#map=17/9.537/-13.6785",
  itineraire: "https://www.google.com/maps/dir/?api=1&destination=9.537,-13.6785",
});

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
