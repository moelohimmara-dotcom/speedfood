import { HORAIRES_MAX, lireActionMenuApp, lireReglagesApp, lireStatutApp, type ChampStatutApp, type ReglagesAEcrire } from '../../../../packages/shared/src/contracts/restaurant-service.ts';
import { lireDelaiPreparation } from '../../../../packages/shared/src/commande/estimation.ts';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat.ts';
import type { RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';
import { ErreurRestaurateur, MESSAGE_SECURITE } from './restaurateur.ts';

export { HORAIRES_MAX };

/**
 * Domaine pur du lot D4a : le SERVICE du restaurateur (ouvert, prend des commandes, horaires, délai de préparation) et la DISPONIBILITÉ de ses plats (marquer disponible ou indisponible,
 * confirmer, tout confirmer). Rien d'autre : ni création, ni modification, ni archivage de plat, ni suppléments, ni photos (lots suivants).
 *
 * Même discipline que `restaurateur.ts` : UN SEUL essai par action, jamais de relance automatique ; après une réponse incertaine, les boutons restent verrouillés tant que l'état du serveur n'a pas
 * été relu avec succès ; les messages sont fixes (aucun texte du serveur n'est affiché) ; aucun jeton n'est conservé ; l'écran affiche ce que le SERVEUR a (jamais une valeur supposée).
 */

// ---------- sections de l'espace restaurateur ----------
export type SectionRestaurateur = 'commandes' | 'service' | 'menu';
export const SECTIONS_RESTAURATEUR: readonly SectionRestaurateur[] = ['commandes', 'service', 'menu'];
export const LIBELLES_SECTIONS: Record<SectionRestaurateur, string> = { commandes: 'Commandes', service: 'Service', menu: 'Menu' };
/** On ne change pas de section pendant un envoi ou une relecture (commandes OU service), pour que le verdict reste devant les yeux. */
export function peutChangerDeSection(occupeCommandes: boolean, occupeService: boolean): boolean { return !occupeCommandes && !occupeService; }

// ---------- lecture stricte ----------
function invalide(): never { throw Error('LECTURE_SERVICE_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
const REGEX_UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const estUuid = (v: unknown): v is string => typeof v === 'string' && REGEX_UUID.test(v);
/** Nom d'un plat : tolérant (sauts de ligne et tabulations deviennent des espaces ; contrôles et marques de direction retirés) ; vide ou absent = pas de nom lisible. */
function nomLisible(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || v.length > max) return null;
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 9 || k === 10 || k === 13) s += ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  s = s.split(' ').filter(m => m.length > 0).join(' ');
  return s.length > 0 ? s : null;
}
/** Horaires : texte libre sur plusieurs lignes (les sauts de ligne sont conservés), sans caractère de contrôle ni marque de direction. */
function horairesLisibles(v: unknown): string {
  if (typeof v !== 'string' || v.length > 5000) return invalide();
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 13) continue;
    if (k === 10 || k === 9) s += k === 10 ? '\n' : ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  return s;
}
function dateOuNull(v: unknown): string | null { return typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null; }

export interface PlatAReconfirmerRestaurateur { id: string; nom: string; confirmeLe: string | null }
export interface ReglagesRestaurateur {
  horaires: string; ouvert: boolean; accepteCommandes: boolean; delaiPreparationMinutes: number | null;
  /** Plats à reconfirmer : la liste du SERVEUR (règle du serveur), jamais recalculée ici. */
  platsAReconfirmer: PlatAReconfirmerRestaurateur[];
  /** Entrées de la liste « à reconfirmer » reçues mais illisibles (écartées une à une, comptées). */
  illisibles: number;
}

/**
 * Lecture STRICTE de `GET /api/v1/restaurant/reglages` : une structure d'ensemble invalide (statut non booléen, horaires non texte, délai hors 5 à 240) refuse tout ; une entrée atypique de
 * la liste « à reconfirmer » n'écarte QUE cette entrée (comptée dans `illisibles`).
 */
