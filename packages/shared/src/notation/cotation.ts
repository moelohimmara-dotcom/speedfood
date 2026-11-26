/**
 * Cote Speedfood d'un restaurant : la note que le client VOIT. Fonction pure, sans réseau ni base. Inspirée de l'affichage des grandes places de marché (note sur 5, nombre d'avis, mentions
 * « 500+ », badges de confiance), avec trois ajouts propres à Speedfood :
 *  1. une cote LISSÉE : un restaurant qui a 5,0 sur 2 avis ne passe pas devant un restaurant qui a 4,8 sur 300 (la moyenne est tirée vers 4,2 avec le poids de 8 avis fictifs, qui s'efface à mesure
 *     que les vrais avis arrivent) ; la moyenne brute reste disponible ;
 *  2. une FIABILITÉ dite en clair (« nouveau », « en cours », « fiable ») : une cote sur 3 avis n'a pas la même valeur qu'une cote sur 300, et l'écran le montre ;
 *  3. la FRAÎCHEUR Speedfood : la part des plats dont la disponibilité a été confirmée récemment (c'est la promesse de la marque) donne le badge « Menu frais ».
 * Jamais de note inventée : sans avis, il n'y a pas de cote, seulement « Nouveau ».
 */
export type Fiabilite = "nouveau" | "en_cours" | "fiable";
export type Badge = "tres_apprecie" | "valeur_sure" | "nouveau" | "menu_frais";

export const MOYENNE_A_PRIORI = 4.2;
export const POIDS_A_PRIORI = 8;
export const AVIS_MIN_EN_COURS = 5;
export const AVIS_MIN_FIABLE = 30;
export const LIBELLES_BADGES: Record<Badge, string> = {
  tres_apprecie: "Très apprécié",
  valeur_sure: "Valeur sûre",
  nouveau: "Nouveau",
  menu_frais: "Menu frais",
};

export interface EntreeCotation {
  /** Somme des notes (1 à 5) et nombre d'avis, comme tenus par la base. */
  somme: number;
  total: number;
  /** Part (0 à 1) des plats disponibles dont la confirmation est récente ; `null` si inconnue. */
  fraicheur?: number | null;
  /** Nombre de plats pris en compte pour la fraîcheur. */
  nombrePlats?: number;
}
export interface Cotation {
  /** Cote lissée au dixième, ou `null` sans avis. */
  cote: number | null;
  /** Moyenne brute au dixième (formule historique), ou `null` sans avis. */
  moyenne: number | null;
  avis: number;
  fiabilite: Fiabilite;
  badges: Badge[];
}

const valide = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const dixieme = (n: number) => Math.round(n * 10) / 10;
const comptesPossibles = (somme: number, total: number) => valide(somme) && valide(total) && Number.isSafeInteger(total) && total > 0 && somme >= total && somme <= 5 * total;

export function fiabiliteDe(avis: number): Fiabilite {
  return avis < AVIS_MIN_EN_COURS ? "nouveau" : avis < AVIS_MIN_FIABLE ? "en_cours" : "fiable";
}

/** Cote lissée : moyenne bayésienne. `null` pour des comptes impossibles (jamais une cote hors de 1 à 5). */
export function coteLissee(somme: number, total: number): number | null {
  if (!comptesPossibles(somme, total)) return null;
  return dixieme((MOYENNE_A_PRIORI * POIDS_A_PRIORI + somme) / (POIDS_A_PRIORI + total));
}
export function moyenneBrute(somme: number, total: number): number | null {
  if (!comptesPossibles(somme, total)) return null;
  return Math.floor((somme * 10) / total) / 10;
}

export function cotation(e: EntreeCotation): Cotation {
  const avis = Number.isSafeInteger(e.total) && e.total > 0 ? e.total : 0;
  const cote = coteLissee(e.somme, e.total);
  const fiabilite = fiabiliteDe(avis);
  const badges: Badge[] = [];
  if (avis < AVIS_MIN_EN_COURS) badges.push("nouveau");
  if (cote !== null && cote >= 4.6 && avis >= AVIS_MIN_FIABLE) badges.push("tres_apprecie");
  else if (cote !== null && cote >= 4.3 && avis >= 100) badges.push("valeur_sure");
  if (valide(e.fraicheur) && e.fraicheur >= 0.9 && (e.nombrePlats ?? 0) >= 10) badges.push("menu_frais");
  return { cote, moyenne: moyenneBrute(e.somme, e.total), avis, fiabilite, badges };
}

/** « 4,6 ★ (200+) », « 4,8 ★ (500+) » ; « Nouveau » sous 5 avis (la cote existe mais n'est pas assez solide pour être montrée seule). */
export function libelleCote(c: Pick<Cotation, "cote" | "avis" | "fiabilite">): string | null {
  if (c.avis <= 0 || c.cote === null) return null;
  if (c.fiabilite === "nouveau") return "Nouveau";
  const n = c.avis >= 1000 ? "1000+" : c.avis >= 500 ? "500+" : c.avis >= 200 ? "200+" : c.avis >= 100 ? "100+" : String(c.avis);
  return `${String(c.cote).replace(".", ",")} ★ (${n})`;
}

/** Valeur de classement : la cote lissée, ou la moyenne a priori (jamais mieux ni moins bien qu'un restaurant « moyen ») quand il n'y a pas d'avis. */
export function valeurDeClassement(c: Pick<Cotation, "cote">): number {
  return c.cote ?? MOYENNE_A_PRIORI;
}
