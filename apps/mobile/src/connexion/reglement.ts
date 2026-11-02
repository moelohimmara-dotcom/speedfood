import { LIBELLES_MODE, libelleStatutPaiement, lireReferencePaiement, paiementOuvert, peutDeclarer, type StatutPaiement } from '../../../../packages/shared/src/paiement/regles.ts';

/**
 * Domaine pur du lot C : déclaration du règlement après acceptation par le restaurant.
 * Speedfood ne reçoit jamais l'argent : le client règle le restaurant (code marchand Orange Money / MTN MoMo, ou espèces), DÉCLARE, puis le restaurateur CONFIRME.
 * Les règles (ouverture, référence, libellés) sont celles du serveur, importées de `packages/shared` ; aucun paiement en ligne n'est géré ici.
 */
export type ModeReglement = 'especes' | 'orange_money' | 'mtn_momo';
export const MODES_REGLEMENT: readonly ModeReglement[] = ['especes', 'orange_money', 'mtn_momo'];
const STATUTS: readonly StatutPaiement[] = ['non_demande', 'especes', 'declare', 'recu', 'non_recu'];
const ETATS_EN_LIGNE = ['cree', 'en_attente', 'confirme', 'libere', 'echoue', 'expire', 'annule', 'rembourse', 'en_litige'] as const;
/** États d'un paiement en ligne qui interdisent une déclaration manuelle (même liste que le serveur : l'argent serait compté deux fois). */
const EN_LIGNE_ACTIF: readonly string[] = ['cree', 'en_attente', 'confirme', 'libere', 'en_litige'];

export interface OptionReglement { mode: ModeReglement; libelle: string; code: string | null }
export interface ReglementSuivi {
  statut: StatutPaiement;
  mode: ModeReglement | 'speedfood' | null;
  reference: string | null;
  declareLe: string | null;
  recuLe: string | null;
  options: OptionReglement[];
  /** État du paiement en ligne (jamais utilisé pour payer : seulement pour refuser une déclaration en double). `disponible` est ignoré. */
  enLigneEtat: string | null;
}

