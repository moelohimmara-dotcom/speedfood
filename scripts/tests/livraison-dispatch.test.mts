import {
  STATUTS_LIVRAISON,
  acteurPeut,
  estFinal,
  etapeLivraison,
  libelleLivraison,
  transitionLivraisonAutorisee,
  type ModeLivraison,
  type StatutLivraison,
} from "../../src/lib/livraison/statuts";
import { choisirLivreur, echeanceOffre, offreExpiree, type CandidatLivreur } from "../../src/lib/livraison/dispatch";
import { codeRemiseCorrect, genererCodeRemise, normaliserCodeRemise } from "../../src/lib/livraison/code";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- statuts
const tous = [...STATUTS_LIVRAISON] as StatutLivraison[];
verifier("neuf statuts", tous.length, 9);
verifier("statuts finaux : livrée, échec, annulée", tous.filter(estFinal), ["livree", "echec", "annulee"]);
for (const mode of ["speedfood", "propre"] as ModeLivraison[]) {
  verifier(`${mode} : aucun statut final ne repart`, tous.filter(estFinal).every((f) => tous.every((v) => !transitionLivraisonAutorisee(f, v, mode))), true);
}
verifier("speedfood : parcours nominal", ["a_assigner>offre_envoyee", "offre_envoyee>assignee", "assignee>vers_restaurant", "vers_restaurant>recuperee", "recuperee>vers_client", "vers_client>livree"].every((p) => {
  const [a, b] = p.split(">") as [StatutLivraison, StatutLivraison];
  return transitionLivraisonAutorisee(a, b, "speedfood");
}), true);
verifier("speedfood : on ne saute pas la récupération", transitionLivraisonAutorisee("vers_restaurant", "vers_client", "speedfood"), false);
verifier("speedfood : on ne livre pas avant de récupérer", transitionLivraisonAutorisee("assignee", "livree", "speedfood"), false);
verifier("speedfood : une offre refusée revient à « à assigner »", transitionLivraisonAutorisee("offre_envoyee", "a_assigner", "speedfood"), true);
verifier("speedfood : après récupération, plus de réassignation", transitionLivraisonAutorisee("recuperee", "a_assigner", "speedfood"), false);
verifier("propre : parcours assignée > en route > livrée", [transitionLivraisonAutorisee("assignee", "vers_client", "propre"), transitionLivraisonAutorisee("vers_client", "livree", "propre")], [true, true]);
verifier("propre : pas de répartition", transitionLivraisonAutorisee("a_assigner", "offre_envoyee", "propre"), false);
verifier("propre : pas de passage par le restaurant", transitionLivraisonAutorisee("assignee", "vers_restaurant", "propre"), false);

// --- qui peut quoi
verifier("livreur : peut aller au restaurant (speedfood)", acteurPeut("livreur", "assignee", "vers_restaurant", "speedfood"), true);
verifier("livreur : ne peut pas agir en mode propre", acteurPeut("livreur", "vers_client", "livree", "propre"), false);
verifier("livreur : ne peut pas annuler", acteurPeut("livreur", "assignee", "annulee", "speedfood"), false);
verifier("livreur : ne peut pas s'assigner une course", acteurPeut("livreur", "a_assigner", "assignee", "speedfood"), false);
verifier("restaurant en mode propre : fait avancer sa livraison", [acteurPeut("restaurant", "assignee", "vers_client", "propre"), acteurPeut("restaurant", "vers_client", "livree", "propre")], [true, true]);
verifier("restaurant en mode speedfood : peut seulement annuler", [acteurPeut("restaurant", "assignee", "annulee", "speedfood"), acteurPeut("restaurant", "vers_restaurant", "recuperee", "speedfood")], [true, false]);
verifier("administrateur : reprend la main (réassignation)", acteurPeut("admin", "vers_restaurant", "a_assigner", "speedfood"), true);
verifier("administrateur : ne dépasse pas la machine à états", acteurPeut("admin", "livree", "annulee", "speedfood"), false);
verifier("système : envoie une offre", acteurPeut("systeme", "a_assigner", "offre_envoyee", "speedfood"), true);
verifier("système : ne marque jamais livrée", acteurPeut("systeme", "vers_client", "livree", "speedfood"), false);

// --- libellés et étapes
verifier("libellé speedfood", libelleLivraison("a_assigner", "speedfood"), "Recherche d'un livreur");
verifier("libellé propre", libelleLivraison("assignee", "propre"), "Prête à partir");
verifier("libellé propre de repli", libelleLivraison("livree", "propre"), "Livrée");
verifier("étapes croissantes", ["a_assigner", "assignee", "vers_restaurant", "recuperee", "vers_client", "livree"].map((s) => etapeLivraison(s as StatutLivraison)), [0, 1, 2, 3, 4, 5]);

