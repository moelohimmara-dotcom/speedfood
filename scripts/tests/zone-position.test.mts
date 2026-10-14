import { arrondirCoordonnee, correspondreZone, normaliserNom, positionDansLaGuinee, type CommuneMin } from "../../src/lib/site/zone-position";

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

if (echecs > 0) process.exit(1);
