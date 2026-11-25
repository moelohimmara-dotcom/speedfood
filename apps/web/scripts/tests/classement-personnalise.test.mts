import { HABITUDES_VIDES, PROFIL_VIDE, classerPersonnalise, distanceKm, evaluerArticle, extraireEvitements, libelleDistance, scoreProximite, type ArticleAClasser, type ContexteClassement, type ProfilClient, type RestaurantAClasser } from "../../src/lib/menu/classement-personnalise";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else console.log(`OK    ${nom}`);
}

const KALOUM = { latitude: 9.5092, longitude: -13.7122 };
const art = (id: string, nom: string, extra: Partial<ArticleAClasser> = {}): ArticleAClasser => ({ id, nom, description: "", prixGnf: 30000, disponibilite: "disponible", ...extra });
const resto = (id: string, extra: Partial<RestaurantAClasser> = {}): RestaurantAClasser => ({ id, categorie: "Français", ouvert: true, accepteCommandes: true, note: 4, niveau: "exact", score: 0.9, articles: [art(id + "-a", "Crêpe sucre")], ...extra });
const ctx = (profil: Partial<ProfilClient> = {}, extra: Partial<ContexteClassement> = {}): ContexteClassement => ({ profil: { ...PROFIL_VIDE, ...profil }, habitudes: HABITUDES_VIDES, position: null, ...extra });
const ordre = (rs: RestaurantAClasser[], c: ContexteClassement) => classerPersonnalise(rs, c).map((r) => r.restaurantId);

// Distance
verifier("distance : un point à lui-même = 0", distanceKm(KALOUM, KALOUM), 0);
verifier("distance : Kaloum - Ratoma environ 11 km", Math.round(distanceKm(KALOUM, { latitude: 9.5833, longitude: -13.6167 })), 13);
verifier("libellé : moins d'1 km en mètres, au-delà en km", [libelleDistance(0.43), libelleDistance(1.24), libelleDistance(25.6)], ["À 450 m", "À 1,2 km", "À 26 km"]);
verifier("proximité : décroît mais ne tombe jamais à zéro", [scoreProximite(0) === 1, scoreProximite(3), scoreProximite(100) > 0], [true, 0.5, true]);

// Proximité : proche avant loin à pertinence égale ; le lointain reste listé
const proche = resto("proche", { latitude: 9.51, longitude: -13.71 });
const loin = resto("loin", { latitude: 9.9, longitude: -13.2 });
verifier("proximité : le restaurant proche passe avant le lointain, les deux restent listés", ordre([loin, proche], ctx({}, { position: KALOUM })), ["proche", "loin"]);
verifier("sans position : la proximité ne compte pas (ordre stable)", classerPersonnalise([loin, proche], ctx()).every((r) => r.distanceKm === null), true);

// Les critères fixes passent avant le score personnel
verifier("pertinence d'abord : exact lointain avant similaire tout proche", ordre([resto("sim", { niveau: "similaire", latitude: 9.51, longitude: -13.71 }), resto("ex", { latitude: 9.9, longitude: -13.2 })], ctx({}, { position: KALOUM })), ["ex", "sim"]);
verifier("ouvert avant fermé à pertinence égale, même s'il est plus loin", ordre([resto("ferme", { ouvert: false, latitude: 9.51, longitude: -13.71 }), resto("ouvert", { latitude: 9.9, longitude: -13.2 })], ctx({}, { position: KALOUM })), ["ouvert", "ferme"]);

// Habitudes
const habitudes = { restaurants: { habitue: 3 }, plats: { "crepe sucre": 2 }, cuisines: {} };
verifier("habitudes : le restaurant déjà commandé monte", ordre([resto("autre"), resto("habitue")], ctx({}, { habitudes })), ["habitue", "autre"]);
const r1 = classerPersonnalise([resto("habitue")], ctx({}, { habitudes }))[0];
verifier("habitudes : raisons affichables", r1.raisons.slice(0, 2), ["Vous avez déjà commandé ici 3 fois", "Un plat que vous avez déjà commandé"]);

