/**
 * Recherche rapide des consoles (refonte, phase 3) : logique pure, sans React, testée dans `scripts/tests/console.test.mts`.
 * La liste d'entrées vient du serveur et est DÉJÀ filtrée par permission (`groupesNavPourRole`) : cette fonction ne décide d'aucun droit.
 */

export interface EntreeRecherche {
  libelle: string;
  famille: string;
  href: string;
}

/** Minuscules, sans accents ni ligatures courantes, espaces normalisés : « Bannières » et « bannieres » se valent. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const RESULTATS_MAX = 8;

/**
 * Entrées correspondant à la requête, les meilleures d'abord : libellé qui commence par la requête, puis un mot du libellé qui commence
 * par elle, puis libellé qui la contient, puis famille. Requête vide : les premières entrées, dans l'ordre reçu. Tous les mots de la
 * requête doivent se retrouver (libellé + famille).
 */
export function filtrerEntrees(entrees: readonly EntreeRecherche[], requete: string, max: number = RESULTATS_MAX): EntreeRecherche[] {
  const q = normaliser(requete);
  if (q === "") return entrees.slice(0, max);
  const mots = q.split(" ");
  const notees: { entree: EntreeRecherche; score: number; rang: number }[] = [];
  entrees.forEach((entree, rang) => {
    const libelle = normaliser(entree.libelle);
    const famille = normaliser(entree.famille);
    const ensemble = `${libelle} ${famille}`;
    if (!mots.every((m) => ensemble.includes(m))) return;
    let score = 3;
    if (libelle.startsWith(q)) score = 0;
    else if (libelle.split(" ").some((m) => m.startsWith(q))) score = 1;
    else if (libelle.includes(q)) score = 2;
    notees.push({ entree, score, rang });
  });
  notees.sort((a, b) => a.score - b.score || a.rang - b.rang);
  return notees.slice(0, max).map((n) => n.entree);
}
