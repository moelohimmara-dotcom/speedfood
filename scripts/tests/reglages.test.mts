import { analyserPosition } from "../../src/lib/restaurant/position";
import { libellesMoyensPaiement, moyensPaiementValides, normaliserMoyensPaiement } from "../../src/lib/restaurant/paiement";
import { formaterDelaiValidation, lienWhatsAppAssistance, liensCarte } from "../../src/lib/parametres/assistance-format";

import { AVATARS, emojiAvatar, estAvatarValide, genererPseudo, validerPseudo } from "../../src/lib/client/profil";
import { validerCoordonnees } from "../../src/lib/client/coordonnees";
import { normaliserTelephone } from "../../src/lib/commande/telephone";
import { fusionnerPromesse, PROMESSE_PAR_DEFAUT } from "../../src/lib/parametres/promesse-defauts";

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

// Textes de promesse
verifier("promesse : tout vide = défauts", fusionnerPromesse({}), PROMESSE_PAR_DEFAUT);
verifier("promesse : espaces seuls = défaut", fusionnerPromesse({ signature: "   " }).signature, PROMESSE_PAR_DEFAUT.signature);
verifier("promesse : texte saisi conservé et nettoyé", fusionnerPromesse({ sousTitre: "  Mon texte " }).sousTitre, "Mon texte");
verifier("promesse : un champ n'écrase pas les autres", fusionnerPromesse({ signature: "A" }).partage, PROMESSE_PAR_DEFAUT.partage);
verifier("promesse : signature de la recommandation", PROMESSE_PAR_DEFAUT.signature, "Confirmé, l'heure à l'appui");

// Profil client
verifier("avatar connu valide", estAvatarValide("pizza"), true);
verifier("avatar inconnu refusé", estAvatarValide("<script>"), false);
verifier("avatar non texte refusé", estAvatarValide(3), false);
verifier("10 avatars", AVATARS.length, 10);
verifier("emoji de repli", emojiAvatar("inconnu"), "🍽️");
verifier("pseudo valide", validerPseudo("  Piment   Malin 42 "), { ok: true, pseudo: "Piment Malin 42" });
verifier("pseudo trop court", validerPseudo("ab").ok, false);
verifier("pseudo trop long", validerPseudo("a".repeat(25)).ok, false);
verifier("pseudo avec balise refusé", validerPseudo("<b>gras</b>").ok, false);
verifier("pseudo avec accents accepté", validerPseudo("Épicé Délice").ok, true);
let toujoursValide = true;
for (let i = 0; i <= 100; i++) {
  const alea = () => i / 100;
  const pseudo = genererPseudo(alea);
  if (!validerPseudo(pseudo).ok || pseudo.length > 24) {
    toujoursValide = false;
    console.log("pseudo généré invalide :", pseudo);
  }
}
verifier("pseudos générés toujours valides (24 caractères max)", toujoursValide, true);
verifier("pseudos extrêmes valides", [genererPseudo(() => 0), genererPseudo(() => 0.999999)].every((x) => validerPseudo(x).ok), true);

// Coordonnées mémorisées
verifier("téléphone national normalisé", normaliserTelephone("622 12 34 56"), "+224622123456");
verifier("téléphone avec indicatif normalisé", normaliserTelephone("+224 (622) 12-34-56"), "+224622123456");
verifier("téléphone fixe refusé", normaliserTelephone("30 12 34 56"), null);
verifier("coordonnées valides", validerCoordonnees({ nom: "  Mariama   Diallo ", telephone: "622123456", adresse: "  Kaloum, rue 12 " }), {
  ok: true,
  coordonnees: { nom: "Mariama Diallo", telephone: "+224622123456", adresse: "Kaloum, rue 12" },
});
verifier("adresse vide = null", validerCoordonnees({ nom: "Mariama", telephone: "622123456", adresse: "   " }), {
  ok: true,
  coordonnees: { nom: "Mariama", telephone: "+224622123456", adresse: null },
});
verifier("nom trop court refusé", validerCoordonnees({ nom: "A", telephone: "622123456", adresse: null }).ok, false);
verifier("téléphone invalide refusé", validerCoordonnees({ nom: "Mariama", telephone: "12345", adresse: null }).ok, false);
verifier("adresse trop courte refusée", validerCoordonnees({ nom: "Mariama", telephone: "622123456", adresse: "abc" }).ok, false);
verifier("adresse trop longue refusée", validerCoordonnees({ nom: "Mariama", telephone: "622123456", adresse: "a".repeat(301) }).ok, false);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