export function lireReglagesRestaurateur(v: Record<string, unknown>): ReglagesRestaurateur {
  if (v.ok !== true || !Array.isArray(v.platsAReconfirmer) || v.platsAReconfirmer.length > 600) return invalide();
  const d = v.delaiPreparationMinutes;
  if (d !== null && (typeof d !== 'number' || !Number.isSafeInteger(d) || d < 5 || d > 240)) return invalide();
  const ids = new Set<string>(); const plats: PlatAReconfirmerRestaurateur[] = []; let illisibles = 0;
  for (const x of v.platsAReconfirmer) {
    try {
      const o = objet(x); const nom = nomLisible(o.nom, 200);
      if (!estUuid(o.id) || ids.has(o.id) || nom === null) return invalide();
      ids.add(o.id); plats.push({ id: o.id, nom, confirmeLe: dateOuNull(o.confirmeLe) });
    } catch { illisibles++; }
  }
  return { horaires: horairesLisibles(v.horaires), ouvert: booleen(v.ouvert), accepteCommandes: booleen(v.accepteCommandes), delaiPreparationMinutes: d as number | null, platsAReconfirmer: plats, illisibles };
}

export interface PlatRestaurateur {
  id: string; nom: string;
  /** Prix en GNF (entier) ; null si le serveur ne l'a pas donné lisiblement (la ligne reste lisible). */
  prixGnf: number | null; disponible: boolean;
  /** Dernière confirmation de disponibilité ; null = jamais confirmée (ou date illisible : un état inconnu ne devient jamais « disponible confirmé »). */
  confirmeLe: string | null;
}
export interface MenuRestaurateur {
  plats: PlatRestaurateur[];
  /** Plats reçus mais atypiques (sans nom lisible, sans état de disponibilité, identifiant invalide ou répété) : écartés un à un, comptés, jamais en silence. */
  illisibles: number;
}

/** Lecture STRICTE de `GET /api/v1/restaurant/menu`. Seuls les champs affichés sont retenus ; un plat atypique n'écarte QUE lui-même (comptée). */
export function lireMenuRestaurateur(v: Record<string, unknown>): MenuRestaurateur {
  if (v.ok !== true || !Array.isArray(v.plats) || v.plats.length > 700) return invalide();
  const ids = new Set<string>(); const plats: PlatRestaurateur[] = []; let illisibles = 0;
  for (const x of v.plats) {
    try {
      const o = objet(x); const nom = nomLisible(o.nom, 200);
      if (!estUuid(o.id) || ids.has(o.id) || nom === null || typeof o.disponible !== 'boolean') { illisibles++; continue; }
      ids.add(o.id);
      plats.push({ id: o.id, nom, prixGnf: typeof o.prix === 'number' && Number.isSafeInteger(o.prix) && o.prix >= 0 ? o.prix : null, disponible: o.disponible, confirmeLe: dateOuNull(o.confirmeLe) });
    } catch { illisibles++; }
  }
  return { plats, illisibles };
}

/** Lignes d'un plat à afficher. La fraîcheur affichée n'est qu'une ancienneté : « à reconfirmer » vient de la liste du serveur (`ids`), jamais d'un calcul d'ici. */
export function libelleDisponibilitePlat(p: PlatRestaurateur, aReconfirmer: ReadonlySet<string>, maintenant: Date): { etat: string; confirmation: string | null } {
  if (!p.disponible) return { etat: 'Indisponible', confirmation: null };
  const confirmation = p.confirmeLe ? 'Confirmée ' + ancienneteLisible(new Date(p.confirmeLe), maintenant) : 'Jamais confirmée';
  return { etat: aReconfirmer.has(p.id) ? 'Disponible · à reconfirmer' : 'Disponible', confirmation };
}
export function formaterPrix(n: number | null): string | null { return n === null ? null : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' GNF'; }

