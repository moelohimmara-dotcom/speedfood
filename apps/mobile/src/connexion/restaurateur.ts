import { MESSAGE_SECURITE_SUR_LE_SITE, type RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';

/**
 * Domaine pur du lot D1 : l'espace restaurateur de l'application (lire les commandes, ACCEPTER ou REFUSER). Rien d'autre : ni « prête », ni « terminée », ni paiement,
 * ni proposition de prix (lots suivants). L'affichage de l'entrée « Espace restaurateur » n'est qu'un confort : le serveur revérifie tout (jeton, restaurant du compte,
 * second facteur, questions de sécurité).
 *
 * Même discipline que `reglement.ts` : UN SEUL essai par action, jamais de relance automatique ; après une réponse incertaine, les boutons restent verrouillés tant que
 * la liste n'a pas été relue avec succès ; les messages sont fixes (aucun texte du serveur n'est affiché) ; aucun jeton n'est conservé.
 */
export type ActionRestaurateur = 'accepter' | 'refuser';

function invalide(): never { throw Error('LECTURE_RESTAURATEUR_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
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
export interface LigneRestaurateur { nom: string; quantite: number; prixGnf: number; options: string[] }
export interface CommandeRestaurateur {
  id: string; reference: string; statut: StatutRestaurateur; mode: 'retrait' | 'livraison' | 'sur_place'; tableNumero: string | null;
  clientNom: string; clientTelephone: string; clientAdresse: string | null; totalGnf: number; creeLe: string; estTest: boolean;
  lignes: LigneRestaurateur[]; propositionEnAttente: boolean;
}
export interface ListeRestaurateur { restaurant: { id: string; nom: string; ouvert: boolean; accepteCommandes: boolean } | null; commandes: CommandeRestaurateur[] }

/**
 * Lecture STRICTE de `GET /api/v1/restaurant/commandes` : valeur inconnue = refus. Seuls les champs affichés sont retenus : AUCUN jeton (reçu, suivi) n'est lu ni conservé,
 * même si le serveur en envoyait un.
 */
export function lireListeRestaurateur(v: Record<string, unknown>): ListeRestaurateur {
  if (v.ok !== true || !Array.isArray(v.commandes) || v.commandes.length > 700) return invalide();
  const r = v.restaurant === null ? null : objet(v.restaurant);
  const ids = new Set<string>();
  const commandes = v.commandes.map((x): CommandeRestaurateur => {
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
      return { nom: texte(p.nom, 120), quantite, prixGnf: montant(p.prix), options: p.options.map(q => texte(objet(q).nom, 120)) };
    });
    const total = montant(o.sousTotal) + montant(o.fraisLivraisonEstime);
    if (!Number.isSafeInteger(total)) return invalide();
    return {
      id, reference: texte(o.reference, 40), statut: o.statut as StatutRestaurateur, mode: o.mode, tableNumero: texteOuNull(o.tableNumero, 20), clientNom: texte(o.clientNom, 120),
      clientTelephone: texte(o.clientTelephone, 40), clientAdresse: texteOuNull(o.clientAdresse, 300), totalGnf: total, creeLe: date(o.creeLe), estTest: booleen(o.estTest), lignes,
      propositionEnAttente: o.propositionActive !== null && o.propositionActive !== undefined,
    };
  });
  return { restaurant: r === null ? null : { id: texte(r.id, 36), nom: texte(r.nom, 200), ouvert: booleen(r.ouvert), accepteCommandes: booleen(r.accepteCommandes) }, commandes };
}

export type GroupeCommandes = 'a_traiter' | 'en_cours' | 'historique';
export const TITRES_GROUPES: Record<GroupeCommandes, string> = { a_traiter: 'À traiter', en_cours: 'En cours', historique: 'Historique récent' };
export function groupeDe(statut: StatutRestaurateur): GroupeCommandes { return statut === 'en_attente' ? 'a_traiter' : statut === 'acceptee' || statut === 'prete' ? 'en_cours' : 'historique'; }
/** Trois groupes, dans cet ordre ; l'ordre reçu du serveur (plus récente d'abord) est conservé à l'intérieur de chaque groupe. */
export function grouper(commandes: readonly CommandeRestaurateur[]): Array<{ groupe: GroupeCommandes; titre: string; commandes: CommandeRestaurateur[] }> {
  return (['a_traiter', 'en_cours', 'historique'] as const).map(groupe => ({ groupe, titre: TITRES_GROUPES[groupe], commandes: commandes.filter(c => groupeDe(c.statut) === groupe) }));
}

/** Les deux seuls boutons de ce lot : sur une commande en attente, sauf si une proposition attend la réponse du client (le serveur refuserait). */
export function actionsPossibles(c: Pick<CommandeRestaurateur, 'statut' | 'propositionEnAttente'>): ActionRestaurateur[] {
  return c.statut === 'en_attente' && !c.propositionEnAttente ? ['accepter', 'refuser'] : [];
}

/** Les boutons réellement affichés : une commande dont l'acceptation ou le refus vient d'être confirmé n'en porte plus, même si la liste relue n'a pas pu la mettre à jour. */
export function actionsAffichees(c: Pick<CommandeRestaurateur, 'id' | 'statut' | 'propositionEnAttente'>, etat: EtatAction): ActionRestaurateur[] {
  if (etat.phase === 'verdict' && etat.commandeId === c.id && etat.verdict.genre === 'confirme') return [];
  return actionsPossibles(c);
}

export const LIBELLES_STATUT: Record<StatutRestaurateur, string> = {
  en_attente: 'En attente de votre réponse', acceptee: 'Acceptée', prete: 'Prête', terminee: 'Terminée', refusee: 'Refusée', annulee: 'Annulée',
};
export function libelleStatut(c: Pick<CommandeRestaurateur, 'statut' | 'propositionEnAttente'>): string {
  return c.statut === 'en_attente' && c.propositionEnAttente ? 'Proposition envoyée : attente de la réponse du client' : LIBELLES_STATUT[c.statut];
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

const ATTENDUS: Record<ActionRestaurateur, readonly StatutRestaurateur[]> = { accepter: ['acceptee', 'prete', 'terminee'], refuser: ['refusee'] };

/**
 * Issue d'une tentative. `erreur` null = le serveur a répondu {ok:true}. Après une réponse INCONNUE, la liste relue décide : si elle montre l'état attendu, l'action est enregistrée ;
 * si la commande est encore en attente, « réessayer » est permis ; si la relecture a échoué (`relue` indéfinie), elle est interdite (jamais à l'aveugle). Un refus certain n'est jamais
 * converti en succès.
 */
export function verdictAction(e: { erreur: ErreurRestaurateur | null; sessionTerminee?: string | null; action: ActionRestaurateur; relue: CommandeRestaurateur | null | undefined }): VerdictAction {
  if (e.sessionTerminee) return { genre: 'session', message: e.sessionTerminee };
  if (e.erreur === null) return { genre: 'confirme', message: e.action === 'accepter' ? 'Commande acceptée.' : 'Commande refusée.' };
  if (e.erreur.genre === 'securite') return { genre: 'securite', message: MESSAGE_SECURITE };
  if (!e.erreur.incertain) return { genre: 'refus', message: e.erreur.message, reessayer: false };
  if (e.relue === undefined) return { genre: 'incertain', message: e.erreur.message + ' La liste n’a pas pu être relue : actualisez-la avant de réessayer.', reessayer: false };
  if (e.relue === null) return { genre: 'refus', message: 'Cette commande n’apparaît plus dans la liste. Actualisez la liste.', reessayer: false };
  if ((ATTENDUS[e.action] as readonly string[]).includes(e.relue.statut)) return { genre: 'confirme', message: e.action === 'accepter' ? 'Votre acceptation est bien enregistrée.' : 'Votre refus est bien enregistré.' };
  if (e.relue.statut === 'en_attente') return { genre: 'incertain', message: 'La liste relue ne montre pas votre réponse : elle n’a pas été enregistrée. Vous pouvez réessayer.', reessayer: true };
  return { genre: 'refus', message: 'La commande a changé d’état entre-temps : ' + LIBELLES_STATUT[e.relue.statut].toLowerCase() + '.', reessayer: false };
}

// ---------- machine d'états de l'écran ----------
export type EtatAction =
  | { phase: 'repos' }
  | { phase: 'confirmation_refus'; commandeId: string }
  | { phase: 'envoi'; commandeId: string; action: ActionRestaurateur }
  | { phase: 'relecture'; commandeId: string; action: ActionRestaurateur; erreur: ErreurRestaurateur | null; sessionTerminee: string | null }
  | { phase: 'verdict'; commandeId: string; action: ActionRestaurateur; verdict: VerdictAction; lectureVerdict: number };
export const ETAT_REPOS: EtatAction = { phase: 'repos' };

export type EvenementAction =
  | { type: 'demander_refus'; commandeId: string; lecture: number }
  | { type: 'annuler_refus' }
  | { type: 'envoyer'; commandeId: string; action: ActionRestaurateur; lecture: number }
  | { type: 'repondre'; erreur: ErreurRestaurateur | null; sessionTerminee?: string | null }
  | { type: 'relire'; relue: CommandeRestaurateur | null | undefined; lecture: number }
  | { type: 'effacer' };

/**
 * Verrou des boutons. `lecture` est un compteur qui augmente à chaque lecture RÉUSSIE de la liste. Verrouillé : pendant l'envoi et la relecture qui suit ; et après un verdict
 * incertain sans relecture réussie, tant que le compteur n'a pas changé (donc jusqu'à une relecture réussie). Un seul envoi à la fois pour tout l'écran.
 */
export function actionVerrouillee(etat: EtatAction, lecture: number): boolean {
  if (etat.phase === 'envoi' || etat.phase === 'relecture') return true;
  return etat.phase === 'verdict' && etat.verdict.genre === 'incertain' && !etat.verdict.reessayer && etat.lectureVerdict === lecture;
}
/** Un refus n'est envoyé qu'après sa confirmation (même commande) ; une acceptation, jamais pendant un verrou. */
export function peutEnvoyer(etat: EtatAction, commandeId: string, action: ActionRestaurateur, lecture: number): boolean {
  if (actionVerrouillee(etat, lecture)) return false;
  return action === 'refuser' ? etat.phase === 'confirmation_refus' && etat.commandeId === commandeId : true;
}

/** Transitions, une par événement. Un événement hors de son contexte (ou refusé par le verrou) laisse l'état inchangé : jamais d'envoi sans passage par `envoyer`. */
export function evoluer(etat: EtatAction, ev: EvenementAction): EtatAction {
  switch (ev.type) {
    case 'demander_refus':
      return actionVerrouillee(etat, ev.lecture) ? etat : { phase: 'confirmation_refus', commandeId: ev.commandeId };
    case 'annuler_refus':
      return etat.phase === 'confirmation_refus' ? ETAT_REPOS : etat;
    case 'envoyer':
      return peutEnvoyer(etat, ev.commandeId, ev.action, ev.lecture) ? { phase: 'envoi', commandeId: ev.commandeId, action: ev.action } : etat;
    case 'repondre':
      return etat.phase === 'envoi' ? { phase: 'relecture', commandeId: etat.commandeId, action: etat.action, erreur: ev.erreur, sessionTerminee: ev.sessionTerminee ?? null } : etat;
    case 'relire':
      return etat.phase === 'relecture'
        ? { phase: 'verdict', commandeId: etat.commandeId, action: etat.action, verdict: verdictAction({ erreur: etat.erreur, sessionTerminee: etat.sessionTerminee, action: etat.action, relue: ev.relue }), lectureVerdict: ev.lecture }
        : etat;
    case 'effacer':
      return ETAT_REPOS;
  }
}
