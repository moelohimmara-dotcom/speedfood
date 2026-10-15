import { calculerDifferences, diagnostiquerQualite, ENTETES_CSV, lireCsv, lireLignesImport, lireStatutLancement, ligneExport, pointValide, lienCarte, type ElementActuel, type ElementGeo } from "../../src/lib/system-admin/geographie-outils";
import { construireCsv } from "../../src/lib/system-admin/csv";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";

// Statut de lancement
verifier("statut : vide = automatique", lireStatutLancement(""), null);
verifier("statut : valeur valide", lireStatutLancement("Pilote"), "pilote");
verifier("statut : invalide", lireStatutLancement("ouvert"), undefined);

// Point
verifier("point dans la Guinée", pointValide(9.64, -13.58), true);
verifier("point hors Guinée", pointValide(48.85, 2.35), false);
verifier("lien carte", lienCarte(9.64, -13.58), "https://www.openstreetmap.org/?mlat=9.64&mlon=-13.58#map=14/9.64/-13.58");

// Qualité
const elements: ElementGeo[] = [
  { id: "a", nom: "Kipé", niveau: "quartier", actif: true, latitude: 9.6, longitude: -13.6, nomsAlternatifs: [], communeId: "c1" },
  { id: "b", nom: "Kipe", niveau: "quartier", actif: true, latitude: null, longitude: null, nomsAlternatifs: [], communeId: "c1" },
  { id: "c", nom: "Kipé", niveau: "quartier", actif: true, latitude: 9.7, longitude: -13.7, nomsAlternatifs: [], communeId: "c2" },
  { id: "d", nom: "Lambanyi", niveau: "quartier", actif: false, latitude: null, longitude: null, nomsAlternatifs: [], communeId: "c1" },
  { id: "e", nom: "Taouyah", niveau: "quartier", actif: true, latitude: 9.5, longitude: -13.5, nomsAlternatifs: ["Kipe Centre", "Cosa"], communeId: "c1" },
  { id: "f", nom: "Cosa", niveau: "quartier", actif: true, latitude: 9.5, longitude: -13.4, nomsAlternatifs: [], communeId: "c1" },
];
const problemes = diagnostiquerQualite(elements);
verifier("qualité : sans point (actifs seulement)", problemes.filter((p) => p.type === "sans_point").map((p) => p.id), ["b"]);
verifier("qualité : doublon dans la même commune (accents ignorés)", problemes.filter((p) => p.type === "doublon").map((p) => p.id).sort(), ["a", "b"]);
verifier("qualité : même nom dans une autre commune n'est pas un doublon", problemes.some((p) => p.type === "doublon" && p.id === "c"), false);
verifier("qualité : alias qui est le nom d'un autre lieu", problemes.filter((p) => p.type === "alias_ambigu").map((p) => p.id), ["e"]);

// CSV : lecture
verifier("csv : séparateur ; et guillemets", lireCsv('a;b\r\n"x;y";"il dit ""oui"""\r\n'), [["a", "b"], ["x;y", 'il dit "oui"']]);
verifier("csv : séparateur , détecté + BOM", lireCsv("﻿a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);

// Aller-retour export → import
const actuels: ElementActuel[] = [
  { id: ID1, niveau: "commune", nom: "Ratoma", actif: true, latitude: 9.64, longitude: -13.58, nomsAlternatifs: ["Ratoma Centre"], statutLancement: "ouverte" },
  { id: ID2, niveau: "quartier", nom: "Kipé", actif: true, latitude: null, longitude: null, nomsAlternatifs: [], statutLancement: null },
];
const csv = construireCsv([...ENTETES_CSV], actuels.map(ligneExport));
const relu = lireLignesImport(csv);
verifier("aller-retour : aucune erreur", relu.erreurs, []);
const diff0 = calculerDifferences(relu.lignes, actuels);
verifier("aller-retour : aucun changement (longitude négative neutralisée puis rétablie)", [diff0.changements.length, diff0.inchanges], [0, 2]);

// Modifications
const modifie = csv.replace('"Ratoma";"oui"', '"Ratoma";"non"').replace('"ouverte"', '"bientot"');
const diff1 = calculerDifferences(lireLignesImport(modifie).lignes, actuels);
verifier("import : champs modifiés listés", diff1.changements.map((c) => c.champs), [["actif : oui → non", "statut : Ouverte → Bientôt"]]);

// Invalides
const mauvais = [
  ENTETES_CSV.join(";"),
  `${ID1};commune;R;oui;;;;`,
  `${ID2};quartier;Kipé;peut-être;;;;`,
  `${ID3};quartier;Kipé;oui;48.85;2.35;;`,
  `${ID3};commune;Matam;oui;9.5;;;`,
  `pas-un-id;commune;Matam;oui;;;;`,
  `${ID3};ville;Matam;oui;;;;`,
  `${ID3};commune;Matam;oui;;;;ouvert`,
].join("\n");
const lu = lireLignesImport(mauvais);
verifier("import : chaque ligne invalide est refusée", [lu.lignes.length, lu.erreurs.length], [0, 7]);
verifier("import : colonnes manquantes", lireLignesImport("id;nom\n1;2").erreurs.length, 1);
verifier("import : identifiant en double", lireLignesImport(`${ENTETES_CSV.join(";")}\n${ID1};commune;Ratoma;oui;;;;\n${ID1};commune;Ratoma;oui;;;;`).erreurs.length, 1);

// Inconnus
const inconnu = calculerDifferences(lireLignesImport(`${ENTETES_CSV.join(";")}\n${ID3};commune;Matam;oui;;;;`).lignes, actuels);
verifier("import : identifiant inconnu jamais créé", [inconnu.changements.length, inconnu.inconnus.length], [0, 1]);
const mauvaisNiveau = calculerDifferences(lireLignesImport(`${ENTETES_CSV.join(";")}\n${ID1};quartier;Ratoma;oui;;;;`).lignes, actuels);
verifier("import : niveau qui ne correspond pas = inconnu", mauvaisNiveau.inconnus.length, 1);

if (ko > 0) process.exit(1);
