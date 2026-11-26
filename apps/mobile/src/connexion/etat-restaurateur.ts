/**
 * État de publication du restaurant (`GET /api/v1/restaurant/etat`, écart relevé le 18/11/2026) : publié ou non, suspendu ou non, et la correction demandée par
 * l'équipe avant publication, comme le bandeau de la console du site. Lecture seule.
 * Même discipline que le reste de l'espace restaurateur : lecture stricte (un champ invalide refuse toute la réponse, jamais un état inventé), aucun identifiant de
 * restaurant retenu. Le MOTIF d'une suspension n'est ni envoyé ni lu : la console du site ne le montre pas au restaurateur.
 */
export interface EtatPublication { publie: boolean; suspendu: boolean; correctionDemandee: boolean; motifCorrection: string | null }

/** Les motifs de la base sont bornés à 1000 caractères. */
const MOTIF_MAX = 1000;

function invalide(): never { throw Error('ETAT_RESTAURATEUR_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
/** Un motif peut contenir des retours à la ligne et des tabulations ; aucun autre caractère de contrôle. */
function motifOuNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.length > MOTIF_MAX || /[\x00-\x08\x0b-\x1f\x7f]/.test(v)) return invalide();
  const s = v.trim();
  return s === '' ? null : s;
}

export function lireEtatPublication(v: Record<string, unknown>): EtatPublication {
  if (v.ok !== true) return invalide();
  const e = objet(v.etat);
  const correctionDemandee = booleen(e.correctionDemandee);
  const motif = motifOuNull(e.motifCorrection);
  // Un texte de correction sans correction demandée est incohérent : on le refuse plutôt que de l'afficher.
  if (!correctionDemandee && motif !== null) return invalide();
  return { publie: booleen(e.publie), suspendu: booleen(e.suspendu), correctionDemandee, motifCorrection: motif };
}

export const MESSAGE_SUSPENDU = 'Votre restaurant est suspendu : les clients ne le voient plus. Contactez l’équipe Speedfood pour savoir quoi faire.';
export const PREFIXE_CORRECTION = 'Une correction est demandée avant publication :';
export const MESSAGE_CORRECTION_SANS_TEXTE = 'Une correction est demandée avant publication. Le détail n’a pas pu être lu : actualisez ou ouvrez Speedfood sur le site.';
export const MESSAGE_NON_PUBLIE = 'Votre restaurant n’est pas encore visible au catalogue. Une personne de l’équipe Speedfood doit d’abord le valider.';
export const MESSAGE_ETAT_ILLISIBLE = 'L’état de publication de votre restaurant n’a pas pu être lu pour l’instant.';

/**
 * Ce que l'écran affiche, ou `null` quand tout va bien (publié, rien à corriger). Une suspension passe avant une correction ; une correction passe avant « pas encore visible »
 * (même ordre que la console du site).
 */
export function messagePublication(e: EtatPublication): string | null {
  if (e.suspendu) return MESSAGE_SUSPENDU;
  if (e.correctionDemandee) return e.motifCorrection !== null ? PREFIXE_CORRECTION + ' ' + e.motifCorrection : MESSAGE_CORRECTION_SANS_TEXTE;
  if (!e.publie) return MESSAGE_NON_PUBLIE;
  return null;
}