// ---------- réglages : saisie ----------
export interface BrouillonReglages { horaires: string; delai: string }
export interface ErreursReglages { horaires?: string; delai?: string; general?: string }
export function brouillonDe(r: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>): BrouillonReglages { return { horaires: r.horaires, delai: r.delaiPreparationMinutes === null ? '' : String(r.delaiPreparationMinutes) }; }
/** La saisie du délai : chiffres seulement (tout le reste est retiré), 3 chiffres au plus. */
export function chiffresSeulement(saisie: unknown): string { return typeof saisie === 'string' ? saisie.replace(/[^0-9]/g, '').slice(0, 3) : ''; }
export function brouillonModifie(r: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>, b: BrouillonReglages): boolean {
  const ref = brouillonDe(r); return ref.horaires !== b.horaires || ref.delai !== b.delai;
}
export const MESSAGE_HORAIRES_TROP_LONGS = HORAIRES_MAX + ' caractères au maximum.';
/**
 * Valide la saisie AVANT tout envoi. Mêmes règles que le serveur : horaires de 500 caractères au plus, délai vide (rien n'est annoncé au client) ou entier de 5 à 240 minutes
 * (`lireDelaiPreparation`, la fonction du serveur). Seuls les champs CHANGÉS sont envoyés (on n'écrase pas ce qu'un autre membre a modifié depuis le site). Une saisie invalide ne produit JAMAIS de valeurs.
 */
export function preparerReglages(actuel: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>, b: BrouillonReglages): { ok: true; valeurs: ReglagesAEcrire } | { ok: false; erreurs: ErreursReglages } {
  const erreurs: ErreursReglages = {};
  if (typeof b.horaires !== 'string' || b.horaires.length > HORAIRES_MAX) erreurs.horaires = MESSAGE_HORAIRES_TROP_LONGS;
  const delai = lireDelaiPreparation(typeof b.delai === 'string' ? b.delai : null);
  if (!delai.ok || typeof b.delai !== 'string') erreurs.delai = 'Indiquez le délai en minutes, de 5 à 240, en chiffres seulement (ou laissez vide).';
  if (erreurs.horaires || erreurs.delai || !delai.ok) return { ok: false, erreurs };
  const valeurs: ReglagesAEcrire = {};
  if (b.horaires !== actuel.horaires) valeurs.horaires = b.horaires;
  if (delai.valeur !== actuel.delaiPreparationMinutes) valeurs.delaiPreparationMinutes = delai.valeur;
  if (Object.keys(valeurs).length === 0) return { ok: false, erreurs: { general: 'Rien n’a changé : modifiez les horaires ou le délai avant d’enregistrer.' } };
  // Dernier garde-fou : le contrôle partagé avec le serveur, pour que ce qui part soit exactement ce que le serveur accepte.
  const lu = lireReglagesApp(valeurs, lireDelaiPreparation);
  if (!lu.ok) return { ok: false, erreurs: { general: lu.message } };
  return { ok: true, valeurs: lu.valeurs };
}

// ---------- actions ----------
export type ActionService =
  | { type: 'statut'; champ: ChampStatutApp; valeur: boolean }
  | { type: 'reglages'; valeurs: ReglagesAEcrire }
  | { type: 'disponibilite'; platId: string; disponible: boolean }
  | { type: 'confirmer'; platId: string; avant: string | null }
  | { type: 'confirmer_tout'; avant: Array<[string, string | null]> };

/** Les actions qui demandent une confirmation avant l'envoi : les deux interrupteurs (dans les deux sens) et « Tout confirmer ». */
export function actionAConfirmer(a: ActionService): boolean { return a.type === 'statut' || a.type === 'confirmer_tout'; }

