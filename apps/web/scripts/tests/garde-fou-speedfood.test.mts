import {
  MESSAGE_SPEEDFOOD_INDISPONIBLE,
  RAYON_SPEEDFOOD_KM,
  VALIDITE_POSITION_JOURS,
  livreurUtilisableProche,
  modeEffectifLivraison,
  type LivreurPourGardeFou,
} from "../../src/lib/livraison/garde-fou-speedfood";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const maintenant = new Date("2026-10-21T12:00:00Z");
const depart = { latitude: 9.5370, longitude: -13.6785 }; // Conakry
const ilYa = (jours: number) => new Date(maintenant.getTime() - jours * 24 * 3600 * 1000).toISOString();
const livreur = (surcharge: Partial<LivreurPourGardeFou> = {}): LivreurPourGardeFou => ({ cycle: "actif", simule: false, latitude: 9.55, longitude: -13.68, positionLe: ilYa(1), ...surcharge });

verifier("constantes de la spécification : 15 km, 7 jours", [RAYON_SPEEDFOOD_KM, VALIDITE_POSITION_JOURS], [15, 7]);
verifier("aucun livreur : indisponible", livreurUtilisableProche(depart, [], maintenant), false);
verifier("un livreur actif, réel, proche, position d'hier : disponible", livreurUtilisableProche(depart, [livreur()], maintenant), true);
verifier("livreur de démonstration seul : indisponible pour un vrai restaurant", livreurUtilisableProche(depart, [livreur({ simule: true })], maintenant), false);
verifier("livreur de démonstration : compte pour un restaurant de démonstration", livreurUtilisableProche(depart, [livreur({ simule: true })], maintenant, { restaurantDemo: true }), true);
for (const cycle of ["cree", "invite", "candidat", "suspendu", "archive"]) {
  verifier(`livreur au cycle « ${cycle} » : ne compte pas`, livreurUtilisableProche(depart, [livreur({ cycle })], maintenant), false);
}
verifier("position vieille de 8 jours : ne compte pas ; de 6 jours : compte", [livreurUtilisableProche(depart, [livreur({ positionLe: ilYa(8) })], maintenant), livreurUtilisableProche(depart, [livreur({ positionLe: ilYa(6) })], maintenant)], [false, true]);
verifier("livreur à environ 60 km : hors rayon", livreurUtilisableProche(depart, [livreur({ latitude: 10.05, longitude: -13.68 })], maintenant), false);
verifier("livreur juste dans le rayon (environ 14 km) : compte", livreurUtilisableProche(depart, [livreur({ latitude: 9.663, longitude: -13.6785 })], maintenant), true);
verifier("position absente, date illisible ou dans le futur : ne compte pas", [
  livreurUtilisableProche(depart, [livreur({ latitude: null })], maintenant),
  livreurUtilisableProche(depart, [livreur({ positionLe: null })], maintenant),
  livreurUtilisableProche(depart, [livreur({ positionLe: "pas une date" })], maintenant),
  livreurUtilisableProche(depart, [livreur({ positionLe: ilYa(-30) })], maintenant),
], [false, false, false, false]);
verifier("départ inconnu ou invalide : on ne peut pas le prouver, indisponible", [livreurUtilisableProche(null, [livreur()], maintenant), livreurUtilisableProche({ latitude: 200, longitude: 0 }, [livreur()], maintenant)], [false, false]);
verifier("un seul bon livreur parmi plusieurs mauvais suffit", livreurUtilisableProche(depart, [livreur({ cycle: "suspendu" }), livreur({ simule: true }), livreur({ positionLe: ilYa(30) }), livreur()], maintenant), true);

verifier("mode effectif : « speedfood » sans livreur → repli sur « propre » (nouvelles commandes)", modeEffectifLivraison("speedfood", false), { mode: "propre", repli: true });
verifier("mode effectif : « speedfood » avec livreur → inchangé", modeEffectifLivraison("speedfood", true), { mode: "speedfood", repli: false });
verifier("mode effectif : « propre » et « aucune » ne changent jamais", [modeEffectifLivraison("propre", false), modeEffectifLivraison("aucune", false)], [{ mode: "propre", repli: false }, { mode: "aucune", repli: false }]);
verifier("le message au restaurateur est en français clair et propose une issue", MESSAGE_SPEEDFOOD_INDISPONIBLE.includes("personnel"), true);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nGarde-fou Speedfood vérifié.");
