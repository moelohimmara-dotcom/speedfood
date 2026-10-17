import { PAS_MAX_SECONDES, SEUIL_ARRIVEE_KM, VITESSE_DEMO_KMH, minutesRestantes, pasVers } from "../../src/lib/livraison/mouvement";
import { distanceVolOiseauKm } from "../../src/lib/livraison/frais";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const a = { latitude: 9.5, longitude: -13.7 };
const b = { latitude: 9.53, longitude: -13.7 }; // ~3,3 km au nord

verifier("vitesse de démonstration : 120 km/h", VITESSE_DEMO_KMH, 120);
const reste0 = distanceVolOiseauKm(a, b);

const p1 = pasVers(a, b, 120, 10); // 120 km/h pendant 10 s = 333 m
verifier("un pas de 10 s à 120 km/h avance d'environ 333 m", Math.round(distanceVolOiseauKm(a, p1.position) * 1000 / 10) * 10, 330);
verifier("un pas ne dépasse pas la cible et n'est pas arrivé", [p1.arrive, p1.resteKm < reste0, p1.resteKm > 0], [false, true, true]);
verifier("le pas va dans la bonne direction (plus près de la cible)", distanceVolOiseauKm(p1.position, b) < distanceVolOiseauKm(a, b), true);

let pos = a;
let secondes = 0;
for (let i = 0; i < 40; i++) {
  const p = pasVers(pos, b, 120, 10);
  pos = p.position;
  secondes += 10;
  if (p.arrive) break;
}
verifier("le trajet de 3,3 km à 120 km/h aboutit en moins de 2 minutes", secondes > 60 && secondes <= 120, true);
verifier("à l'arrivée, il est exactement sur la cible", pos, b);

verifier("déjà arrivé (moins de 50 m)", pasVers({ latitude: 9.53001, longitude: -13.7 }, b, 120, 10).arrive, true);
verifier("un très long laps de temps est plafonné (pas de téléportation)", distanceVolOiseauKm(a, pasVers(a, { latitude: 10.5, longitude: -13.7 }, 120, 3600).position) <= (120 * PAS_MAX_SECONDES) / 3600 + 0.001, true);
verifier("temps négatif : ne bouge pas", pasVers(a, b, 120, -5).position, a);
verifier("vitesse nulle : ne bouge pas, pas d'arrivée", pasVers(a, b, 0, 10).arrive, false);
verifier("point invalide : ne bouge pas", pasVers(a, { latitude: 200, longitude: 0 }, 120, 10).position, a);
verifier("seuil d'arrivée : 50 m", SEUIL_ARRIVEE_KM, 0.05);

verifier("heure d'arrivée : 3 km à 20 km/h = 9 min", minutesRestantes(3, 20), 9);
verifier("heure d'arrivée : au moins 1 minute", minutesRestantes(0.01, 20), 1);
verifier("heure d'arrivée : vitesse nulle = 0", minutesRestantes(3, 0), 0);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
