// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/TEXTES-SITE.md.

/**
 * Aperçu en direct des textes du site. L'éditeur (console) affiche la VRAIE page d'accueil dans un cadre de même origine ; un petit pont
 * côté page (`ApercuTextesPont`) remplace à la volée, dans le DOM du cadre, les textes en cours de saisie. Aucun autre rendu à maintenir :
 * l'aperçu est toujours fidèle à la page réelle.
 *
 * Le pont reconnaît un texte par sa valeur EN LIGNE (enregistrée, ou défaut) : si deux emplacements ont exactement le même texte en ligne,
 * ils bougent ensemble dans l'aperçu (sans effet sur ce qui est enregistré).
 */

export const MESSAGE_TEXTES = "sf-textes";
export const MESSAGE_ALLER = "sf-aller";
export const MESSAGE_PRET = "sf-pret";

export type Remplacements = Record<string, string>;

export interface ChampApercu {
  /** Texte actuellement en ligne pour cet emplacement. */
  enLigne: string;
  /** Texte en cours de saisie. */
  saisie: string;
}

/** Table « texte en ligne → texte saisi » pour les seuls champs réellement changés et non vides. */
export function construireRemplacements(champs: readonly ChampApercu[]): Remplacements {
  const table: Remplacements = Object.create(null);
  for (const c of champs) {
    const ancien = c.enLigne.trim();
    const nouveau = c.saisie.trim();
    // Un champ vidé retombe sur le défaut au moment d'enregistrer : l'aperçu garde le texte en ligne.
    if (ancien === "" || nouveau === "" || ancien === nouveau) continue;
    table[ancien] = nouveau;
  }
  return table;
}

/** Applique la table à un texte du DOM en conservant ses espaces de début et de fin (les nœuds texte en portent souvent un). */
export function appliquerAuTexte(original: string, table: Remplacements): string {
  const coeur = original.trim();
  if (coeur === "" || !Object.prototype.hasOwnProperty.call(table, coeur)) return original;
  const debut = original.slice(0, original.indexOf(coeur));
  const fin = original.slice(original.indexOf(coeur) + coeur.length);
  return debut + table[coeur] + fin;
}

export type MessageApercu =
  | { type: typeof MESSAGE_TEXTES; remplacements: Remplacements }
  | { type: typeof MESSAGE_ALLER; texte: string };

const LONGUEUR_MAX_TEXTE = 1000;
const NOMBRE_MAX_REMPLACEMENTS = 200;

/** Valide un message reçu : forme stricte, tailles bornées, rien d'autre n'est interprété. */
export function lireMessageApercu(donnees: unknown): MessageApercu | null {
  if (!donnees || typeof donnees !== "object") return null;
  const m = donnees as Record<string, unknown>;
  if (m.type === MESSAGE_ALLER) {
    return typeof m.texte === "string" && m.texte.length <= LONGUEUR_MAX_TEXTE ? { type: MESSAGE_ALLER, texte: m.texte } : null;
  }
  if (m.type === MESSAGE_TEXTES) {
    const r = m.remplacements;
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const entrees = Object.entries(r as Record<string, unknown>);
    if (entrees.length > NOMBRE_MAX_REMPLACEMENTS) return null;
    const table: Remplacements = Object.create(null);
    for (const [cle, valeur] of entrees) {
      if (typeof valeur !== "string" || cle.length > LONGUEUR_MAX_TEXTE || valeur.length > LONGUEUR_MAX_TEXTE) return null;
      table[cle] = valeur;
    }
    return { type: MESSAGE_TEXTES, remplacements: table };
  }
  return null;
}

// ---------------------------------------------------------------- éditeur : état des champs

export interface EtatChamp {
  cle: string;
  groupe: string;
  libelle: string;
  defaut: string;
  /** Texte enregistré en ligne (surcharge, ou défaut). */
  enLigne: string;
  /** Une surcharge existe (le texte diffère du défaut). */
  personnalise: boolean;
  saisie: string;
}

/** Le champ a une modification non enregistrée. La comparaison ignore les espaces de début et de fin (le serveur les retire). */
export function estNonEnregistre(c: Pick<EtatChamp, "enLigne" | "saisie">): boolean {
  return c.saisie.trim() !== c.enLigne.trim();
}

export type FiltreChamps = "tous" | "personnalises" | "non_enregistres";

function normaliser(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Recherche sans accents ni casse dans le libellé, le texte saisi, le défaut et la clé. */
export function correspondA(c: EtatChamp, recherche: string): boolean {
  const q = normaliser(recherche.trim());
  if (q === "") return true;
  return [c.libelle, c.saisie, c.defaut, c.cle].some((t) => normaliser(t).includes(q));
}

export function filtrerChamps(champs: readonly EtatChamp[], recherche: string, filtre: FiltreChamps): EtatChamp[] {
  return champs.filter((c) => {
    if (filtre === "personnalises" && !c.personnalise) return false;
    if (filtre === "non_enregistres" && !estNonEnregistre(c)) return false;
    return correspondA(c, recherche);
  });
}

export interface ResumeGroupe {
  nom: string;
  total: number;
  personnalises: number;
  nonEnregistres: number;
}

export function resumerGroupes(champs: readonly EtatChamp[]): ResumeGroupe[] {
  const ordre: string[] = [];
  const parNom = new Map<string, ResumeGroupe>();
  for (const c of champs) {
    let g = parNom.get(c.groupe);
    if (!g) {
      g = { nom: c.groupe, total: 0, personnalises: 0, nonEnregistres: 0 };
      parNom.set(c.groupe, g);
      ordre.push(c.groupe);
    }
    g.total += 1;
    if (c.personnalise) g.personnalises += 1;
    if (estNonEnregistre(c)) g.nonEnregistres += 1;
  }
  return ordre.map((n) => parNom.get(n) as ResumeGroupe);
}

/** Niveau du compteur de longueur : « ok » jusqu'à 90 % de la limite, « proche » ensuite, « depasse » au-delà. */
export function niveauCompteur(longueur: number, max: number): "ok" | "proche" | "depasse" {
  if (longueur > max) return "depasse";
  return longueur >= Math.ceil(max * 0.9) ? "proche" : "ok";
}
