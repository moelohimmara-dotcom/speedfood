/**
 * Saisie rapide du menu, SANS dépendance (testable seule) : dictée vocale, prix en boutons, liste collée.
 *
 * Tout se fait dans le navigateur ou avec des règles simples : aucun service d'IA, aucun coût. La reconnaissance vocale
 * elle-même est celle du navigateur (facultative) ; ce fichier ne fait que comprendre la phrase obtenue.
 */

export const PRIX_RAPIDES = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000] as const;

export const PLATS_MAX_PAR_LISTE = 30;
export const NOM_PLAT_MAX = 120;
export const PRIX_MAX_PAR_DEFAUT = 5_000_000;

const UNITES: Record<string, number> = {
  zero: 0, zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};
const MOTS_MONNAIE = new Set(["franc", "francs", "gnf", "fg", "guinéen", "guinéens", "guineen", "guineens"]);

function sansAccentsMinuscule(t: string): string {
  return t.toLowerCase();
}

/** « 25 000 », « 25.000 », « 25,000 » : les séparateurs de milliers sont retirés avant tout calcul. */
function recollerMilliers(texte: string): string {
  let t = texte;
  for (let i = 0; i < 3; i++) t = t.replace(/(\d)[\s  .,](\d{3})(?!\d)/g, "$1$2");
  return t;
}

/** Nombre écrit en lettres françaises ou en chiffres (jusqu'à 999 999), ou null si la suite de mots n'en est pas un. */
export function nombreDepuisMots(jetons: string[]): number | null {
  const mots: string[] = [];
  for (let i = 0; i < jetons.length; i++) {
    const m = sansAccentsMinuscule(jetons[i]);
    if (m === "quatre" && (sansAccentsMinuscule(jetons[i + 1] ?? "") === "vingt" || sansAccentsMinuscule(jetons[i + 1] ?? "") === "vingts")) {
      mots.push("80");
      i++;
      continue;
    }
    mots.push(m);
  }
  let total = 0;
  let courant = 0;
  let vu = false;
  let milleVu = false;
  for (const m of mots) {
    if (m === "et" || m === "-") continue;
    if (/^\d+$/.test(m)) {
      courant += Number(m);
      vu = true;
    } else if (m in UNITES) {
      courant += UNITES[m];
      vu = true;
    } else if (m === "cent" || m === "cents") {
      courant = (courant === 0 ? 1 : courant) * 100;
      vu = true;
    } else if (m === "mille") {
      if (milleVu) return null;
      milleVu = true;
      total += (courant === 0 ? 1 : courant) * 1000;
      courant = 0;
      vu = true;
    } else {
      return null;
    }
  }
  if (!vu) return null;
  const valeur = total + courant;
  return Number.isFinite(valeur) && valeur <= 999_999 ? valeur : null;
}

function estMotDeNombre(m: string): boolean {
  const x = sansAccentsMinuscule(m);
  return /^\d+$/.test(x) || x in UNITES || x === "cent" || x === "cents" || x === "mille" || x === "et" || x === "quatre-vingt" || x === "quatre-vingts";
}

export interface PlatDicte {
  nom: string;
  prix: number | null;
}

/**
 * Comprend une phrase dictée : « attiéké poisson vingt-cinq mille francs » → { nom: « Attiéké poisson », prix: 25000 }.
 * Le prix est la plus longue suite de mots-nombres en fin de phrase (monnaie finale ignorée) ; sans prix, tout est le nom.
 */
export function interpreterDictee(phrase: string): PlatDicte {
  const nettoyee = recollerMilliers(phrase.replace(/[,;:!?]+$/g, "").trim());
  const jetons = nettoyee
    .split(/[\s]+/)
    .flatMap((j) => (/^\p{L}+(-\p{L}+)+$/u.test(j) && j.split("-").every((p) => estMotDeNombre(p)) ? j.split("-") : [j]))
    .filter(Boolean);
  while (jetons.length > 0 && MOTS_MONNAIE.has(sansAccentsMinuscule(jetons[jetons.length - 1]))) jetons.pop();
  let debut = jetons.length;
  while (debut > 0 && estMotDeNombre(jetons[debut - 1])) debut--;
  // Un « et » en tête de la suite n'appartient pas au nombre.
  while (debut < jetons.length && sansAccentsMinuscule(jetons[debut]) === "et") debut++;
  const suite = jetons.slice(debut);
  const prix = suite.length > 0 ? nombreDepuisMots(suite) : null;
  const nomJetons = prix === null ? jetons : jetons.slice(0, debut);
  const nom = nomJetons.join(" ").trim();
  return { nom: nom ? nom.charAt(0).toUpperCase() + nom.slice(1) : "", prix: prix !== null && prix > 0 ? prix : null };
}

export interface LignePlat {
  nom: string;
  prix: number;
}
export interface LigneIgnoree {
  ligne: string;
  raison: string;
}

/**
 * Comprend une liste collée (par exemple copiée depuis WhatsApp) : une ligne par plat, le prix à la fin.
 * Acceptés : « Riz sauce feuille 25000 », « Riz sauce feuille - 25 000 GNF », « 2. Poulet braisé : 40.000 », « Jus 5k ».
 */
export function lirePlatsEnLot(texte: string, prixMax: number = PRIX_MAX_PAR_DEFAUT): { plats: LignePlat[]; ignorees: LigneIgnoree[] } {
  const plats: LignePlat[] = [];
  const ignorees: LigneIgnoree[] = [];
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    if (plats.length >= PLATS_MAX_PAR_LISTE) {
      ignorees.push({ ligne, raison: `Au plus ${PLATS_MAX_PAR_LISTE} plats à la fois` });
      continue;
    }
    const sansPuce = recollerMilliers(ligne.replace(/^\s*(?:[-•*·]+|\d{1,2}[.)])\s+/, ""));
    const m = sansPuce.match(/^(.*?)[\s:=\-–—]*?(\d+(?:[.,]\d+)?)\s*(k|mille)?\s*(?:gnf|fg|francs?)?\s*$/i);
    if (!m) {
      ignorees.push({ ligne, raison: "Pas de prix reconnu" });
      continue;
    }
    let nom = m[1].replace(/[\s:=\-–—.]+$/g, "").trim();
    const brutPrix = m[2].replace(",", ".");
    const multiplicateur = m[3] ? 1000 : 1;
    const prix = Math.round(Number(brutPrix) * multiplicateur);
    if (!nom) {
      ignorees.push({ ligne, raison: "Pas de nom" });
      continue;
    }
    if (nom.length > NOM_PLAT_MAX) nom = nom.slice(0, NOM_PLAT_MAX).trim();
    if (!Number.isInteger(prix) || prix < 0 || prix > prixMax) {
      ignorees.push({ ligne, raison: `Prix hors limites (0 à ${prixMax.toLocaleString("fr-FR")} GNF)` });
      continue;
    }
    plats.push({ nom: nom.charAt(0).toUpperCase() + nom.slice(1), prix });
  }
  return { plats, ignorees };
}
