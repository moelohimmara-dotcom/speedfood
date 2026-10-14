/**
 * Rubriques du site public (direction B, 4 octobre 2026). Une seule liste alimente l'en-tête, le tiroir du téléphone et le
 * pied de page ; `actif` dit si un chemin appartient à la rubrique (l'accueil ne l'est que pour `/` exactement).
 */
export interface Rubrique {
  cle: string;
  href: string;
  libelle: string;
  /** Préfixe de chemin qui active la rubrique ; `null` = chemin exact. */
  prefixe: string | null;
}

export const RUBRIQUES: readonly Rubrique[] = [
  { cle: "accueil", href: "/", libelle: "Accueil", prefixe: null },
  { cle: "restaurants", href: "/restaurants", libelle: "Restaurants", prefixe: "/restaurants" },
  { cle: "comment", href: "/comment-ca-marche", libelle: "Comment ça marche", prefixe: "/comment-ca-marche" },
  { cle: "quartiers", href: "/quartiers", libelle: "Quartiers", prefixe: "/quartiers" },
  { cle: "restaurateurs", href: "/devenir-partenaire", libelle: "Restaurateurs", prefixe: "/devenir-partenaire" },
  { cle: "aide", href: "/aide", libelle: "Aide", prefixe: "/aide" },
];

export function rubriqueActive(r: Rubrique, chemin: string): boolean {
  return r.prefixe === null ? chemin === r.href : chemin === r.prefixe || chemin.startsWith(`${r.prefixe}/`);
}