// --- répartition
const maintenant = new Date("2026-10-17T12:00:00Z");
const il_y_a = (min: number) => new Date(maintenant.getTime() - min * 60_000).toISOString();
const depart = { latitude: 9.5370, longitude: -13.6785 };
const livreur = (id: string, dLat: number, extra: Partial<CandidatLivreur> = {}): CandidatLivreur => ({
  id,
  statut: "disponible",
  latitude: depart.latitude + dLat,
  longitude: depart.longitude,
  positionLe: il_y_a(1),
  derniereCourseLe: null,
  ...extra,
});
const options = { exclus: new Set<string>(), rayonKm: 15, positionMaxMinutes: 10, maintenant };

verifier("répartition : aucun candidat", choisirLivreur([], depart, options), null);
verifier("répartition : le plus proche d'abord", choisirLivreur([livreur("loin", 0.05), livreur("proche", 0.01), livreur("moyen", 0.03)], depart, options)?.livreurId, "proche");
verifier("répartition : distance renvoyée en km (0,01° ≈ 1,1 km)", Math.round((choisirLivreur([livreur("a", 0.01)], depart, options)?.distanceKm ?? 0) * 10) / 10, 1.1);
verifier("répartition : un livreur hors ligne est ignoré", choisirLivreur([livreur("a", 0.01, { statut: "hors_ligne" })], depart, options), null);
verifier("répartition : un livreur en course est ignoré", choisirLivreur([livreur("a", 0.01, { statut: "en_course" })], depart, options), null);
verifier("répartition : sans position, ignoré", choisirLivreur([livreur("a", 0.01, { latitude: null, longitude: null, positionLe: null })], depart, options), null);
verifier("répartition : position trop ancienne (11 min), ignoré", choisirLivreur([livreur("a", 0.01, { positionLe: il_y_a(11) })], depart, options), null);
verifier("répartition : position de 9 min acceptée", choisirLivreur([livreur("a", 0.01, { positionLe: il_y_a(9) })], depart, options)?.livreurId, "a");
verifier("répartition : trop loin (> 15 km)", choisirLivreur([livreur("a", 0.2)], depart, options), null);
verifier("répartition : un livreur déjà sollicité est exclu", choisirLivreur([livreur("a", 0.01), livreur("b", 0.02)], depart, { ...options, exclus: new Set(["a"]) })?.livreurId, "b");
verifier("répartition : égalité de distance, le plus longtemps inactif passe d'abord", choisirLivreur([livreur("recent", 0.01, { derniereCourseLe: il_y_a(5) }), livreur("ancien", 0.01, { derniereCourseLe: il_y_a(120) })], depart, options)?.livreurId, "ancien");
verifier("répartition : jamais de course = prioritaire à égalité", choisirLivreur([livreur("fait", 0.01, { derniereCourseLe: il_y_a(120) }), livreur("neuf", 0.01)], depart, options)?.livreurId, "neuf");
verifier("répartition : départ invalide", choisirLivreur([livreur("a", 0.01)], { latitude: 200, longitude: 0 }, options), null);
verifier("répartition : horloge du futur refusée", choisirLivreur([livreur("a", 0.01, { positionLe: new Date(maintenant.getTime() + 10 * 60_000).toISOString() })], depart, options), null);

// --- offres
const echeance = echeanceOffre(maintenant, 45);
verifier("offre : échéance à 45 s", echeance, "2026-10-17T12:00:45.000Z");
verifier("offre : valable avant l'échéance", offreExpiree(echeance, new Date("2026-10-17T12:00:44Z")), false);
verifier("offre : expirée à l'échéance", offreExpiree(echeance, new Date("2026-10-17T12:00:45Z")), true);

// --- code de remise
const codes = Array.from({ length: 200 }, () => genererCodeRemise());
verifier("code : toujours 4 chiffres", codes.every((c) => /^\d{4}$/.test(c)), true);
verifier("code : pas toujours le même", new Set(codes).size > 100, true);
verifier("code : zéros de tête conservés", normaliserCodeRemise("0042"), "0042");
verifier("code : espaces tolérés", normaliserCodeRemise(" 12 34 "), "1234");
verifier("code : trop court, trop long, lettres refusés", [normaliserCodeRemise("123"), normaliserCodeRemise("12345"), normaliserCodeRemise("12a4")], [null, null, null]);
verifier("code : bon / mauvais", [codeRemiseCorrect("1234", "1234"), codeRemiseCorrect("1234", "1235"), codeRemiseCorrect("1234", "abcd")], [true, false, false]);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
