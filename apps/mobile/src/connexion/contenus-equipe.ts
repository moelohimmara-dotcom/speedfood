/**
 * Avis, bannières, médias et paramètres vus par l'équipe (parité Kotlin, lot 7, lignes E8, E9, E10) : routes DU SITE.
 * Avis : signalements à examiner et alertes de qualité ; la modération exige un motif pour retirer du contenu public (tracé par le serveur).
 * Bannières et médias : LECTURE SEULE — créer, publier ou supprimer une bannière change ce que voit le public, cela reste sur le site.
 * Paramètres : LECTURE SEULE aussi (réservés au super administrateur côté serveur) ; les modifier reste sur le site.
 */
export interface SignalementEquipe {
  id: string; avisId: string; motif: string; date: string; restaurantNom: string; note: number; commentaire: string | null; statutAvis: string;
}
export type TypeAlerteAvis = 'restaurant_sous_seuil' | 'livreur_sous_seuil' | 'livreur_trois_mauvaises';
export interface AlerteAvisEquipe { type: TypeAlerteAvis; cible: string; detail: string }
export interface AvisEquipe { signalements: SignalementEquipe[]; alertes: AlerteAvisEquipe[]; illisibles: number }

export const ACTIONS_MODERATION_EQUIPE: readonly string[] = ['masquer_commentaire', 'annuler_note', 'retablir', 'classer_sans_suite'];
export type ActionModerationEquipe = 'masquer_commentaire' | 'annuler_note' | 'retablir' | 'classer_sans_suite';
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export interface BanniereEquipe {
  id: string; titre: string; texte: string; lien: string | null; statut: 'publie' | 'brouillon'; ordre: number;
  imageUrl: string | null; creeLe: string; misAJourLe: string;
}
export interface ParametresEquipe {
  commandePropositionDelaiMinutes: number; prixPlatMaxGnf: number; disponibiliteFraicheurHeures: number; conservationCoordonneesJours: number;
  conservationNonClotureeJours: number; conservationAuditMois: number; whatsappAssistance: string; delaiValidationHeures: number | null;
  positionCarteActive: boolean; promesseSignature: string; promesseSousTitre: string; promessePartage: string;
  connexionFacebookActive: boolean; connexionGoogleActive: boolean;
}

