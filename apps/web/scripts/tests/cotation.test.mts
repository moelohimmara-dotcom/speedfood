import { coteLissee, cotation, fiabiliteDe, libelleCote, moyenneBrute, valeurDeClassement } from "../../src/lib/notation/cotation";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) { ko++; console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`); } else console.log(`OK    ${nom}`);
}

verifier("lissage : 5,0 sur 2 avis ne dépasse pas 4,8 sur 300", coteLissee(10, 2)! < coteLissee(1440, 300)!, true);
verifier("lissage : 5,0 sur 2 avis donne 4,4 (tirée vers 4,2)", coteLissee(10, 2), 4.4);
verifier("lissage : sur 300 avis la cote suit la moyenne (4,8 donne 4,8)", coteLissee(1440, 300), 4.8);
verifier("lissage : un mauvais restaurant sur 2 avis remonte, sur 300 avis il reste bas", [coteLissee(2, 2)! > 2.5, coteLissee(300, 300)! < 1.5], [true, true]);
verifier("comptes impossibles : null (jamais une cote hors de 1 à 5)", [coteLissee(0, 0), coteLissee(1, 2), coteLissee(11, 2), coteLissee(NaN, 3), coteLissee(10, -1), coteLissee(10, 2.5)], [null, null, null, null, null, null]);
verifier("moyenne brute : formule historique (arrondi inférieur au dixième)", [moyenneBrute(9, 2), moyenneBrute(14, 3), moyenneBrute(0, 0)], [4.5, 4.6, null]);
verifier("fiabilité : nouveau, en cours, fiable", [fiabiliteDe(0), fiabiliteDe(4), fiabiliteDe(5), fiabiliteDe(29), fiabiliteDe(30)], ["nouveau", "nouveau", "en_cours", "en_cours", "fiable"]);

verifier("libellé : « Nouveau » sous 5 avis", libelleCote(cotation({ somme: 15, total: 3 })), "Nouveau");
verifier("libellé : cote et nombre exact sous 100 avis", libelleCote(cotation({ somme: 207, total: 46 })), "4,5 ★ (46)");
verifier("libellé : 100+, 500+, 1000+", [libelleCote(cotation({ somme: 520, total: 120 })), libelleCote(cotation({ somme: 2400, total: 520 })), libelleCote(cotation({ somme: 5000, total: 1100 }))], ["4,3 ★ (100+)", "4,6 ★ (500+)", "4,5 ★ (1000+)"]);
verifier("libellé : aucun avis = aucune cote inventée", libelleCote(cotation({ somme: 0, total: 0 })), null);

verifier("badge « Très apprécié » : cote 4,6 et plus, au moins 30 avis", cotation({ somme: 196, total: 40 }).badges, ["tres_apprecie"]);
verifier("pas de « Très apprécié » sur peu d'avis, même parfaits", cotation({ somme: 50, total: 10 }).badges, []);
verifier("badge « Valeur sûre » : 4,3 et plus sur 100 avis", cotation({ somme: 660, total: 150 }).badges, ["valeur_sure"]);
verifier("badge « Nouveau » sous 5 avis", cotation({ somme: 20, total: 4 }).badges, ["nouveau"]);
verifier("badge « Menu frais » : 90 % des plats confirmés récemment sur au moins 10 plats", [cotation({ somme: 0, total: 0, fraicheur: 0.95, nombrePlats: 30 }).badges.includes("menu_frais"), cotation({ somme: 0, total: 0, fraicheur: 0.95, nombrePlats: 5 }).badges.includes("menu_frais"), cotation({ somme: 0, total: 0, fraicheur: 0.6, nombrePlats: 30 }).badges.includes("menu_frais")], [true, false, false]);
verifier("classement : sans avis = moyenne a priori, ni avantagé ni puni", [valeurDeClassement(cotation({ somme: 0, total: 0 })), valeurDeClassement({ cote: 4.9 })], [4.2, 4.9]);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
