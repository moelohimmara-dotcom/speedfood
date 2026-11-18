/**
 * « Mon dossier » du livreur (parité Kotlin, `DossierLivreur` et `LivreurCompteScreen`) : ce qui manque à son dossier d'activation, rien de plus.
 * Route DU SITE comme l'ancienne appli (`GET /api/v1/livreur/dossier`, créée pour la parité : elle n'existait ni sur le site ni dans l'API).
 * Seul l'ÉTAT de chaque pièce est lu (« à jour » ou « manquant ») : jamais un numéro de pièce, un nom ni un téléphone, et l'application n'en garde aucun.
 * Lecture STRICTE : un statut inconnu, une liste trop longue ou un texte hors limite rend la réponse illisible, jamais un dossier « complet » inventé.
 * `null` = ce compte n'est pas un compte livreur (réponse normale du serveur).
 */
export type StatutPiece = 'a_jour' | 'manquant';
export interface PieceDossier { code: string; libelle: string; statut: StatutPiece; explication: string }
export interface DossierLivreur { pieces: PieceDossier[]; message: string | null }

const PIECES_MAX = 10;
function invalide(): never { throw Error('DOSSIER_LIVREUR_ILLISIBLE'); }
function objet(x: unknown): Record<string, unknown> { if (!x || typeof x !== 'object' || Array.isArray(x)) return invalide(); return x as Record<string, unknown>; }
function texte(x: unknown, max: number): string { if (typeof x !== 'string' || x.length > max) return invalide(); return x; }

function lirePiece(x: unknown): PieceDossier {
  const o = objet(x);
  const statut = o.statut;
  if (statut !== 'a_jour' && statut !== 'manquant') return invalide();
  const libelle = texte(o.libelle, 120);
  if (libelle.trim() === '') return invalide();
  return { code: texte(o.code, 40), libelle, statut, explication: texte(o.explication, 300) };
}

export function lireDossierLivreur(v: Record<string, unknown>): DossierLivreur | null {
  if (v.ok !== true) return invalide();
  if (v.dossier === null) return null;
  const d = objet(v.dossier);
  if (!Array.isArray(d.pieces) || d.pieces.length > PIECES_MAX) return invalide();
  const message = d.message === null || d.message === undefined ? null : texte(d.message, 300);
  return { pieces: d.pieces.map(lirePiece), message };
}

/** Les pièces qui manquent encore. */
export const piecesManquantes = (d: DossierLivreur): PieceDossier[] => d.pieces.filter(p => p.statut !== 'a_jour');

/** Une phrase courte pour l'écran, mêmes mots que l'ancienne appli : ce qui manque, sans jamais montrer de document. */
export function resumeDossier(d: DossierLivreur): string {
  const m = piecesManquantes(d);
  if (m.length === 0) return 'Votre dossier est complet.';
  if (m.length === 1) return `Il manque 1 pièce : ${m[0].libelle}.`;
  return `Il manque ${m.length} pièces : ${m.map(p => p.libelle).join(', ')}.`;
}

export const TITRE_DOSSIER = 'Mon dossier';
export const MESSAGE_DOSSIER_ILLISIBLE = 'L’état de votre dossier n’a pas pu être vérifié pour l’instant.';
export const NOTE_DOSSIER = 'Votre dossier d’identité est réservé à l’équipe Speedfood : l’application ne montre que ce qui manque, jamais vos documents.';
/** Une pièce manquante sans explication du serveur : on dit quoi faire sans promettre un dépôt qui n'existe pas. */
export const EXPLICATION_PAR_DEFAUT = 'Contactez l’équipe Speedfood pour compléter cette pièce.';
/** Le dossier change peu : relu toutes les minutes tant que la rubrique est ouverte (comme l'ancienne appli). */
export const DELAI_RELECTURE_DOSSIER_MS = 60000;