/** Les deux interrupteurs ne se confondent jamais : chaque champ a son texte, son sens et sa colonne. */
export function actionStatut(champ: ChampStatutApp, valeur: boolean): ActionService { return { type: 'statut', champ, valeur }; }
export function actionConfirmerTout(menu: Pick<MenuRestaurateur, 'plats'>): ActionService { return { type: 'confirmer_tout', avant: menu.plats.filter(p => p.disponible).map(p => [p.id, p.confirmeLe] as [string, string | null]) }; }

/** Textes fixes des confirmations, d'après ce que fait RÉELLEMENT le serveur (verifierRestaurantCommandable : fermé ou en pause = refus de toute nouvelle commande ; les commandes déjà reçues ne changent pas). */
export const CONFIRMATIONS_STATUT: Record<ChampStatutApp, Record<'true' | 'false', { question: string; oui: string; non: string }>> = {
  ouvert: {
    false: { question: 'Fermer le restaurant ? Il apparaîtra fermé et les clients ne pourront plus passer commande tant que vous ne l’aurez pas rouvert. Les commandes déjà reçues restent à traiter.', oui: 'Oui, fermer le restaurant', non: 'Non, rester ouvert' },
    true: { question: 'Rouvrir le restaurant ? Il apparaîtra ouvert. Les clients ne pourront commander que s’il prend aussi des commandes.', oui: 'Oui, rouvrir le restaurant', non: 'Non, annuler' },
  },
  accepte_commandes: {
    false: { question: 'Mettre les commandes en pause ? Les clients verront toujours votre menu mais ne pourront plus commander. Le restaurant reste ouvert et les commandes déjà reçues restent à traiter.', oui: 'Oui, mettre en pause', non: 'Non, continuer à prendre des commandes' },
    true: { question: 'Reprendre les commandes ? Les clients pourront de nouveau commander si le restaurant est ouvert.', oui: 'Oui, reprendre les commandes', non: 'Non, annuler' },
  },
};
export const CONFIRMATION_TOUT_CONFIRMER = {
  question: 'Confirmer que tous vos plats actuellement disponibles le sont toujours ? Les clients verront leur disponibilité comme confirmée à l’instant. Ne confirmez que si c’est vrai.',
  oui: 'Oui, tout confirmer', non: 'Non, annuler',
};
export function confirmationDe(a: ActionService): { question: string; oui: string; non: string } | null {
  if (a.type === 'statut') return CONFIRMATIONS_STATUT[a.champ][a.valeur ? 'true' : 'false'];
  if (a.type === 'confirmer_tout') return CONFIRMATION_TOUT_CONFIRMER;
  return null;
}
export const LIBELLES_ACTION: Record<ActionService['type'], string> = {
  statut: 'ce changement', reglages: 'vos réglages', disponibilite: 'ce changement de disponibilité', confirmer: 'cette confirmation', confirmer_tout: 'cette confirmation',
};

/** Corps de la requête, SEULEMENT les champs prévus (jamais de restaurant) : la machine et le client n'envoient que ce que cette fonction produit. */
export function corpsDeAction(a: ActionService): { chemin: '/api/v1/restaurant/statut' | '/api/v1/restaurant/reglages' | '/api/v1/restaurant/menu/action'; corps: object } | null {
  if (a === null || typeof a !== 'object') return null;
  switch (a.type) {
    case 'statut': { const lu = lireStatutApp({ champ: a.champ, valeur: a.valeur }); return lu ? { chemin: '/api/v1/restaurant/statut', corps: { champ: lu.champ, valeur: lu.valeur } } : null; }
    case 'reglages': { const lu = lireReglagesApp(a.valeurs, lireDelaiPreparation); return lu.ok ? { chemin: '/api/v1/restaurant/reglages', corps: lu.valeurs } : null; }
    case 'disponibilite': { const lu = lireActionMenuApp({ action: 'disponibilite', platId: a.platId, disponible: a.disponible }); return lu && lu.action === 'disponibilite' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: lu.action, platId: lu.platId, disponible: lu.disponible } } : null; }
    case 'confirmer': { const lu = lireActionMenuApp({ action: 'confirmer', platId: a.platId }); return lu && lu.action === 'confirmer' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: lu.action, platId: lu.platId } } : null; }
    case 'confirmer_tout': return { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'confirmer_tout' } };
    default: return null;
  }
}

