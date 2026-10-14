import { arrondirCoordonnee, correspondreZone, distanceKm, normaliserNom, positionDansLaGuinee, zoneLaPlusProche, type CommuneMin } from "../../src/lib/site/zone-position";

let echecs = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom}${ok ? "" : `\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`}`);
}

const communes: CommuneMin[] = [
  {
    villeNom: "Conakry",
    nom: "Ratoma",
    slug: "ratoma",
    quartiers: [
      { id: "q1", nom: "Kipé", slug: "kipe" },
      { id: "q2", nom: "Centre", slug: "centre-ratoma" },
    ],
  },
  { villeNom: "Conakry", nom: "Matam", slug: "matam", quartiers: [{ id: "q3", nom: "Centre", slug: "centre-matam" }] },
  { villeNom: "Conakry", nom: "Kaloum", slug: "kaloum", quartiers: [] },
];

// Position et confidentialité
verifier("Conakry est dans la Guinée", positionDansLaGuinee(9.64, -13.58), true);
verifier("Paris est hors de la Guinée", positionDansLaGuinee(48.85, 2.35), false);
verifier("NaN refusé", positionDansLaGuinee(Number.NaN, -13), false);
verifier("coordonnée arrondie à 3 décimales", arrondirCoordonnee(9.641987), 9.642);

// Noms
verifier("accents, casse et préfixe ignorés", normaliserNom("Commune de Kipé"), "kipe");
verifier("quartier : préfixe ignoré", normaliserNom("Quartier Kipé"), "kipe");

// Rapprochement
verifier("quartier trouvé, avec sa commune", correspondreZone({ suburb: "Kipé", city_district: "Ratoma" }, communes), {
  niveau: "quartier",
  id: "q1",
  nom: "Kipé",
  slug: "kipe",
  communeNom: "Ratoma",
  villeNom: "Conakry",
});
verifier("deux quartiers « Centre » : la commune de l'adresse départage", correspondreZone({ neighbourhood: "Centre", city_district: "Matam" }, communes)?.id, "q3");
verifier("commune seule quand aucun quartier ne correspond", correspondreZone({ suburb: "Inconnu", city_district: "Kaloum" }, communes)?.niveau, "commune");
verifier("aucune correspondance : null", correspondreZone({ city: "Kankan", state: "Kankan" }, communes), null);
verifier("adresse vide : null", correspondreZone({}, communes), null);
verifier("valeurs non textuelles ignorées", correspondreZone({ suburb: 12, city_district: null }, communes), null);

// Repli par proximité
const avecPoints: CommuneMin[] = [
  {
    villeNom: "Conakry",
    nom: "Ratoma",
    slug: "ratoma",
    latitude: 9.63063,
    longitude: -13.60784,
    quartiers: [
      { id: "q1", nom: "Kipé", slug: "kipe", nomsAlternatifs: ["Kipe Centre"], latitude: 9.60196, longitude: -13.65427 },
      { id: "q9", nom: "Sans point", slug: "sans-point" },
    ],
  },
  { villeNom: "Conakry", nom: "Kaloum", slug: "kaloum", latitude: 9.51496, longitude: -13.70844, quartiers: [] },
];
verifier("distance : un point à lui-même", distanceKm(9.6, -13.6, 9.6, -13.6), 0);
verifier("distance : environ 111 km par degré de latitude", Math.round(distanceKm(9, -13, 10, -13)), 111);
verifier("proche d'un quartier : le quartier", zoneLaPlusProche(9.6025, -13.6538, avecPoints)?.slug, "kipe");
verifier("loin des quartiers mais dans une commune : la commune", zoneLaPlusProche(9.63, -13.61, avecPoints)?.slug, "ratoma");
verifier("trop loin de tout : null", zoneLaPlusProche(9.9, -13.9, avecPoints), null);
verifier("sans aucun point : null", zoneLaPlusProche(9.6, -13.6, communes), null);
verifier("nom alternatif reconnu", correspondreZone({ suburb: "Kipe Centre" }, avecPoints)?.slug, "kipe");

if (echecs > 0) process.exit(1);