function invalide(): never { throw Error('LECTURE_REGLEMENT_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texteOuNull(v: unknown, max: number): string | null { if (v === null) return null; if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function dateOuNull(v: unknown): string | null { const t = texteOuNull(v, 40); if (t !== null && !Number.isFinite(Date.parse(t))) return invalide(); return t; }

/** Lecture STRICTE du bloc `paiement` du suivi : toute valeur inconnue (statut, mode, état en ligne, option) lève ; l'appelant refuse alors d'afficher le règlement. */
export function lireReglement(v: unknown): ReglementSuivi {
  const o = objet(v);
  if (typeof o.statut !== 'string' || !(STATUTS as readonly string[]).includes(o.statut)) return invalide();
  const mode = o.mode === null ? null : o.mode;
  if (mode !== null && mode !== 'speedfood' && !(MODES_REGLEMENT as readonly unknown[]).includes(mode)) return invalide();
  if (!Array.isArray(o.options) || o.options.length > 3) return invalide();
  const vus = new Set<string>();
  const options = o.options.map((x): OptionReglement => {
    const p = objet(x);
    if (!(MODES_REGLEMENT as readonly unknown[]).includes(p.mode)) return invalide();
    const m = p.mode as ModeReglement;
    if (vus.has(m)) return invalide(); vus.add(m);
    const code = texteOuNull(p.code, 20);
    if (m === 'especes' ? code !== null : (code === null || !/^[0-9A-Za-z]{3,20}$/.test(code))) return invalide();
    return { mode: m, libelle: LIBELLES_MODE[m], code };
  });
  const enLigne = objet(o.enLigne);
  if (enLigne.etat !== null && !(ETATS_EN_LIGNE as readonly unknown[]).includes(enLigne.etat)) return invalide();
  return { statut: o.statut as StatutPaiement, mode: mode as ReglementSuivi['mode'], reference: texteOuNull(o.reference, 80), declareLe: dateOuNull(o.declareLe), recuLe: dateOuNull(o.recuLe), options, enLigneEtat: enLigne.etat as string | null };
}
/** Lecture tolérante pour le suivi : bloc absent ou illisible = `null` (le règlement n'est alors pas affiché, le reste du suivi l'est). */
export function lireReglementOuNull(v: unknown): ReglementSuivi | null { if (v === undefined) return null; try { return lireReglement(v); } catch { return null; } }

export type ActionReglement =
  | { genre: 'rien'; message: string | null }
  | { genre: 'indisponible'; message: string }
  | { genre: 'declarer' | 'modifier'; message: string; options: OptionReglement[] };

/** Que peut faire le client ? Mêmes conditions que le serveur : commande acceptée sans proposition en cours, pas déjà confirmé, pas de paiement en ligne actif, mode proposé. */
export function actionReglement(e: { statutCommande: string; propositionActive: boolean; paiement: ReglementSuivi | null }): ActionReglement {
  if (!paiementOuvert(e.statutCommande, e.propositionActive)) {
    if (e.statutCommande === 'en_attente') return { genre: 'rien', message: 'Le règlement s’ouvre quand le restaurant a accepté votre commande. Ne payez rien avant.' };
    if (e.propositionActive && ['acceptee', 'prete', 'terminee'].includes(e.statutCommande)) return { genre: 'rien', message: 'Le restaurant a proposé une modification : répondez-y avant de régler.' };
    return { genre: 'rien', message: null };
  }
  const p = e.paiement;
  if (p === null) return { genre: 'indisponible', message: 'Le règlement ne peut pas être affiché dans cette version de l’application. Déclarez-le depuis le site.' };
  if (!peutDeclarer(p.statut)) return { genre: 'rien', message: libelleStatutPaiement(p.statut, p.mode) };
  if (p.mode === 'speedfood' || (p.enLigneEtat !== null && EN_LIGNE_ACTIF.includes(p.enLigneEtat))) return { genre: 'rien', message: 'Un paiement en ligne est en cours pour cette commande. Terminez-le depuis le site.' };
  if (p.options.length === 0) return { genre: 'rien', message: 'Le restaurant n’a indiqué aucun mode de règlement. Contactez-le.' };
  if (p.statut === 'non_demande') return { genre: 'declarer', message: 'Réglez le restaurant avec l’un des modes ci-dessous, puis déclarez-le ici.', options: p.options };
  return { genre: 'modifier', message: libelleStatutPaiement(p.statut, p.mode) + '. Vous pouvez corriger votre déclaration tant que le restaurant n’a pas confirmé.', options: p.options };
}

export type PreparationDeclaration = { ok: true; mode: ModeReglement; reference: string | null } | { ok: false; message: string };
/** Contrôle côté client avant envoi : mode proposé par ce restaurant, référence 4 à 40 caractères simples (mobile money seulement, jamais pour les espèces). */
export function preparerDeclaration(mode: string, referenceBrute: string, options: readonly OptionReglement[]): PreparationDeclaration {
  if (!options.some(o => o.mode === mode)) return { ok: false, message: 'Ce mode de règlement n’est pas proposé par ce restaurant.' };
  if (mode === 'especes') return { ok: true, mode, reference: null };
  const r = lireReferencePaiement(referenceBrute.slice(0, 80));
  if (!r.ok) return { ok: false, message: 'La référence contient 4 à 40 lettres, chiffres, points ou tirets.' };
  return { ok: true, mode: mode as ModeReglement, reference: r.valeur };
}

export type GenreErreurReglement = 'refus' | 'limite' | 'serveur' | 'reseau' | 'reponse_invalide';
/** Erreur de déclaration. `incertain` : la déclaration a pu être enregistrée ; relire le suivi avant de proposer de réessayer. Le jeton n'y figure jamais. */
export class ErreurReglement extends Error {
  genre: GenreErreurReglement; incertain: boolean;
  constructor(genre: GenreErreurReglement, message: string, incertain = false) { super(message); this.name = 'ErreurReglement'; this.genre = genre; this.incertain = incertain; }
}
/** Table des refus du serveur : statut HTTP vers un message français fixe. Aucun texte brut du serveur n'est affiché. */
export function refusDeclaration(statut: number): ErreurReglement {
  if (statut === 400) return new ErreurReglement('refus', 'Votre déclaration n’a pas été acceptée : vérifiez le mode et la référence (4 à 40 lettres, chiffres, points ou tirets), puis actualisez le suivi.');
  if (statut === 404) return new ErreurReglement('refus', 'Commande introuvable. Actualisez vos commandes.');
  if (statut === 409) return new ErreurReglement('refus', 'Le règlement ne peut plus être déclaré dans l’état actuel de la commande (déjà confirmé par le restaurant, paiement en ligne en cours, ou commande pas encore acceptée). Actualisez le suivi.');
  if (statut === 429) return new ErreurReglement('limite', 'Trop de tentatives. Patientez un instant avant de réessayer.');
  if (statut >= 500) return new ErreurReglement('serveur', 'Le service est indisponible. Votre déclaration a peut-être été enregistrée : actualisez le suivi avant de réessayer.', true);
  return new ErreurReglement('refus', 'Votre déclaration n’a pas pu être envoyée. Actualisez le suivi puis réessayez.');
}
export const erreurReseauReglement = () => new ErreurReglement('reseau', 'Impossible de joindre Speedfood. Votre déclaration a peut-être été enregistrée : actualisez le suivi avant de réessayer.', true);
export const erreurReponseReglement = () => new ErreurReglement('reponse_invalide', 'Réponse du service illisible. Votre déclaration a peut-être été enregistrée : actualisez le suivi avant de réessayer.', true);
/** Contrôle strict de la réponse 2xx : seul `{ok:true}` est un succès. */
export function lireReponseDeclaration(v: unknown): void {
  if (!v || typeof v !== 'object' || Array.isArray(v) || (v as { ok?: unknown }).ok !== true) throw erreurReponseReglement();
}

export type VerdictDeclaration =
  | { genre: 'confirme'; message: string }
  | { genre: 'refus'; message: string; reessayer: false }
  | { genre: 'incertain'; message: string; reessayer: boolean }
  | { genre: 'session'; message: string };

/**
 * Issue d'une tentative. `erreur` null = le serveur a répondu {ok:true}. Après une réponse INCONNUE, le suivi relu décide : s'il montre la déclaration, elle est enregistrée ;
 * sinon « Réessayer » n'est proposé que si la relecture a réussi (jamais à l'aveugle). Un refus certain n'est jamais converti en succès.
 */
export function verdictDeclaration(e: { erreur: ErreurReglement | null; sessionTerminee?: string | null; mode: ModeReglement; reference: string | null; relu: ReglementSuivi | null | undefined }): VerdictDeclaration {
  if (e.sessionTerminee) return { genre: 'session', message: e.sessionTerminee };
  const enregistre = !!e.relu && e.relu.mode === e.mode && (e.relu.statut === 'declare' || e.relu.statut === 'especes') && (e.mode === 'especes' || e.relu.reference === e.reference);
  if (e.erreur === null) return { genre: 'confirme', message: e.mode === 'especes' ? 'C’est noté : vous paierez en espèces au restaurant.' : 'Paiement déclaré. Le restaurant doit maintenant le confirmer.' };
  if (!e.erreur.incertain) return { genre: 'refus', message: e.erreur.message, reessayer: false };
  if (enregistre) return { genre: 'confirme', message: 'Votre déclaration est bien enregistrée. Le restaurant doit maintenant la confirmer.' };
  if (e.relu) return { genre: 'incertain', message: 'Le suivi relu ne montre pas votre déclaration : elle n’a pas été enregistrée. Vous pouvez réessayer.', reessayer: true };
  return { genre: 'incertain', message: e.erreur.message + ' Le suivi n’a pas pu être relu : actualisez-le avant de réessayer.', reessayer: false };
}
