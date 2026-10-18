import { lireToutesLesPages } from "../../src/lib/decouverte/pagination";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

/** Source simulée de n lignes, qui compte ses appels. */
function source(n: number, echecA?: number) {
  const appels: [number, number][] = [];
  const lirePage = async (de: number, a: number) => {
    appels.push([de, a]);
    if (echecA !== undefined && appels.length === echecA) return { data: null, error: new Error("réseau") };
    return { data: Array.from({ length: Math.max(0, Math.min(a, n - 1) - de + 1) }, (_, i) => de + i), error: null };
  };
  return { lirePage, appels };
}

const reponse = async (n: number, taille: number, plafond: number) => {
  const s = source(n);
  const r = await lireToutesLesPages(s.lirePage, taille, plafond);
  return { n: r.lignes.length, tronque: r.tronque, erreur: r.erreur, pages: r.pages, premier: r.lignes[0], dernier: r.lignes.at(-1) };
};

verifier("liste vide : une requête, rien de tronqué", await reponse(0, 1000, 5000), { n: 0, tronque: false, erreur: false, pages: 1 });
verifier("moins d'une page : une requête", await reponse(37, 1000, 5000), { n: 37, tronque: false, erreur: false, pages: 1, premier: 0, dernier: 36 });
verifier("plusieurs pages, jamais de ligne perdue ni doublée", await reponse(2500, 1000, 5000), { n: 2500, tronque: false, erreur: false, pages: 3, premier: 0, dernier: 2499 });
verifier("taille exacte d'une page : une page pleine puis une page vide", await reponse(1000, 1000, 5000), { n: 1000, tronque: false, erreur: false, pages: 2, premier: 0, dernier: 999 });
verifier("plafond atteint avec des lignes restantes : on le DIT", await reponse(7000, 1000, 5000), { n: 5000, tronque: true, erreur: false, pages: 6, premier: 0, dernier: 4999 });
verifier("plafond égal au nombre de lignes : pas de fausse alerte", await reponse(5000, 1000, 5000), { n: 5000, tronque: false, erreur: false, pages: 6, premier: 0, dernier: 4999 });
verifier("plafond non multiple de la page : la dernière page est raccourcie", await reponse(900, 400, 750), { n: 750, tronque: true, erreur: false, pages: 3, premier: 0, dernier: 749 });

const e = source(3000, 2);
const echec = await lireToutesLesPages(e.lirePage, 1000, 5000);
verifier("échec en cours de route : erreur franche, aucune liste partielle présentée comme complète", { erreur: echec.erreur, n: echec.lignes.length, tronque: echec.tronque }, { erreur: true, n: 0, tronque: false });

const bornes = source(10);
await lireToutesLesPages(bornes.lirePage, 4, 10);
verifier("bornes des pages demandées", bornes.appels, [[0, 3], [4, 7], [8, 9], [10, 10]]);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
