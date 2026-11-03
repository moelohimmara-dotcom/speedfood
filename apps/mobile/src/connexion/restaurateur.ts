import { CONDITIONS_PROPOSITION_MAX, MESSAGE_SECURITE_SUR_LE_SITE, MONTANT_PROPOSITION_MAX_GNF, lireValeursPropositionApp, type RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';

/**
 * Domaine pur des lots D1, D2 et D3 : l'espace restaurateur de l'application (lire les commandes, ACCEPTER, REFUSER, marquer PRÊTE puis TERMINÉE, confirmer ou contester un
 * paiement DÉCLARÉ par code marchand, ANNULER, PROPOSER un autre prix). Rien d'autre : ni livraison par le restaurant, ni menu (lots suivants). L'affichage de l'entrée « Espace restaurateur » n'est qu'un confort : le serveur revérifie tout (jeton, restaurant du compte,
 * second facteur, questions de sécurité).
 *
 * Même discipline que `reglement.ts` : UN SEUL essai par action, jamais de relance automatique ; après une réponse incertaine, les boutons restent verrouillés tant que
 * la liste n'a pas été relue avec succès ; les messages sont fixes (aucun texte du serveur n'est affiché) ; aucun jeton n'est conservé.
 */
export type ActionRestaurateur = 'accepter' | 'refuser' | 'prete' | 'terminee' | 'annuler' | 'proposer' | 'paiement_recu' | 'paiement_non_recu';
export const ACTIONS_RESTAURATEUR: readonly ActionRestaurateur[] = ['accepter', 'refuser', 'prete', 'terminee', 'annuler', 'proposer', 'paiement_recu', 'paiement_non_recu'];
/** Les actions de statut envoyées à `/commandes/action` (liste blanche cliente : « proposer » a sa propre route et ses montants). */
export const ACTIONS_DE_STATUT: readonly ActionRestaurateur[] = ['accepter', 'refuser', 'prete', 'terminee', 'annuler'];
/**
 * Actions qui demandent une confirmation avant l'envoi (décision difficile à défaire ou qui prévient le client). « proposer » a la sienne : le récapitulatif ancien prix → nouveau
 * prix (phase `recapitulatif`), jamais d'envoi sans lui.
 */
export const ACTIONS_A_CONFIRMER: readonly ActionRestaurateur[] = ['refuser', 'annuler', 'paiement_non_recu'];
/** Pour les routes de l'API : les actions de statut vont à `/commandes/action`, les deux décisions de paiement à `/commandes/paiement`, la proposition à `/commandes/proposition`. */
export function decisionPaiementDe(action: ActionRestaurateur): 'recu' | 'non_recu' | null { return action === 'paiement_recu' ? 'recu' : action === 'paiement_non_recu' ? 'non_recu' : null; }

function invalide(): never { throw Error('LECTURE_RESTAURATEUR_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
/**
 * Texte saisi par un client (nom, adresse, téléphone, noms de plats) : tolérant. Sauts de ligne, retours chariot et tabulations deviennent des espaces ; tout autre caractère de contrôle
 * et les marques de direction du texte (qui peuvent faire lire un texte à l'envers) sont retirés. Une commande ne doit jamais devenir illisible pour un parcours client légitime.
 */
function libre(v: unknown, max: number, vide = false): string {
  if (typeof v !== 'string' || v.length > max) return invalide();
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 9 || k === 10 || k === 13) s += ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  s = s.split(' ').filter(m => m.length > 0).join(' ');
  if (!s.length && !vide) return invalide();
  return s;
}
function libreOuNull(v: unknown, max: number): string | null { if (v === null || v === undefined) return null; const s = libre(v, max, true); return s.length ? s : null; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
function date(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }

// ---------- rôles (GET /api/v1/moi) ----------
export interface RolesCompte { restaurateur: { restaurant: string } | null; livreur: boolean; equipe: string | null }
/** Lecture stricte de `roles`. Information d'affichage seulement. */
export function lireRoles(v: Record<string, unknown>): RolesCompte {
  if (v.ok !== true) return invalide();
  const o = objet(v.roles);
  const r = o.restaurateur === null ? null : objet(o.restaurateur);
  return { restaurateur: r === null ? null : { restaurant: texte(r.restaurant, 200) }, livreur: booleen(o.livreur), equipe: texteOuNull(o.equipe, 60) };
}

// ---------- commandes ----------
export type StatutRestaurateur = 'en_attente' | 'acceptee' | 'prete' | 'terminee' | 'refusee' | 'annulee';
const STATUTS: readonly StatutRestaurateur[] = ['en_attente', 'acceptee', 'prete', 'terminee', 'refusee', 'annulee'];
/** Paiement : mêmes valeurs que le contrat du site. Les espèces restent LISIBLES (anciennes commandes) mais l'application ne les affiche ni ne les traite jamais (règle du 3 novembre 2026). */
export type StatutPaiementRestaurateur = 'non_demande' | 'especes' | 'declare' | 'recu' | 'non_recu';
export type ModePaiementRestaurateur = 'especes' | 'orange_money' | 'mtn_momo' | 'speedfood';
const STATUTS_PAIEMENT: readonly StatutPaiementRestaurateur[] = ['non_demande', 'especes', 'declare', 'recu', 'non_recu'];
const MODES_PAIEMENT: readonly ModePaiementRestaurateur[] = ['especes', 'orange_money', 'mtn_momo', 'speedfood'];
export interface LigneRestaurateur { nom: string; quantite: number; prixGnf: number; options: string[] }
export interface CommandeRestaurateur {
  id: string; reference: string; statut: StatutRestaurateur; mode: 'retrait' | 'livraison' | 'sur_place'; tableNumero: string | null;
  clientNom: string; clientTelephone: string; clientAdresse: string | null; totalGnf: number; sousTotalGnf: number; fraisGnf: number; creeLe: string; estTest: boolean;
  lignes: LigneRestaurateur[]; propositionEnAttente: boolean;
  /** Montants de la proposition active (null s'il n'y en a pas, ou si le serveur ne les a pas donnés lisiblement) : sert à reconnaître SA proposition après une réponse incertaine. */
  propositionMontants: { sousTotal: number; frais: number } | null;
  paiementStatut: StatutPaiementRestaurateur; paiementMode: ModePaiementRestaurateur | null; paiementReference: string | null;
}
export interface ListeRestaurateur {
  restaurant: { id: string; nom: string; ouvert: boolean; accepteCommandes: boolean } | null; commandes: CommandeRestaurateur[];
  /** Nombre de commandes reçues mais illisibles (écartées une à une, jamais en silence : l'écran le signale et renvoie vers le site). */
  illisibles: number;
}

/**
 * Lecture STRICTE de `GET /api/v1/restaurant/commandes` : valeur inconnue = refus. Seuls les champs affichés sont retenus : AUCUN jeton (reçu, suivi) n'est lu ni conservé,
 * même si le serveur en envoyait un.
 */
/** Une ligne invalide n'écarte QUE cette ligne (comptée dans `illisibles`) ; une structure d'ensemble invalide refuse toute la liste. */
export function lireListeRestaurateur(v: Record<string, unknown>): ListeRestaurateur {
  if (v.ok !== true || !Array.isArray(v.commandes) || v.commandes.length > 700) return invalide();
  const r = v.restaurant === null ? null : objet(v.restaurant);
  const ids = new Set<string>();
  const lireCommande = (x: unknown): CommandeRestaurateur => {
    const o = objet(x);
    const id = texte(o.id, 36);
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || ids.has(id)) return invalide();
    ids.add(id);
    if (typeof o.statut !== 'string' || !(STATUTS as readonly string[]).includes(o.statut)) return invalide();
    if (o.mode !== 'retrait' && o.mode !== 'livraison' && o.mode !== 'sur_place') return invalide();
    if (!Array.isArray(o.lignes) || o.lignes.length > 50) return invalide();
    const lignes = o.lignes.map((l): LigneRestaurateur => {
      const p = objet(l);
      const quantite = p.quantite;
      if (typeof quantite !== 'number' || !Number.isSafeInteger(quantite) || quantite < 1 || quantite > 99) return invalide();
      if (!Array.isArray(p.options) || p.options.length > 20) return invalide();
      return { nom: libre(p.nom, 120), quantite, prixGnf: montant(p.prix), options: p.options.map(q => libre(objet(q).nom, 120)) };
    });
    if (typeof o.paiementStatut !== 'string' || !(STATUTS_PAIEMENT as readonly string[]).includes(o.paiementStatut)) return invalide();
    if (o.paiementMode !== null && (typeof o.paiementMode !== 'string' || !(MODES_PAIEMENT as readonly string[]).includes(o.paiementMode))) return invalide();
    const sousTotalGnf = montant(o.sousTotal); const fraisGnf = montant(o.fraisLivraisonEstime);
    const total = sousTotalGnf + fraisGnf;
    if (!Number.isSafeInteger(total)) return invalide();
    return {
      id, reference: texte(o.reference, 40), statut: o.statut as StatutRestaurateur, mode: o.mode, tableNumero: texteOuNull(o.tableNumero, 20), clientNom: libre(o.clientNom, 120),
      clientTelephone: libre(o.clientTelephone, 40, true), clientAdresse: libreOuNull(o.clientAdresse, 300), totalGnf: total, sousTotalGnf, fraisGnf, creeLe: date(o.creeLe), estTest: booleen(o.estTest), lignes,
      propositionEnAttente: o.propositionActive !== null && o.propositionActive !== undefined,
      propositionMontants: montantsProposition(o.propositionActive),
      paiementStatut: o.paiementStatut as StatutPaiementRestaurateur, paiementMode: o.paiementMode as ModePaiementRestaurateur | null, paiementReference: libreOuNull(o.paiementReference, 80),
    };
  };
  const commandes: CommandeRestaurateur[] = []; let illisibles = 0;
  for (const x of v.commandes) { try { commandes.push(lireCommande(x)); } catch { illisibles++; } }
  return { restaurant: r === null ? null : { id: texte(r.id, 36), nom: texte(r.nom, 200), ouvert: booleen(r.ouvert), accepteCommandes: booleen(r.accepteCommandes) }, commandes, illisibles };
}

/** Montants de la proposition active, ou null. Une valeur atypique ne rend jamais la ligne illisible : les montants sont alors simplement inconnus. */
function montantsProposition(p: unknown): { sousTotal: number; frais: number } | null {
  if (!p || typeof p !== 'object') return null;
  const { nouveauSousTotal: a, nouveauxFraisLivraison: b } = p as { nouveauSousTotal?: unknown; nouveauxFraisLivraison?: unknown };
  return typeof a === 'number' && Number.isSafeInteger(a) && a >= 0 && typeof b === 'number' && Number.isSafeInteger(b) && b >= 0 ? { sousTotal: a, frais: b } : null;
}

export type GroupeCommandes = 'a_traiter' | 'en_cours' | 'historique';
export const TITRES_GROUPES: Record<GroupeCommandes, string> = { a_traiter: 'À traiter', en_cours: 'En cours', historique: 'Historique récent' };
export function groupeDe(statut: StatutRestaurateur): GroupeCommandes { return statut === 'en_attente' ? 'a_traiter' : statut === 'acceptee' || statut === 'prete' ? 'en_cours' : 'historique'; }
/** Trois groupes, dans cet ordre ; l'ordre reçu du serveur (plus récente d'abord) est conservé à l'intérieur de chaque groupe. */
export function grouper(commandes: readonly CommandeRestaurateur[]): Array<{ groupe: GroupeCommandes; titre: string; commandes: CommandeRestaurateur[] }> {
  return (['a_traiter', 'en_cours', 'historique'] as const).map(groupe => ({ groupe, titre: TITRES_GROUPES[groupe], commandes: commandes.filter(c => groupeDe(c.statut) === groupe) }));
}

/**
 * Option prudente (décision de Malika, 3 novembre 2026) : tant qu'aucun remboursement n'existe, l'application ne propose jamais d'annuler une commande dont le paiement est déclaré,
 * reçu (ou enregistré d'un ancien mode). Seuls « non demandé » et « non reçu » (contesté par le restaurateur) laissent annuler. Le service du site, lui, ne distingue pas.
 */
export function commandePayee(paiementStatut: StatutPaiementRestaurateur | undefined, paiementMode: ModePaiementRestaurateur | null | undefined): boolean {
  // Paiement en ligne Speedfood (Chap Chap Pay) : il peut aboutir à tout instant alors que le statut reste « non demandé » ; mode inconnu (undefined) = prudence.
  if (paiementMode === undefined || paiementMode === 'speedfood') return true;
  return paiementStatut !== 'non_demande' && paiementStatut !== 'non_recu';
}
export const MESSAGE_DEJA_PAYEE = 'Cette commande est déjà payée : pour l’annuler, utilisez le site ou le support (le client doit être remboursé).';
/** Une commande qu'on afficherait avec « Annuler » si elle n'était pas payée : l'écran montre alors MESSAGE_DEJA_PAYEE à la place. */
export function annulationRefuseePourPaiement(c: Pick<CommandeRestaurateur, 'statut' | 'paiementStatut' | 'paiementMode'>): boolean { return (c.statut === 'en_attente' || c.statut === 'acceptee') && commandePayee(c.paiementStatut, c.paiementMode); }

type Concerne = Pick<CommandeRestaurateur, 'statut' | 'propositionEnAttente' | 'paiementStatut' | 'paiementMode'>;
/**
 * Paiement confirmable : UNIQUEMENT un paiement DÉCLARÉ par code marchand (Orange Money, MTN MoMo) sur une commande acceptée, prête ou terminée. Jamais les espèces (Speedfood ne
 * manipule jamais d'espèces), jamais un paiement en ligne Speedfood (la confirmation vient du prestataire), jamais un paiement non déclaré ou déjà tranché. Le serveur revérifie.
 */
export function paiementConfirmable(c: Pick<CommandeRestaurateur, 'statut' | 'paiementStatut' | 'paiementMode'>): boolean {
  return (c.statut === 'acceptee' || c.statut === 'prete' || c.statut === 'terminee') && c.paiementStatut === 'declare' && (c.paiementMode === 'orange_money' || c.paiementMode === 'mtn_momo');
}
/**
 * Les boutons d'une commande, décidés par son statut puis son paiement, d'après les transitions du service (`transitionAutorisee`) : en attente → accepter / refuser / proposer un autre
 * prix, sauf proposition en cours (le serveur refuserait : « en attente de la réponse du client », seule l'annulation reste possible) ; en attente ou acceptée → annuler ; acceptée → prête ;
 * prête → terminée (une commande prête ne s'annule plus) ; paiement déclaré → reçu / non reçu. Aucun bouton de statut pour une commande terminée, refusée ou annulée.
 */
export function actionsPossibles(c: Concerne): ActionRestaurateur[] {
  const actions: ActionRestaurateur[] = [];
  if (c.statut === 'en_attente') {
    if (!c.propositionEnAttente) actions.push('accepter', 'refuser', 'proposer');
    if (!commandePayee(c.paiementStatut, c.paiementMode)) actions.push('annuler');
  } else if (c.statut === 'acceptee') { actions.push('prete'); if (!commandePayee(c.paiementStatut, c.paiementMode)) actions.push('annuler'); }
  else if (c.statut === 'prete') actions.push('terminee');
  if (paiementConfirmable(c)) actions.push('paiement_recu', 'paiement_non_recu');
  return actions;
}

/** La commande est-elle encore dans l'état d'AVANT l'action ? (liste périmée ou action non enregistrée) */
function etatAvant(action: ActionRestaurateur, c: Pick<CommandeRestaurateur, 'statut' | 'paiementStatut' | 'propositionEnAttente'>): boolean {
  switch (action) {
    case 'accepter': case 'refuser': return c.statut === 'en_attente';
    case 'annuler': return c.statut === 'en_attente' || c.statut === 'acceptee';
    case 'proposer': return c.statut === 'en_attente' && !c.propositionEnAttente;
    case 'prete': return c.statut === 'acceptee';
    case 'terminee': return c.statut === 'prete';
    case 'paiement_recu': case 'paiement_non_recu': return c.paiementStatut === 'declare';
  }
}
/** La commande est-elle dans l'état que l'action devait produire ? */
function etatApres(action: ActionRestaurateur, c: Pick<CommandeRestaurateur, 'statut' | 'paiementStatut' | 'propositionEnAttente'>): boolean {
  switch (action) {
    case 'annuler': return c.statut === 'annulee';
    case 'proposer': return c.statut === 'en_attente' && c.propositionEnAttente;
    case 'accepter': return c.statut === 'acceptee' || c.statut === 'prete' || c.statut === 'terminee';
    case 'refuser': return c.statut === 'refusee';
    case 'prete': return c.statut === 'prete' || c.statut === 'terminee';
    case 'terminee': return c.statut === 'terminee';
    case 'paiement_recu': return c.paiementStatut === 'recu';
    case 'paiement_non_recu': return c.paiementStatut === 'non_recu';
  }
}
const estPaiement = (a: ActionRestaurateur) => decisionPaiementDe(a) !== null;

/**
 * Les boutons réellement affichés : une action dont la confirmation vient d'être reçue n'est plus proposée, même si la liste relue n'a pas pu mettre la commande à jour
 * (liste périmée = commande encore dans l'état d'avant : on retire alors toute la famille, statut ou paiement). Liste à jour : les boutons de l'étape suivante apparaissent.
 */
export function actionsAffichees(c: Pick<CommandeRestaurateur, 'id' | 'statut' | 'propositionEnAttente' | 'paiementStatut' | 'paiementMode'>, etat: EtatAction): ActionRestaurateur[] {
  const possibles = actionsPossibles(c);
  if (etat.phase === 'verdict' && etat.commandeId === c.id && etat.verdict.genre === 'confirme' && etatAvant(etat.action, c)) return possibles.filter(a => estPaiement(a) !== estPaiement(etat.action));
  return possibles;
}

/** Libellés fixes (aucun texte du serveur n'est affiché). Les espèces n'ont volontairement AUCUN libellé : l'application ne les montre pas. */
export const LIBELLES_MODE_PAIEMENT: Record<ModePaiementRestaurateur, string | null> = { especes: null, orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', speedfood: 'Paiement en ligne Speedfood' };
const LIBELLES_STATUT_PAIEMENT: Record<StatutPaiementRestaurateur, string | null> = {
  non_demande: 'Paiement non demandé', especes: null, declare: 'Paiement déclaré par le client', recu: 'Paiement reçu', non_recu: 'Paiement non reçu',
};
/** Ligne « Paiement » d'une commande, ou null s'il n'y a rien à montrer (jamais d'espèces). */
export function libellePaiement(c: Pick<CommandeRestaurateur, 'statut' | 'paiementStatut' | 'paiementMode' | 'paiementReference'>): string | null {
  if (c.statut === 'en_attente' || c.statut === 'refusee' || c.statut === 'annulee') return null;
  if (c.paiementMode === 'especes') return null;
  const statut = LIBELLES_STATUT_PAIEMENT[c.paiementStatut];
  if (statut === null) return null;
  const mode = c.paiementMode ? LIBELLES_MODE_PAIEMENT[c.paiementMode] : null;
  return statut + (mode ? ' · ' + mode : '') + (c.paiementReference ? ' · réf. ' + c.paiementReference : '');
}
/** Ligne du client : le séparateur n'apparaît que s'il y a un numéro (commande à table sans téléphone). */
export function ligneClient(c: Pick<CommandeRestaurateur, 'clientNom' | 'clientTelephone'>): string { return c.clientTelephone.length > 0 ? c.clientNom + ' · ' + c.clientTelephone : c.clientNom; }

export const LIBELLES_STATUT: Record<StatutRestaurateur, string> = {
  en_attente: 'En attente de votre réponse', acceptee: 'Acceptée', prete: 'Prête', terminee: 'Terminée', refusee: 'Refusée', annulee: 'Annulée',
};
/** Une commande en attente dont le client doit répondre à une proposition de prix n'attend plus le restaurateur. */
export function libelleStatut(c: Pick<CommandeRestaurateur, 'statut' | 'propositionEnAttente'>): string {
  return c.statut === 'en_attente' && c.propositionEnAttente ? 'En attente de la réponse du client' : LIBELLES_STATUT[c.statut];
}

// ---------- erreurs ----------
export type GenreErreurRestaurateur = 'refus' | 'securite' | 'limite' | 'serveur' | 'reseau' | 'reponse_invalide';
/**
 * Erreur d'une action ou d'une lecture. `incertain` : l'action a pu être enregistrée ; relire la liste avant de proposer de réessayer.
 * `securite` : le compte a un second facteur ou des questions de sécurité à terminer, ce que l'application ne sait pas faire : message vers le site. Aucun jeton n'y figure.
 */
export class ErreurRestaurateur extends Error {
  genre: GenreErreurRestaurateur; incertain: boolean; raison: RaisonSecuriteCompte | null;
  constructor(genre: GenreErreurRestaurateur, message: string, incertain = false, raison: RaisonSecuriteCompte | null = null) { super(message); this.name = 'ErreurRestaurateur'; this.genre = genre; this.incertain = incertain; this.raison = raison; }
}
export const MESSAGE_SECURITE = MESSAGE_SECURITE_SUR_LE_SITE;
export function lireRaisonSecurite(corps: unknown): RaisonSecuriteCompte | null {
  if (!corps || typeof corps !== 'object') return null;
  const champs = (corps as { erreur?: { champs?: unknown } }).erreur?.champs;
  const raison = champs && typeof champs === 'object' ? (champs as { securite?: unknown }).securite : undefined;
  return raison === 'mfa' || raison === 'questions' ? raison : null;
}
/** Table des refus du serveur : statut HTTP (et raison de sécurité éventuelle) vers un message français fixe. Le 401 (session terminée) est traité par l'appelant. */
export function refusRestaurateur(statut: number, raison: RaisonSecuriteCompte | null = null): ErreurRestaurateur {
  if (statut === 403 && raison !== null) return new ErreurRestaurateur('securite', MESSAGE_SECURITE, false, raison);
  if (statut === 403) return new ErreurRestaurateur('refus', 'Ce compte ne peut pas traiter cette commande. Actualisez la liste.');
  if (statut === 400) return new ErreurRestaurateur('refus', 'La demande n’a pas été acceptée. Actualisez la liste puis réessayez.');
  if (statut === 404) return new ErreurRestaurateur('refus', 'Commande introuvable. Actualisez la liste.');
  if (statut === 409) return new ErreurRestaurateur('refus', 'La commande a changé d’état, ou le client doit d’abord répondre à une proposition. Actualisez la liste.');
  if (statut === 429) return new ErreurRestaurateur('limite', 'Trop de tentatives. Patientez un instant avant de réessayer.');
  if (statut >= 500) return new ErreurRestaurateur('serveur', 'Le service est indisponible. Votre réponse a peut-être été enregistrée : la liste va être relue avant de réessayer.', true);
  return new ErreurRestaurateur('refus', 'Votre réponse n’a pas pu être envoyée. Actualisez la liste puis réessayez.');
}
export const erreurReseauRestaurateur = () => new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood. Votre réponse a peut-être été enregistrée : la liste va être relue avant de réessayer.', true);
export const erreurReponseRestaurateur = () => new ErreurRestaurateur('reponse_invalide', 'Réponse du service illisible. Votre réponse a peut-être été enregistrée : la liste va être relue avant de réessayer.', true);
/** Contrôle strict de la réponse 2xx d'une action : seul `{ok:true}` est un succès. */
export function lireReponseAction(v: unknown): void { if (!v || typeof v !== 'object' || Array.isArray(v) || (v as { ok?: unknown }).ok !== true) throw erreurReponseRestaurateur(); }

// ---------- verdict ----------
export type VerdictAction =
  | { genre: 'confirme'; message: string }
  | { genre: 'refus'; message: string; reessayer: false }
  | { genre: 'securite'; message: string }
  | { genre: 'incertain'; message: string; reessayer: boolean }
  | { genre: 'session'; message: string };

const MESSAGES_SUCCES: Record<ActionRestaurateur, string> = {
  accepter: 'Commande acceptée.', refuser: 'Commande refusée.', prete: 'Commande marquée prête.', terminee: 'Commande marquée terminée.', annuler: 'Commande annulée.', proposer: 'Proposition envoyée au client.',
  paiement_recu: 'Paiement confirmé comme reçu.', paiement_non_recu: 'Paiement signalé comme non reçu.',
};
const MESSAGES_ENREGISTRE: Record<ActionRestaurateur, string> = {
  accepter: 'Votre acceptation est bien enregistrée.', refuser: 'Votre refus est bien enregistré.', prete: 'La commande est bien enregistrée comme prête.', terminee: 'La commande est bien enregistrée comme terminée.',
  annuler: 'L’annulation est bien enregistrée.', proposer: 'Votre proposition est bien enregistrée.',
  paiement_recu: 'La confirmation du paiement est bien enregistrée.', paiement_non_recu: 'Le paiement est bien enregistré comme non reçu.',
};

/**
 * Issue d'une tentative. `erreur` null = le serveur a répondu {ok:true}. Après une réponse INCONNUE, la liste relue décide : si elle montre l'état attendu, l'action est enregistrée ;
 * si la commande est encore en attente, « réessayer » est permis ; si la relecture a échoué (`relue` indéfinie), elle est interdite (jamais à l'aveugle). Un refus certain n'est jamais
 * converti en succès.
 */
export function verdictAction(e: { erreur: ErreurRestaurateur | null; sessionTerminee?: string | null; action: ActionRestaurateur; relue: CommandeRestaurateur | null | undefined; valeurs?: ValeursPropositionRestaurateur }): VerdictAction {
  if (e.sessionTerminee) return { genre: 'session', message: e.sessionTerminee };
  if (e.erreur === null) return { genre: 'confirme', message: MESSAGES_SUCCES[e.action] };
  if (e.erreur.genre === 'securite') return { genre: 'securite', message: MESSAGE_SECURITE };
  if (!e.erreur.incertain) return { genre: 'refus', message: e.erreur.message, reessayer: false };
  if (e.relue === undefined) return { genre: 'incertain', message: e.erreur.message + ' La liste n’a pas pu être relue : actualisez-la avant de réessayer.', reessayer: false };
  if (e.relue === null) return { genre: 'refus', message: 'Cette commande n’apparaît plus dans la liste. Actualisez la liste.', reessayer: false };
  if (e.action === 'proposer' && e.relue.statut === 'en_attente' && e.relue.propositionEnAttente) {
    // « Bien enregistrée » seulement si la proposition relue porte les MÊMES montants que celle envoyée ; sinon (créée depuis le site par un autre membre, ou montants illisibles) : message neutre, jamais de réessai.
    const m = e.relue.propositionMontants;
    if (e.valeurs && m && m.sousTotal === e.valeurs.nouveauSousTotal && m.frais === e.valeurs.nouveauxFraisLivraison) return { genre: 'confirme', message: MESSAGES_ENREGISTRE.proposer };
    return { genre: 'incertain', message: 'Une proposition est en cours, mais rien ne prouve que ce soit la vôtre (montants différents, ou créée depuis le site). Actualisez la liste et vérifiez les montants avant d’en envoyer une autre.', reessayer: false };
  }
  if (etatApres(e.action, e.relue)) return { genre: 'confirme', message: MESSAGES_ENREGISTRE[e.action] };
  if (etatAvant(e.action, e.relue)) {
    // Une proposition non retrouvée peut avoir été enregistrée puis déjà acceptée par le client : jamais de « réessayer », pour ne pas envoyer deux propositions.
    if (e.action === 'proposer') return { genre: 'incertain', message: 'La liste relue ne montre pas de proposition en cours : elle n’a peut-être pas été enregistrée, ou le client y a déjà répondu. Actualisez la liste et vérifiez avant d’en envoyer une autre.', reessayer: false };
    // « Vous pouvez réessayer » seulement si le bouton existe encore (leçon D2-M4) : sinon la commande a changé.
    if (actionsPossibles(e.relue).includes(e.action)) return { genre: 'incertain', message: 'La liste relue ne montre pas votre réponse : elle n’a pas été enregistrée. Vous pouvez réessayer.', reessayer: true };
  }
  return { genre: 'refus', message: 'La commande a changé d’état entre-temps : ' + libelleStatut(e.relue).toLowerCase() + (estPaiement(e.action) && e.relue.paiementStatut !== 'declare' ? ' (paiement déjà tranché ou modifié)' : '') + '.', reessayer: false };
}

/** Textes fixes des confirmations (question, bouton qui envoie, bouton qui renonce) des actions à confirmer. Aucun texte du serveur, aucun libellé d'espèces. */
export const CONFIRMATIONS: Record<'refuser' | 'annuler' | 'paiement_non_recu', { question: string; oui: string; non: string }> = {
  refuser: { question: 'Refuser définitivement cette commande ? Le client sera prévenu.', oui: 'Oui, refuser', non: 'Non, garder' },
  annuler: { question: 'Annuler cette commande ? Le client sera prévenu et la commande ne pourra plus être traitée.', oui: 'Oui, annuler la commande', non: 'Non, garder' },
  paiement_non_recu: { question: 'Le client sera prévenu que vous n’avez pas retrouvé son paiement. Continuer ?', oui: 'Oui, paiement non reçu', non: 'Non, annuler' },
};

// ---------- proposition d'un autre prix (lot D3) ----------
/** Montants et conditions d'une proposition, tels que le serveur les reçoit (entiers en GNF, jamais de flottant). */
export interface ValeursPropositionRestaurateur { nouveauSousTotal: number; nouveauxFraisLivraison: number; conditionsModifiees: string | null }
/** Prix actuels de la commande, lus dans la liste : sous-total et frais de livraison, en GNF entiers. */
export interface PrixActuels { sousTotalGnf: number; fraisGnf: number }
/** Ce que le restaurateur tape : trois textes, validés seulement à « Continuer ». */
export interface BrouillonProposition { sousTotal: string; frais: string; conditions: string }
export type ChampProposition = keyof BrouillonProposition;
export interface ErreursProposition { sousTotal?: string; frais?: string; conditions?: string; general?: string }
/** Ancien prix → nouveau prix, pour la confirmation avant l'envoi. */
export interface RecapProposition {
  ancienSousTotal: number; nouveauSousTotal: number; ancienFrais: number; nouveauxFrais: number; ancienTotal: number; nouveauTotal: number; conditions: string | null;
}

/** 25000 → « 25 000 » (espace insécable) ; jamais de décimale. */
export function formaterGnf(n: number): string { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }

export const MESSAGE_MONTANT_INVALIDE = 'Entrez un nombre entier en GNF, de 0 à ' + formaterGnf(MONTANT_PROPOSITION_MAX_GNF) + ' (sans virgule ni lettre).';
/**
 * Montant GNF tapé au clavier. Accepte des chiffres seuls (« 25000 ») ou groupés par milliers avec des espaces (« 25 000 », espace insécable ou fine comprise), avec des espaces
 * autour. Refuse tout le reste : virgule, point, lettre, signe, vide, groupement faux (« 2 5000 »), plus de 10 000 000. Jamais NaN ni Infinity : le résultat est un entier sûr ou null.
 */
export function analyserMontantGnf(saisie: unknown): number | null {
  if (typeof saisie !== 'string' || saisie.length > 40) return null;
  const texte = saisie.replace(/^[ \u00a0\u202f\u2009]+|[ \u00a0\u202f\u2009]+$/g, '');
  if (!/^[0-9]{1,8}$/.test(texte) && !/^[0-9]{1,3}([ \u00a0\u202f\u2009][0-9]{3}){1,2}$/.test(texte)) return null;
  const n = Number(texte.replace(/[ \u00a0\u202f\u2009]/g, ''));
  return Number.isSafeInteger(n) && n >= 0 && n <= MONTANT_PROPOSITION_MAX_GNF ? n : null;
}

export function recapProposition(actuel: PrixActuels, v: ValeursPropositionRestaurateur): RecapProposition {
  return {
    ancienSousTotal: actuel.sousTotalGnf, nouveauSousTotal: v.nouveauSousTotal, ancienFrais: actuel.fraisGnf, nouveauxFrais: v.nouveauxFraisLivraison,
    ancienTotal: actuel.sousTotalGnf + actuel.fraisGnf, nouveauTotal: v.nouveauSousTotal + v.nouveauxFraisLivraison, conditions: v.conditionsModifiees,
  };
}
/** Les lignes du récapitulatif, « ancien → nouveau » ; l'ancien prix est TOUJOURS à gauche. */
export function lignesRecapProposition(r: RecapProposition): string[] {
  const l = (titre: string, avant: number, apres: number) => titre + ' : ' + formaterGnf(avant) + ' GNF → ' + formaterGnf(apres) + ' GNF';
  return [l('Sous-total', r.ancienSousTotal, r.nouveauSousTotal), l('Frais de livraison', r.ancienFrais, r.nouveauxFrais), l('Total', r.ancienTotal, r.nouveauTotal)];
}

/**
 * Valide la saisie. Mêmes règles que le serveur et que le formulaire du site : sous-total et frais entiers de 0 à 10 000 000, conditions de 500 caractères au plus, et au moins un
 * changement (montant, frais ou conditions). Une saisie invalide ne produit JAMAIS de valeurs : rien ne peut en être envoyé au réseau.
 */
export function preparerProposition(actuel: PrixActuels, b: BrouillonProposition): { ok: true; valeurs: ValeursPropositionRestaurateur; recap: RecapProposition } | { ok: false; erreurs: ErreursProposition } {
  const erreurs: ErreursProposition = {};
  const sousTotal = analyserMontantGnf(b.sousTotal);
  const frais = analyserMontantGnf(b.frais);
  if (sousTotal === null) erreurs.sousTotal = MESSAGE_MONTANT_INVALIDE;
  if (frais === null) erreurs.frais = MESSAGE_MONTANT_INVALIDE;
  const conditions = typeof b.conditions === 'string' ? b.conditions.trim() : '';
  if (typeof b.conditions !== 'string' || conditions.length > CONDITIONS_PROPOSITION_MAX) erreurs.conditions = CONDITIONS_PROPOSITION_MAX + ' caractères au maximum.';
  if (sousTotal === null || frais === null || erreurs.conditions) return { ok: false, erreurs };
  if (sousTotal === actuel.sousTotalGnf && frais === actuel.fraisGnf && conditions.length === 0) return { ok: false, erreurs: { general: 'Changez le montant, les frais ou les conditions pour proposer quelque chose.' } };
  // Dernier garde-fou : le contrôle partagé avec le serveur (mêmes bornes), pour que ce qui part soit exactement ce que le serveur accepte.
  const lu = lireValeursPropositionApp({ nouveauSousTotal: sousTotal, nouveauxFraisLivraison: frais, conditionsModifiees: conditions.length > 0 ? conditions : null });
  if (!lu.ok) return { ok: false, erreurs: { general: lu.message } };
  return { ok: true, valeurs: lu.valeurs, recap: recapProposition(actuel, lu.valeurs) };
}

// ---------- machine d'états de l'écran ----------
export type EtatAction =
  | { phase: 'repos' }
  | { phase: 'confirmation'; commandeId: string; action: ActionRestaurateur }
  | { phase: 'saisie'; commandeId: string; actuel: PrixActuels; brouillon: BrouillonProposition; erreurs: ErreursProposition }
  | { phase: 'recapitulatif'; commandeId: string; actuel: PrixActuels; brouillon: BrouillonProposition; valeurs: ValeursPropositionRestaurateur; recap: RecapProposition }
  | { phase: 'envoi'; commandeId: string; action: ActionRestaurateur; valeurs?: ValeursPropositionRestaurateur }
  | { phase: 'relecture'; commandeId: string; action: ActionRestaurateur; erreur: ErreurRestaurateur | null; sessionTerminee: string | null; valeurs?: ValeursPropositionRestaurateur }
  | { phase: 'verdict'; commandeId: string; action: ActionRestaurateur; verdict: VerdictAction; lectureVerdict: number };
export const ETAT_REPOS: EtatAction = { phase: 'repos' };

export type EvenementAction =
  | { type: 'demander_confirmation'; commandeId: string; action: ActionRestaurateur; lecture: number; paiementStatut?: StatutPaiementRestaurateur; paiementMode?: ModePaiementRestaurateur | null }
  | { type: 'annuler_confirmation' }
  | { type: 'ouvrir_proposition'; commandeId: string; actuel: PrixActuels; lecture: number }
  | { type: 'saisir'; champ: ChampProposition; valeur: string }
  | { type: 'valider_saisie' }
  | { type: 'modifier_saisie' }
  | { type: 'envoyer'; commandeId: string; action: ActionRestaurateur; lecture: number; paiementStatut?: StatutPaiementRestaurateur; paiementMode?: ModePaiementRestaurateur | null }
  | { type: 'repondre'; erreur: ErreurRestaurateur | null; sessionTerminee?: string | null }
  | { type: 'relire'; relue: CommandeRestaurateur | null | undefined; lecture: number }
  | { type: 'effacer' };

/** Un formulaire de proposition est ouvert (saisie ou récapitulatif) : aucune autre action n'est envoyée tant qu'il n'est pas fermé. */
export function formulaireOuvert(etat: EtatAction): boolean { return etat.phase === 'saisie' || etat.phase === 'recapitulatif'; }

/**
 * Verrou des boutons. `lecture` est un compteur qui augmente à chaque lecture RÉUSSIE de la liste. Verrouillé : pendant l'envoi et la relecture qui suit ; et après un verdict
 * incertain sans relecture réussie, tant que le compteur n'a pas changé (donc jusqu'à une relecture réussie). Un seul envoi à la fois pour tout l'écran.
 */
export function actionVerrouillee(etat: EtatAction, lecture: number): boolean {
  if (etat.phase === 'envoi' || etat.phase === 'relecture') return true;
  return etat.phase === 'verdict' && etat.verdict.genre === 'incertain' && !etat.verdict.reessayer && etat.lectureVerdict === lecture;
}
/**
 * Un refus, une annulation ou un « paiement non reçu » n'est envoyé qu'après SA confirmation (même commande, même action) ; une proposition de prix, qu'après son récapitulatif
 * (même commande) ; les autres actions, jamais pendant un verrou. Tant qu'un formulaire de proposition est ouvert, rien d'autre que cette proposition ne part.
 */
export function peutEnvoyer(etat: EtatAction, commandeId: string, action: ActionRestaurateur, lecture: number, paiementStatut?: StatutPaiementRestaurateur, paiementMode?: ModePaiementRestaurateur | null): boolean {
  if (!(ACTIONS_RESTAURATEUR as readonly string[]).includes(action)) return false;
  // Garde de la machine (écran contourné ou liste périmée) : « annuler » ne part jamais sans un statut de paiement connu ET non payé.
  if (action === 'annuler' && (paiementStatut === undefined || commandePayee(paiementStatut, paiementMode))) return false;
  if (actionVerrouillee(etat, lecture)) return false;
  if (action === 'proposer') return etat.phase === 'recapitulatif' && etat.commandeId === commandeId;
  if (formulaireOuvert(etat)) return false;
  return (ACTIONS_A_CONFIRMER as readonly string[]).includes(action) ? etat.phase === 'confirmation' && etat.commandeId === commandeId && etat.action === action : true;
}

/** Transitions, une par événement. Un événement hors de son contexte (ou refusé par le verrou) laisse l'état inchangé : jamais d'envoi sans passage par `envoyer`. */
export function evoluer(etat: EtatAction, ev: EvenementAction): EtatAction {
  switch (ev.type) {
    case 'demander_confirmation':
      if (ev.action === 'annuler' && (ev.paiementStatut === undefined || commandePayee(ev.paiementStatut, ev.paiementMode))) return etat;
      return actionVerrouillee(etat, ev.lecture) || formulaireOuvert(etat) || !(ACTIONS_A_CONFIRMER as readonly string[]).includes(ev.action) ? etat : { phase: 'confirmation', commandeId: ev.commandeId, action: ev.action };
    case 'annuler_confirmation':
      return etat.phase === 'confirmation' || formulaireOuvert(etat) ? ETAT_REPOS : etat;
    case 'ouvrir_proposition':
      if (actionVerrouillee(etat, ev.lecture) || formulaireOuvert(etat)) return etat;
      return { phase: 'saisie', commandeId: ev.commandeId, actuel: ev.actuel, brouillon: { sousTotal: String(ev.actuel.sousTotalGnf), frais: String(ev.actuel.fraisGnf), conditions: '' }, erreurs: {} };
    case 'saisir':
      return etat.phase === 'saisie' && typeof ev.valeur === 'string' ? { ...etat, brouillon: { ...etat.brouillon, [ev.champ]: ev.valeur }, erreurs: {} } : etat;
    case 'valider_saisie': {
      if (etat.phase !== 'saisie') return etat;
      const p = preparerProposition(etat.actuel, etat.brouillon);
      return p.ok ? { phase: 'recapitulatif', commandeId: etat.commandeId, actuel: etat.actuel, brouillon: etat.brouillon, valeurs: p.valeurs, recap: p.recap } : { ...etat, erreurs: p.erreurs };
    }
    case 'modifier_saisie':
      return etat.phase === 'recapitulatif' ? { phase: 'saisie', commandeId: etat.commandeId, actuel: etat.actuel, brouillon: etat.brouillon, erreurs: {} } : etat;
    case 'envoyer':
      if (!peutEnvoyer(etat, ev.commandeId, ev.action, ev.lecture, ev.paiementStatut, ev.paiementMode)) return etat;
      return etat.phase === 'recapitulatif' && ev.action === 'proposer' ? { phase: 'envoi', commandeId: ev.commandeId, action: 'proposer', valeurs: etat.valeurs } : { phase: 'envoi', commandeId: ev.commandeId, action: ev.action };
    case 'repondre':
      return etat.phase === 'envoi' ? { phase: 'relecture', commandeId: etat.commandeId, action: etat.action, erreur: ev.erreur, sessionTerminee: ev.sessionTerminee ?? null, ...(etat.valeurs ? { valeurs: etat.valeurs } : {}) } : etat;
    case 'relire':
      return etat.phase === 'relecture'
        ? { phase: 'verdict', commandeId: etat.commandeId, action: etat.action, verdict: verdictAction({ erreur: etat.erreur, sessionTerminee: etat.sessionTerminee, action: etat.action, relue: ev.relue, valeurs: etat.valeurs }), lectureVerdict: ev.lecture }
        : etat;
    case 'effacer':
      return ETAT_REPOS;
  }
}
