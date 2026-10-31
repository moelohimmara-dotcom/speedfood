import { grouperParCommune, type QuartierChoix } from "../../src/lib/geographie/quartiers";

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

const quartiers: QuartierChoix[] = [
  { id: "q3", nom: "Taouyah", communeId: "c-ratoma", communeNom: "Ratoma", generique: false, prefectureId: "p-conakry", prefectureNom: "Conakry", regionId: "r-conakry", regionNom: "Conakry" },
  { id: "q1", nom: "Dixinn Centre I", communeId: "c-dixinn", communeNom: "Dixinn", generique: false, prefectureId: "p-conakry", prefectureNom: "Conakry", regionId: "r-conakry", regionNom: "Conakry" },
  { id: "q2", nom: "Almamya I", communeId: "c-kaloum", communeNom: "Kaloum", generique: false, prefectureId: "p-conakry", prefectureNom: "Conakry", regionId: "r-conakry", regionNom: "Conakry" },
  { id: "q4", nom: "Belle Vue École", communeId: "c-dixinn", communeNom: "Dixinn", generique: false, prefectureId: "p-conakry", prefectureNom: "Conakry", regionId: "r-conakry", regionNom: "Conakry" },
  { id: "q5", nom: "Ratoma Centre", communeId: "c-ratoma", communeNom: "Ratoma", generique: false, prefectureId: "p-conakry", prefectureNom: "Conakry", regionId: "r-conakry", regionNom: "Conakry" },
];

const groupes = grouperParCommune(quartiers);

verifier(
  "une commune par groupe, communes triees par nom",
  groupes.map((g) => g.communeNom),
  ["Dixinn", "Kaloum", "Ratoma"]
);
verifier(
  "quartiers d'une commune tries par nom",
  groupes.find((g) => g.communeNom === "Dixinn")?.quartiers.map((q) => q.nom),
  ["Belle Vue École", "Dixinn Centre I"]
);
verifier("chaque quartier n'apparait qu'une fois", groupes.flatMap((g) => g.quartiers).length, quartiers.length);
verifier("liste vide", grouperParCommune([]), []);
verifier(
  "identifiant de commune conserve",
  groupes.find((g) => g.communeNom === "Kaloum")?.communeId,
  "c-kaloum"
);

console.log(`\n${total - ko}/${total} OK`);
if (ko > 0) {
  process.exit(1);
}