// ---------- erreurs ----------
/** Table des refus du serveur pour le service et le menu : statut HTTP (et raison de sécurité éventuelle) vers un message français fixe. Le 401 (session terminée) est traité par l'appelant. */
export function refusService(statut: number, raison: RaisonSecuriteCompte | null = null): ErreurRestaurateur {
  if (statut === 403 && raison !== null) return new ErreurRestaurateur('securite', MESSAGE_SECURITE, false, raison);
  if (statut === 403) return new ErreurRestaurateur('refus', 'Ce compte ne peut pas modifier le service de ce restaurant. Actualisez puis vérifiez votre accès sur le site.');
  if (statut === 400 || statut === 404 || statut === 409) return new ErreurRestaurateur('refus', 'La demande n’a pas été acceptée (valeur invalide, ou plat introuvable). Actualisez puis réessayez.');
  if (statut === 429) return new ErreurRestaurateur('limite', 'Trop de tentatives. Patientez un instant avant de réessayer.');
  if (statut >= 500) return new ErreurRestaurateur('serveur', 'Le service est indisponible. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);
  return new ErreurRestaurateur('refus', 'Votre changement n’a pas pu être envoyé. Actualisez puis réessayez.');
}
export const erreurReseauService = () => new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);
export const erreurReponseService = () => new ErreurRestaurateur('reponse_invalide', 'Réponse du service illisible. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);

// ---------- verdict ----------
export type VerdictService =
  | { genre: 'confirme'; message: string }
  | { genre: 'refus'; message: string; reessayer: false }
  | { genre: 'securite'; message: string }
  | { genre: 'incertain'; message: string; reessayer: boolean }
  | { genre: 'session'; message: string };

const MESSAGES_SUCCES = {
  ouvert: { true: 'Restaurant rouvert.', false: 'Restaurant fermé.' },
  accepte_commandes: { true: 'Commandes reprises.', false: 'Commandes en pause.' },
  reglages: 'Réglages enregistrés.',
  disponible: 'Plat marqué disponible.', indisponible: 'Plat marqué indisponible.', confirmer: 'Disponibilité confirmée.', confirmer_tout: 'Disponibilité confirmée pour tous les plats disponibles.',
};
const MESSAGES_ENREGISTRE = {
  ouvert: { true: 'La réouverture est bien enregistrée.', false: 'La fermeture est bien enregistrée.' },
  accepte_commandes: { true: 'La reprise des commandes est bien enregistrée.', false: 'La pause des commandes est bien enregistrée.' },
  reglages: 'Vos réglages sont bien enregistrés.',
  disponible: 'Le plat est bien enregistré comme disponible.', indisponible: 'Le plat est bien enregistré comme indisponible.', confirmer: 'La confirmation est bien enregistrée.', confirmer_tout: 'La confirmation est bien enregistrée pour tous les plats.',
};
function messageSucces(a: ActionService, table: typeof MESSAGES_SUCCES | typeof MESSAGES_ENREGISTRE): string {
  switch (a.type) {
    case 'statut': return table[a.champ][a.valeur ? 'true' : 'false'];
    case 'reglages': return table.reglages;
    case 'disponibilite': return a.disponible ? table.disponible : table.indisponible;
    case 'confirmer': return table.confirmer;
    case 'confirmer_tout': return table.confirmer_tout;
  }
}

/** Ce que le serveur dit APRÈS l'envoi : réglages relus (statut, réglages) ou menu relu (disponibilité). `undefined` = relecture impossible. */
export interface RelectureService { reglages?: ReglagesRestaurateur; menu?: MenuRestaurateur }
/** Le serveur a-t-il, dans l'état relu, la valeur demandée ? `null` = l'état concerné n'a pas pu être relu. */
export function etatCorrespond(a: ActionService, relue: RelectureService): boolean | null {
  switch (a.type) {
    case 'statut': return relue.reglages ? (a.champ === 'ouvert' ? relue.reglages.ouvert : relue.reglages.accepteCommandes) === a.valeur : null;
    case 'reglages': {
      if (!relue.reglages) return null;
      return (a.valeurs.horaires === undefined || relue.reglages.horaires === a.valeurs.horaires) && (a.valeurs.delaiPreparationMinutes === undefined || relue.reglages.delaiPreparationMinutes === a.valeurs.delaiPreparationMinutes);
    }
    case 'disponibilite': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p !== undefined && p.disponible === a.disponible; }
    case 'confirmer': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p !== undefined && p.disponible && p.confirmeLe !== null && p.confirmeLe !== a.avant; }
    case 'confirmer_tout': {
      if (!relue.menu) return null;
      // Chaque plat qui était disponible et l'est resté doit porter une confirmation NOUVELLE ; au moins un plat concerné.
      const concernes = a.avant.map(([id, avant]) => ({ avant, p: relue.menu!.plats.find(x => x.id === id) })).filter(c => c.p !== undefined && c.p.disponible);
      return a.avant.length > 0 && concernes.every(c => c.p!.confirmeLe !== null && c.p!.confirmeLe !== c.avant);
    }
  }
}
/** « Réessayer » seulement quand le bouton qui renverrait l'action existe encore (leçon D2-M4). */
export function boutonExiste(a: ActionService, relue: RelectureService): boolean {
  switch (a.type) {
    case 'statut': case 'reglages': return true;
    case 'disponibilite': return relue.menu?.plats.some(x => x.id === a.platId) === true;
    case 'confirmer': return relue.menu?.plats.some(x => x.id === a.platId && x.disponible) === true;
    case 'confirmer_tout': return relue.menu?.plats.some(x => x.disponible) === true;
  }
}

