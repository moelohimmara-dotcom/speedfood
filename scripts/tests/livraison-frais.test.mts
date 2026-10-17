import {
  REGLAGES_PAR_DEFAUT,
  calculerFraisLivraison,
  distanceRouteEstimeeKm,
  distanceVolOiseauKm,
  dureeEstimeeMinutes,
  libelleFrais,
  pointValide,
  reglagesValides,
  type ReglagesLivraison,
} from "../../src/lib/livraison/frais";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Points réels de Conakry (valeurs approchées) : Kaloum (centre) et Ratoma.
const kaloum = { latitude: 9.5092, longitude: -13.7122 };
const ratoma = { latitude: 9.6, longitude: -13.62 };

verifier("distance : un point avec lui-même = 0", distanceVolOiseauKm(kaloum, kaloum), 0);
const d = distanceVolOiseauKm(kaloum, ratoma);
verifier("distance : Kaloum-Ratoma entre 11 et 16 km à vol d'oiseau", d > 11 && d < 16, true);
verifier("distance : symétrique", Math.abs(distanceVolOiseauKm(kaloum, ratoma) - distanceVolOiseauKm(ratoma, kaloum)) < 1e-9, true);
verifier("distance de route estimée = 1,3 × vol d'oiseau", Math.abs(distanceRouteEstimeeKm(kaloum, ratoma) - 1.3 * d) < 1e-9, true);
verifier("point valide / hors bornes / NaN / absent", [pointValide(kaloum), pointValide({ latitude: 91, longitude: 0 }), pointValide({ latitude: Number.NaN, longitude: 0 }), pointValide(null)], [true, false, false, false]);

const r: ReglagesLivraison = { baseGnf: 5000, prixKmGnf: 2000, minimumGnf: 8000, gratuitDesGnf: null, rayonMaxKm: 10, arrondiGnf: 500 };

verifier("frais : 1 km = base + 1 km, mais le minimum s'applique (7 000 < 8 000)", calculerFraisLivraison(1, 30000, r), { ok: true, fraisGnf: 8000, distanceKm: 1, gratuite: false });
verifier("frais : 3 km = 5 000 + 6 000 = 11 000", calculerFraisLivraison(3, 30000, r), { ok: true, fraisGnf: 11000, distanceKm: 3, gratuite: false });
verifier("frais : arrondi au multiple de 500 supérieur (3,3 km = 11 600 -> 12 000)", calculerFraisLivraison(3.3, 30000, r), { ok: true, fraisGnf: 12000, distanceKm: 3.3, gratuite: false });
verifier("frais : exactement au rayon maximal accepté", calculerFraisLivraison(10, 30000, r), { ok: true, fraisGnf: 25000, distanceKm: 10, gratuite: false });
verifier("frais : au-delà du rayon refusé", calculerFraisLivraison(10.01, 30000, r), { ok: false, raison: "hors_rayon", distanceKm: 10.01, rayonMaxKm: 10 });
verifier("frais : distance 0 = minimum", calculerFraisLivraison(0, 30000, r), { ok: true, fraisGnf: 8000, distanceKm: 0, gratuite: false });

const gratuit = { ...r, gratuitDesGnf: 100000 };
verifier("gratuité : 99 999 GNF payant", (calculerFraisLivraison(3, 99999, gratuit) as { gratuite: boolean }).gratuite, false);
verifier("gratuité : 100 000 GNF offert", calculerFraisLivraison(3, 100000, gratuit), { ok: true, fraisGnf: 0, distanceKm: 3, gratuite: true });
verifier("gratuité : la distance hors rayon reste refusée même si la commande est grosse", calculerFraisLivraison(12, 500000, gratuit), { ok: false, raison: "hors_rayon", distanceKm: 12, rayonMaxKm: 10 });

verifier("montants entiers : jamais de virgule", Number.isInteger((calculerFraisLivraison(2.777, 30000, r) as { fraisGnf: number }).fraisGnf), true);
verifier("réglages invalides : base négative", calculerFraisLivraison(3, 30000, { ...r, baseGnf: -1 }), { ok: false, raison: "reglages_invalides" });
verifier("réglages invalides : prix au km à virgule", calculerFraisLivraison(3, 30000, { ...r, prixKmGnf: 1999.5 }), { ok: false, raison: "reglages_invalides" });
verifier("réglages invalides : rayon nul", calculerFraisLivraison(3, 30000, { ...r, rayonMaxKm: 0 }), { ok: false, raison: "reglages_invalides" });
verifier("réglages invalides : arrondi nul", reglagesValides({ ...r, arrondiGnf: 0 }), false);
verifier("distance négative ou NaN refusée", [calculerFraisLivraison(-1, 1000, r), calculerFraisLivraison(Number.NaN, 1000, r)], [{ ok: false, raison: "reglages_invalides" }, { ok: false, raison: "reglages_invalides" }]);
verifier("sous-total à virgule refusé", calculerFraisLivraison(3, 1000.5, r), { ok: false, raison: "reglages_invalides" });
verifier("réglages par défaut valides", reglagesValides(REGLAGES_PAR_DEFAUT), true);

verifier("libellé payant", libelleFrais({ ok: true, fraisGnf: 11000, distanceKm: 3, gratuite: false }).replace(/\s/g, " "), "Livraison : 11 000 GNF (3,0 km)");
verifier("libellé offert", libelleFrais({ ok: true, fraisGnf: 0, distanceKm: 3, gratuite: true }), "Livraison offerte (3,0 km)");

verifier("durée : 3 km à 20 km/h = 9 min", dureeEstimeeMinutes(3, 20), 9);
verifier("durée : au moins 1 minute", dureeEstimeeMinutes(0.01, 30), 1);
verifier("durée : vitesse nulle = 0 (inconnue)", dureeEstimeeMinutes(3, 0), 0);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