// Goûts
verifier("cuisine préférée : monte et se dit", classerPersonnalise([resto("a", { categorie: "Indien" }), resto("b", { categorie: "Français" })], ctx({ cuisinesPreferees: ["indien"] })).map((r) => r.restaurantId + ":" + r.raisons.includes("Cuisine que vous aimez : Indien")), ["a:true", "b:false"]);
verifier("végétarien : un plat de viande est signalé et descend", evaluerArticle(art("x", "Pizza poulet"), ctx({ regimes: ["vegetarien"] })).alertes.length, 1);
verifier("végétarien : un plat sans viande n'est pas signalé", evaluerArticle(art("x", "Pizza margherita"), ctx({ regimes: ["vegetarien"] })).alertes, []);
verifier("sans porc : jambon signalé", evaluerArticle(art("x", "Pizza reine", { description: "Jambon, champignons" }), ctx({ regimes: ["sans_porc"] })).alertes, ["Contient du porc"]);
verifier("sans alcool : bière signalée", evaluerArticle(art("x", "Bière blonde"), ctx({ regimes: ["sans_alcool"] })).alertes, ["Contient de l'alcool"]);
verifier("piment aucun : plat épicé signalé", evaluerArticle(art("x", "Poulet épicé"), ctx({ piment: "aucun" })).alertes, ["Plat épicé"]);
verifier("budget : au-dessus signalé, en dessous non", [evaluerArticle(art("x", "Crêpe", { prixGnf: 50000 }), ctx({ budgetMaxGnf: 40000 })).alertes, evaluerArticle(art("x", "Crêpe", { prixGnf: 30000 }), ctx({ budgetMaxGnf: 40000 })).alertes], [["Au-dessus de votre budget"], []]);
verifier("notes libres : « sans oignon, pas de coriandre »", extraireEvitements("Je veux tout sans oignon, pas de coriandre. J'évite le piment !").sort(), ["coriandre", "oignon", "piment"]);
verifier("notes libres : le plat avec oignon est signalé", evaluerArticle(art("x", "Poulet aux oignons"), ctx({ notes: "sans oignon" })).alertes, ["Vous évitez « oignon »"]);
verifier("mots à éviter saisis un par un", evaluerArticle(art("x", "Salade de coriandre"), ctx({ evitements: ["coriandre"] })).alertes, ["Vous évitez « coriandre »"]);

// Allergies : prioritaires
const arachide = ctx({ allergies: ["arachide"] });
verifier("allergie déclarée : le plat est écarté", evaluerArticle(art("x", "Sauce maison", { allergenes: ["arachide", "lait"] }), arachide).ecarte, true);
verifier("allergie évoquée par le nom (non déclarée) : probable, pas écarté, avec alerte claire", (() => { const e = evaluerArticle(art("x", "Poulet sauce arachide"), arachide); return [e.statutAllergie, e.ecarte, e.alertes[0]]; })(), ["probable", false, "Contient probablement : arachide"]);
verifier("allergie évoquée alors que le restaurant a déclaré autre chose : alerte de vérification", evaluerArticle(art("x", "Mafé de bœuf", { allergenes: [] }), arachide).alertes[0].includes("à vérifier avec lui"), true);
verifier("plat sans allergènes renseignés : « non renseigné », jamais « sûr »", evaluerArticle(art("x", "Riz blanc"), arachide).statutAllergie, "non_renseigne");
verifier("plat dont le restaurant déclare « aucun allergène » : compatible", evaluerArticle(art("x", "Riz blanc", { allergenes: [] }), arachide).statutAllergie, "compatible");
verifier("sans allergie au profil : aucun statut d'allergie", evaluerArticle(art("x", "Poulet sauce arachide"), ctx()).statutAllergie, "aucun_profil");
verifier("crêpe : signalée pour lait, œuf et gluten", ["lait", "oeuf", "gluten"].map((a) => evaluerArticle(art("x", "Crêpe sucre"), ctx({ allergies: [a as never] })).statutAllergie), ["probable", "probable", "probable"]);
verifier("fruits de mer : crevette signalée pour crustacés", evaluerArticle(art("x", "Riz aux crevettes"), ctx({ allergies: ["crustaces"] })).statutAllergie, "probable");

// Au niveau du restaurant
const sain = resto("sain", { articles: [art("s1", "Crêpe sucre", { allergenes: [] })], latitude: 9.9, longitude: -13.2 });
const incertain = resto("incertain", { articles: [art("i1", "Crêpe miel")], latitude: 9.51, longitude: -13.71 });
const dangereux = resto("dangereux", { articles: [art("d1", "Crêpe noisette", { allergenes: ["fruits_a_coque"] })], latitude: 9.51, longitude: -13.71 });
const pf = classerPersonnalise([dangereux, incertain, sain], ctx({ allergies: ["fruits_a_coque"] }, { position: KALOUM }));
verifier("allergie : le restaurant au plat sûr passe avant l'incertain, même plus loin ; le dangereux reste listé en dernier", pf.map((r) => r.restaurantId), ["sain", "incertain", "dangereux"]);
verifier("allergie : un restaurant dont tout est écarté reste listé, vide, avec sa raison", [pf[2].articles.length, pf[2].nombreEcartes, pf[2].raisons.includes("1 plat écarté pour vos allergies")], [0, 1, true]);
verifier("allergie : un plat à allergène déclaré n'apparaît JAMAIS dans les articles retenus", pf.every((r) => r.articles.every((a) => a.statutAllergie !== "ecarte")), true);

// Aucun restaurant perdu
const beaucoup = Array.from({ length: 150 }, (_, i) => resto("r" + i));
verifier("aucun restaurant perdu : 150 entrés, 150 sortis", classerPersonnalise(beaucoup, ctx({ allergies: ["gluten"] })).length, 150);
verifier("ordre déterministe", ordre(beaucoup, ctx()).join() === ordre([...beaucoup].reverse(), ctx()).join(), true);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
