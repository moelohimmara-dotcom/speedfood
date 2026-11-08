/** Fiche propre au compte : aucune course, position ou donnée de client. */
export const STATUTS_FICHE_LIVREUR = ['hors_ligne', 'disponible', 'en_course'] as const;
export const VEHICULES_FICHE_LIVREUR = ['moto', 'velo', 'voiture', 'pied'] as const;
export const CYCLES_FICHE_LIVREUR = ['cree', 'invite', 'candidat', 'actif', 'suspendu', 'archive'] as const;
export interface FicheLivreur {
  nom: string;
  statut: typeof STATUTS_FICHE_LIVREUR[number];
  vehicule: typeof VEHICULES_FICHE_LIVREUR[number];
  cycle: typeof CYCLES_FICHE_LIVREUR[number];
  motifCycle: string | null;
  restaurantNom: string | null;
}
function invalide(): never { throw new Error('FICHE_LIVREUR_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f\u007f]/.test(v)) return invalide(); return v; }
function option(v: unknown, max: number): string | null { return v === null ? null : texte(v, max); }
function choix<T extends string>(v: unknown, valeurs: readonly T[]): T { if (typeof v !== 'string' || !valeurs.includes(v as T)) return invalide(); return v as T; }
/** Projection stricte : les champs supplémentaires ne sont jamais repris dans le résultat. */
export function projeterFicheLivreur(v: unknown): FicheLivreur {
  const o = objet(v);
  return { nom: texte(o.nom, 80), statut: choix(o.statut, STATUTS_FICHE_LIVREUR), vehicule: choix(o.vehicule, VEHICULES_FICHE_LIVREUR), cycle: choix(o.cycle, CYCLES_FICHE_LIVREUR), motifCycle: option(o.motifCycle, 300), restaurantNom: option(o.restaurantNom, 256) };
}
export function lireReponseFicheLivreur(v: unknown): FicheLivreur | null {
  const o = objet(v);
  if (o.ok !== true || !Object.hasOwn(o, 'fiche')) return invalide();
  return o.fiche === null ? null : projeterFicheLivreur(o.fiche);
}