/**
 * Issue d'une tentative. `erreur` null = le serveur a répondu {ok:true} (écriture confirmée par la base). Après une réponse INCONNUE, l'état relu décide : s'il montre la valeur demandée,
 * c'est enregistré ; s'il montre l'état d'avant et que le bouton existe encore, « réessayer » est permis ; si la relecture a échoué, il est interdit (jamais à l'aveugle). Un refus certain
 * n'est jamais converti en succès. Même après un succès, un état relu DIFFÉRENT est signalé (modifié entre-temps depuis un autre appareil).
 */
export function verdictService(e: { erreur: ErreurRestaurateur | null; sessionTerminee?: string | null; action: ActionService; relue: RelectureService }): VerdictService {
  if (e.sessionTerminee) return { genre: 'session', message: e.sessionTerminee };
  const correspond = etatCorrespond(e.action, e.relue);
  if (e.erreur === null) {
    if (correspond === false) return { genre: 'incertain', message: 'Le serveur a répondu, mais l’état relu est différent (il a peut-être été modifié depuis un autre appareil). Vérifiez ce qui est affiché.', reessayer: false };
    return { genre: 'confirme', message: messageSucces(e.action, MESSAGES_SUCCES) + (correspond === null ? ' L’état n’a pas pu être relu : actualisez pour le voir.' : '') };
  }
  if (e.erreur.genre === 'securite') return { genre: 'securite', message: MESSAGE_SECURITE };
  if (!e.erreur.incertain) return { genre: 'refus', message: e.erreur.message, reessayer: false };
  if (correspond === null) return { genre: 'incertain', message: e.erreur.message + ' L’état n’a pas pu être relu : actualisez-le avant de réessayer.', reessayer: false };
  if (correspond) return { genre: 'confirme', message: messageSucces(e.action, MESSAGES_ENREGISTRE) };
  if (boutonExiste(e.action, e.relue)) return { genre: 'incertain', message: 'L’état relu ne montre pas votre changement : il n’a pas été enregistré. Vous pouvez réessayer.', reessayer: true };
  return { genre: 'refus', message: 'Le plat n’apparaît plus ou ne peut plus être modifié. Actualisez le menu.', reessayer: false };
}