function invalide(): never { throw Error('CONTENUS_EQUIPE_ILLISIBLES'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function texteNonVide(v: unknown, max: number): string { const s = texte(v, max); if (s.length === 0) return invalide(); return s; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function entier(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) return invalide(); return v; }
function identifiant(v: unknown): string { const s = texte(v, 36); if (!UUID.test(s)) return invalide(); return s; }
function dateTexte(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }

const TYPES_ALERTE: readonly TypeAlerteAvis[] = ['restaurant_sous_seuil', 'livreur_sous_seuil', 'livreur_trois_mauvaises'];
export function lireAvisEquipe(v: Record<string, unknown>): AvisEquipe {
  if (v.ok !== true || !Array.isArray(v.signalements) || v.signalements.length > 200 || !Array.isArray(v.alertes) || v.alertes.length > 500) return invalide();
  const signalements: SignalementEquipe[] = []; const alertes: AlerteAvisEquipe[] = []; let illisibles = 0;
  for (const x of v.signalements) {
    try {
      const o = objet(x);
      signalements.push({
        id: identifiant(o.id), avisId: identifiant(o.avisId), motif: texteNonVide(o.motif, 300), date: dateTexte(o.date),
        restaurantNom: texte(o.restaurantNom, 200), note: entier(o.note, 0, 5), commentaire: texteOuNull(o.commentaire, 2000), statutAvis: texteNonVide(o.statutAvis, 40),
      });
    } catch { illisibles++; }
  }
  for (const x of v.alertes) {
    try {
      const o = objet(x);
      if (typeof o.type !== 'string' || !(TYPES_ALERTE as readonly string[]).includes(o.type)) return invalide();
      alertes.push({ type: o.type as TypeAlerteAvis, cible: texteNonVide(o.cible, 200), detail: texte(o.detail, 300) });
    } catch { illisibles++; }
  }
  return { signalements, alertes, illisibles };
}
export function libelleAlerteAvis(type: TypeAlerteAvis): string {
  if (type === 'restaurant_sous_seuil') return 'Restaurant sous le seuil de qualité';
  if (type === 'livreur_sous_seuil') return 'Livreur sous le seuil de qualité';
  return 'Livreur : trois mauvaises notes de suite';
}
/** Un motif est exigé pour retirer du contenu public (masquer, annuler) ; rétablir ou classer n'en demande pas. */
export function motifModerationRequis(action: string): boolean { return action === 'masquer_commentaire' || action === 'annuler_note'; }
/** Corps d'une décision de modération, ou `null` si elle est invalide (motif de 5 à 300 caractères quand il est exigé). */
export function preparerModeration(avisId: string, action: string, motifBrut?: string): { avisId: string; action: ActionModerationEquipe; motif: string } | null {
  if (!UUID.test(avisId) || !(ACTIONS_MODERATION_EQUIPE as readonly string[]).includes(action)) return null;
  const motif = typeof motifBrut === 'string' ? motifBrut.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (motifModerationRequis(action) && motif.length < 5) return null;
  return { avisId, action: action as ActionModerationEquipe, motif };
}

export function lireBannieresEquipe(v: Record<string, unknown>): { bannieres: BanniereEquipe[]; tronque: boolean; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.bannieres) || v.bannieres.length > 500 || typeof v.tronque !== 'boolean') return invalide();
  const bannieres: BanniereEquipe[] = []; let illisibles = 0;
  for (const x of v.bannieres) {
    try {
      const o = objet(x);
      if (o.statut !== 'publie' && o.statut !== 'brouillon') return invalide();
      bannieres.push({
        id: identifiant(o.id), titre: texteNonVide(o.titre, 200), texte: texte(o.texte, 2000), lien: texteOuNull(o.lien, 500),
        statut: o.statut, ordre: entier(o.ordre, 0, 100000), imageUrl: texteOuNull(o.imageUrl, 1000), creeLe: dateTexte(o.creeLe), misAJourLe: dateTexte(o.misAJourLe),
      });
    } catch { illisibles++; }
  }
  return { bannieres, tronque: v.tronque, illisibles };
}

const CLES_PARAMETRES: ReadonlyArray<keyof ParametresEquipe> = [
  'commandePropositionDelaiMinutes', 'prixPlatMaxGnf', 'disponibiliteFraicheurHeures', 'conservationCoordonneesJours',
  'conservationNonClotureeJours', 'conservationAuditMois', 'whatsappAssistance', 'delaiValidationHeures',
  'positionCarteActive', 'promesseSignature', 'promesseSousTitre', 'promessePartage', 'connexionFacebookActive', 'connexionGoogleActive',
];
export function lireParametresEquipe(v: Record<string, unknown>): ParametresEquipe {
  if (v.ok !== true) return invalide();
  const p = objet(v.parametres);
  for (const cle of CLES_PARAMETRES) if (!(cle in p)) return invalide();
  return {
    commandePropositionDelaiMinutes: entier(p.commandePropositionDelaiMinutes, 0, 10080),
    prixPlatMaxGnf: entier(p.prixPlatMaxGnf, 0, 100_000_000),
    disponibiliteFraicheurHeures: entier(p.disponibiliteFraicheurHeures, 0, 8760),
    conservationCoordonneesJours: entier(p.conservationCoordonneesJours, 0, 3650),
    conservationNonClotureeJours: entier(p.conservationNonClotureeJours, 0, 3650),
    conservationAuditMois: entier(p.conservationAuditMois, 0, 120),
    whatsappAssistance: texte(p.whatsappAssistance, 60),
    delaiValidationHeures: p.delaiValidationHeures === null ? null : entier(p.delaiValidationHeures, 0, 8760),
    positionCarteActive: booleen(p.positionCarteActive),
    promesseSignature: texte(p.promesseSignature, 200), promesseSousTitre: texte(p.promesseSousTitre, 300), promessePartage: texte(p.promessePartage, 300),
    connexionFacebookActive: booleen(p.connexionFacebookActive), connexionGoogleActive: booleen(p.connexionGoogleActive),
  };
}