// ---------- machine d'états ----------
export type EtatService =
  | { phase: 'repos' }
  | { phase: 'confirmation'; action: ActionService }
  | { phase: 'envoi'; action: ActionService }
  | { phase: 'relecture'; action: ActionService; erreur: ErreurRestaurateur | null; sessionTerminee: string | null }
  | { phase: 'verdict'; action: ActionService; verdict: VerdictService; lectureVerdict: number };
export const ETAT_SERVICE_REPOS: EtatService = { phase: 'repos' };

export type EvenementService =
  | { type: 'demander_confirmation'; action: ActionService; lecture: number }
  | { type: 'annuler_confirmation' }
  | { type: 'envoyer'; action: ActionService; lecture: number }
  | { type: 'repondre'; erreur: ErreurRestaurateur | null; sessionTerminee?: string | null }
  | { type: 'relire'; relue: RelectureService; lecture: number }
  | { type: 'effacer' };

/**
 * Verrou des boutons. `lecture` est un compteur qui augmente à chaque lecture RÉUSSIE (réglages ou menu). Verrouillé : pendant l'envoi et la relecture qui suit ; et après un verdict
 * incertain sans relecture réussie, tant que le compteur n'a pas changé. Un seul envoi à la fois pour tout l'écran.
 */
export function serviceVerrouille(etat: EtatService, lecture: number): boolean {
  if (etat.phase === 'envoi' || etat.phase === 'relecture') return true;
  return etat.phase === 'verdict' && etat.verdict.genre === 'incertain' && !etat.verdict.reessayer && etat.lectureVerdict === lecture;
}
const memeAction = (a: ActionService, b: ActionService) => JSON.stringify(a) === JSON.stringify(b);
/** Une action à confirmer ne part qu'après SA confirmation (même action, tous champs égaux) ; les autres, jamais pendant un verrou. */
export function peutEnvoyerService(etat: EtatService, action: ActionService, lecture: number): boolean {
  if (corpsDeAction(action) === null) return false;
  if (serviceVerrouille(etat, lecture)) return false;
  return actionAConfirmer(action) ? etat.phase === 'confirmation' && memeAction(etat.action, action) : true;
}

/** Transitions, une par événement. Un événement hors de son contexte (ou refusé par le verrou) laisse l'état inchangé : jamais d'envoi sans passage par `envoyer`. */
export function evoluerService(etat: EtatService, ev: EvenementService): EtatService {
  switch (ev.type) {
    case 'demander_confirmation':
      return serviceVerrouille(etat, ev.lecture) || !actionAConfirmer(ev.action) || corpsDeAction(ev.action) === null ? etat : { phase: 'confirmation', action: ev.action };
    case 'annuler_confirmation':
      return etat.phase === 'confirmation' ? ETAT_SERVICE_REPOS : etat;
    case 'envoyer':
      return peutEnvoyerService(etat, ev.action, ev.lecture) ? { phase: 'envoi', action: ev.action } : etat;
    case 'repondre':
      return etat.phase === 'envoi' ? { phase: 'relecture', action: etat.action, erreur: ev.erreur, sessionTerminee: ev.sessionTerminee ?? null } : etat;
    case 'relire':
      return etat.phase === 'relecture'
        ? { phase: 'verdict', action: etat.action, verdict: verdictService({ erreur: etat.erreur, sessionTerminee: etat.sessionTerminee, action: etat.action, relue: ev.relue }), lectureVerdict: ev.lecture }
        : etat;
    case 'effacer':
      return ETAT_SERVICE_REPOS;
  }
}
