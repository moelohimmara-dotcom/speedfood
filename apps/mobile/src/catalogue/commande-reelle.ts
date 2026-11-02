import type { CreationCommandePayload } from '../../../../packages/shared/src/contracts/commande.ts';
import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';
import { chiffrer, type PanierReel } from './panier-reel.ts';

/**
 * Domaine pur de l'envoi d'une commande en RETRAIT (lot A) ou en LIVRAISON (lot B) depuis l'application.
 * Livraison : adresse 5 à 300 caractères, quartier obligatoire (`destination.quartierId`), `fraisAffiches` = frais du DERNIER calcul du serveur pour ce quartier et ce sous-total
 * (absent si le calcul est éteint : `non_calcule`). Le serveur recalcule et refuse (409) si les frais ont changé ; `sur_place` n'est jamais envoyé.
 * Aucun prix par ligne n'est envoyé : le serveur recalcule, on ne transmet que `sousTotalAffiche` pour comparaison.
 * Règles reprises du serveur (apps/web/src/lib/commande/validation.ts) : nom 2 à 120 caractères, téléphone guinéen normalisé en +224…,
 * clé d'idempotence = UUID v4.
 */
export const NOM_MIN = 2;
export const NOM_MAX = 120;
const CLE_IDEMPOTENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ADRESSE_MIN = 5;
export const ADRESSE_MAX = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JETON_SUIVI = /^[A-Za-z0-9_-]{40}$/;
const REFERENCE = /^[A-Za-z0-9-]{1,40}$/;

export type GenreErreurCommande = 'validation' | 'session' | 'prix' | 'frais' | 'trop_de_requetes' | 'serveur' | 'reseau' | 'reponse_invalide';

/** Erreur d'envoi de commande. `incertain` : la commande a pu être créée côté serveur (rejouer avec la MÊME clé, ou vérifier ses commandes). */
export class ErreurCommande extends Error {
  genre: GenreErreurCommande; incertain: boolean; sousTotalServeur: number | null;
  /** Nouveaux frais de livraison annoncés par le serveur (409 « frais changés »), sinon null. */
  fraisServeur: number | null;
  /** Vrai seulement si la réponse PROUVE qu'aucune commande n'a été créée (400 et 409 du serveur) : seul cas où un envoi incertain peut être abandonné d'office. */
  absenceProuvee: boolean;
  constructor(genre: GenreErreurCommande, message: string, incertain = false, sousTotalServeur: number | null = null, absenceProuvee = false, fraisServeur: number | null = null) {
    super(message); this.fraisServeur = fraisServeur; this.absenceProuvee = absenceProuvee; this.name = 'ErreurCommande'; this.genre = genre; this.incertain = incertain; this.sousTotalServeur = sousTotalServeur;
  }
}

/** Table des refus du serveur : statut HTTP (et code `erreur.code` pour distinguer 409) vers un message français fixe. Aucun texte brut du serveur n'est affiché. */
export function refusServeur(statut: number, code: string | null, sousTotalServeur: number | null = null, fraisServeur: number | null = null, livraison = false): ErreurCommande {
  const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
  if (statut === 400) return new ErreurCommande('validation', livraison
    ? 'Votre commande n’a pas été acceptée : vérifiez votre nom, votre téléphone, votre adresse, votre quartier (la livraison n’est peut-être pas possible vers ce quartier) et vos plats, puis actualisez le panier.'
    : 'Votre commande n’a pas été acceptée : vérifiez votre nom, votre téléphone et vos plats (un plat n’est peut-être plus disponible), puis actualisez le panier.', false, null, true);
  if (statut === 401 || statut === 403) return new ErreurCommande('session', 'Votre session a expiré. Reconnectez-vous depuis « Mon compte », puis renvoyez votre commande.');
  if (statut === 409 || code === 'CONFLIT_ETAT') {
    // Frais de livraison changés : aucune commande n'a été créée ; le client doit voir le nouveau montant et confirmer de nouveau.
    if (fraisServeur !== null) return new ErreurCommande('frais', `Les frais de livraison ont changé : ils sont maintenant de ${gnf(fraisServeur)}. Vérifiez le nouveau total, puis confirmez de nouveau.`, false, null, true, fraisServeur);
    // Livraison : un 409 sans montant lisible (ni prix ni frais) reste un conflit de montant ; on invalide l'estimation (genre `frais`) par prudence.
    if (livraison && sousTotalServeur === null) return new ErreurCommande('frais', 'Les prix ou les frais de livraison ont changé. Vérifiez le nouveau total, puis confirmez de nouveau.', false, null, true, null);
    return new ErreurCommande('prix', sousTotalServeur !== null
      ? `Les prix ont changé : le total est maintenant de ${gnf(sousTotalServeur)}. Actualisez le panier, vérifiez-le, puis confirmez de nouveau.`
      : 'Les prix ont changé. Actualisez le panier, vérifiez le nouveau total, puis confirmez de nouveau.', false, sousTotalServeur, true);
  }
  if (statut === 429) return new ErreurCommande('trop_de_requetes', 'Trop de tentatives. Patientez un instant avant de renvoyer votre commande.');
  if (statut >= 500) return new ErreurCommande('serveur', 'Le service est indisponible. Votre commande a peut-être été enregistrée : vérifiez vos commandes ou réessayez.', true);
  return new ErreurCommande('validation', 'Votre commande n’a pas pu être envoyée. Actualisez le panier puis réessayez.');
}
export const erreurReseau = () => new ErreurCommande('reseau', 'Impossible de joindre Speedfood. Votre commande a peut-être été enregistrée : vérifiez vos commandes ou réessayez.', true);
export const erreurReponse = () => new ErreurCommande('reponse_invalide', 'Réponse du service illisible. Votre commande a peut-être été enregistrée : vérifiez vos commandes avant de réessayer.', true);

/** Contrôle strict de la réponse 200/201. Le jeton n'est jamais recopié dans une erreur. */
export function lireReponseCreation(statut: number, v: unknown): { reference: string; jeton: string; idempotent: boolean } {
  if (statut !== 200 && statut !== 201) throw erreurReponse();
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw erreurReponse();
  const o = v as Record<string, unknown>;
  if (o.ok !== true || typeof o.reference !== 'string' || !REFERENCE.test(o.reference) || typeof o.jeton !== 'string' || !JETON_SUIVI.test(o.jeton) || typeof o.idempotent !== 'boolean') throw erreurReponse();
  if (o.idempotent !== (statut === 200)) throw erreurReponse();
  return { reference: o.reference, jeton: o.jeton, idempotent: o.idempotent };
}

export type GenerateurCle = () => string;
type WebCrypto = { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
/** Sources d'aléa cryptographique, par ordre de préférence. Injectables pour les tests (Node n'a pas le module natif). */
export interface SourcesCle { expo?: (() => string) | null; web?: WebCrypto | null }
/** `expo-crypto` est natif : chargé en protégé (absent sous Node, absent d'un binaire non reconstruit) ; jamais d'exception ici. */
function sourceExpo(): (() => string) | null {
  try { const m = require('expo-crypto') as { randomUUID?: () => string }; return typeof m.randomUUID === 'function' ? m.randomUUID : null; } catch { return null; }
}
export function sourcesParDefaut(): SourcesCle { return { expo: sourceExpo(), web: (globalThis as { crypto?: WebCrypto }).crypto ?? null }; }
function uuidDepuisOctets(b: Uint8Array): string {
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
/** UUID v4 aléatoire (expo-crypto en priorité). Refuse de produire une clé faible : sans générateur cryptographique, l'envoi est bloqué, jamais de Math.random. */
export function genererCleIdempotence(sources: SourcesCle = sourcesParDefaut()): string {
  const essais: (() => string)[] = [];
  if (sources.expo) { const g = sources.expo; essais.push(() => g()); }
  const w = sources.web;
  if (w?.randomUUID) essais.push(() => w.randomUUID!());
  if (w?.getRandomValues) essais.push(() => uuidDepuisOctets(w.getRandomValues!(new Uint8Array(16))));
  for (const essai of essais) {
    let cle: string | null = null;
    try { cle = essai(); } catch { cle = null; }
    if (cle && CLE_IDEMPOTENCE.test(cle)) return cle;
  }
  throw new ErreurCommande('validation', 'Cet appareil ne peut pas sécuriser l’envoi de la commande. Mettez l’application à jour.');
}

export type ModeCommande = 'retrait' | 'livraison';
/** Réponse du serveur à l'estimation (`ok`) ou calcul éteint (`non_calcule`). Une réponse `erreur` n'est jamais conservée comme estimation. */
export type EstimationLivraison =
  | { statut: 'non_calcule' }
  | { statut: 'ok'; fraisGnf: number; distanceKm: number; gratuite: boolean; dureeMinutes: number; libelle: string };
export type ResultatEstimation = EstimationLivraison | { statut: 'erreur' };
/** Estimation OBTENUE pour un restaurant, un quartier et un sous-total précis : périmée (donc inutilisable) dès que l'un des trois change. */
export interface EstimationObtenue { restaurantId: string; quartierId: string; sousTotal: number; estimation: EstimationLivraison }
export interface SaisieCommande { nom: string; telephone: string; consentement: boolean; mode?: ModeCommande; adresse?: string; quartierId?: string | null; estimation?: EstimationObtenue | null }
export interface ErreursSaisie { nom?: string; telephone?: string; consentement?: string; panier?: string; adresse?: string; quartier?: string; livraison?: string }

/** Contrôle strict de la réponse de `POST /api/v1/livraison/estimation` ({ok, estimation}). Le texte brut du serveur n'est jamais conservé. */
export function lireEstimation(v: unknown): ResultatEstimation {
  const illisible = () => new ErreurCommande('reponse_invalide', 'Réponse du service illisible.');
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw illisible();
  const o = v as Record<string, unknown>; const e = o.estimation as Record<string, unknown> | null | undefined;
  if (o.ok !== true || !e || typeof e !== 'object' || Array.isArray(e)) throw illisible();
  if (e.statut === 'non_calcule') return { statut: 'non_calcule' };
  if (e.statut === 'erreur') return { statut: 'erreur' };
  if (e.statut === 'ok' && typeof e.fraisGnf === 'number' && Number.isSafeInteger(e.fraisGnf) && e.fraisGnf >= 0 && typeof e.distanceKm === 'number' && Number.isFinite(e.distanceKm) && e.distanceKm >= 0
    && typeof e.gratuite === 'boolean' && typeof e.dureeMinutes === 'number' && Number.isSafeInteger(e.dureeMinutes) && e.dureeMinutes >= 0 && typeof e.libelle === 'string' && e.libelle.length <= 300) {
    return { statut: 'ok', fraisGnf: e.fraisGnf, distanceKm: e.distanceKm, gratuite: e.gratuite, dureeMinutes: e.dureeMinutes, libelle: e.libelle };
  }
  throw illisible();
}
/** Frais à compter dans le total affiché : 0 si le calcul est éteint, `null` tant qu'aucune estimation n'existe. */
export function fraisDeLEstimation(e: EstimationLivraison | null): number | null { return e === null ? null : e.statut === 'ok' ? e.fraisGnf : 0; }
/** L'estimation détenue correspond-elle EXACTEMENT à la demande courante (restaurant, quartier, sous-total) ? */
export function estimationValable(e: EstimationObtenue | null | undefined, restaurantId: string | null, quartierId: string | null | undefined, sousTotal: number | null): e is EstimationObtenue {
  return !!e && restaurantId !== null && quartierId != null && sousTotal !== null && e.restaurantId === restaurantId && e.quartierId === quartierId && e.sousTotal === sousTotal;
}
/** La liste des quartiers n'est lue qu'au premier passage en LIVRAISON (jamais en retrait), et relue seulement après un échec. */
export function doitChargerQuartiers(ouvert: boolean, mode: ModeCommande, etat: 'aucun' | 'chargement' | 'ok' | 'erreur'): boolean { return ouvert && mode === 'livraison' && etat === 'aucun'; }
/** Montant total estimé à l'écran : sous-total + frais ; `null` tant que l'un des deux manque. */
export function totalEstime(sousTotal: number | null, frais: number | null): number | null { return sousTotal === null || frais === null ? null : sousTotal + frais; }

/** Filtre de la liste des quartiers : sans accent ni casse, tous les mots saisis doivent apparaître ; au plus `max` résultats. */
export function filtrerQuartiers<T extends { libelle: string }>(liste: readonly T[], saisie: string, max = 8): T[] {
  const nettoyer = (t: string) => { let r = t.toLowerCase(); try { r = r.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { /* normalize indisponible : comparaison brute */ } return r.trim(); };
  const mots = nettoyer(saisie).split(/\s+/).filter(Boolean);
  const trouves: T[] = [];
  for (const q of liste) { if (mots.every(m => nettoyer(q.libelle).includes(m))) { trouves.push(q); if (trouves.length >= max) break; } }
  return trouves;
}

/** Validation côté client, pour afficher les erreurs vite : le serveur revalide tout. */
export function validerSaisie(s: SaisieCommande): { erreurs: ErreursSaisie; nom: string; telephone: string | null } {
  const erreurs: ErreursSaisie = {};
  const nom = s.nom.trim();
  if (nom.length < NOM_MIN || nom.length > NOM_MAX) erreurs.nom = `Indiquez votre nom (${NOM_MIN} à ${NOM_MAX} caractères).`;
  if (s.mode === 'livraison') {
    const adresse = (s.adresse ?? '').trim();
    if (adresse.length < ADRESSE_MIN || adresse.length > ADRESSE_MAX) erreurs.adresse = `Indiquez votre adresse de livraison (${ADRESSE_MIN} à ${ADRESSE_MAX} caractères).`;
    if (!s.quartierId || !UUID.test(s.quartierId)) erreurs.quartier = 'Choisissez votre quartier.';
  }
  const telephone = normaliserTelephone(s.telephone);
  if (telephone === null) erreurs.telephone = 'Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (ex. 622 12 34 56).';
  if (s.consentement !== true) erreurs.consentement = 'Cochez la case pour confirmer que vous réglerez au restaurant.';
  return { erreurs, nom, telephone };
}

/** Garde la clé d'idempotence d'UNE tentative : réutilisée tant que le contenu envoyé est identique, régénérée seulement s'il change. */
export function creerTentative(generer: GenerateurCle = genererCleIdempotence) {
  let courante: { empreinte: string; cle: string } | null = null;
  return {
    cle(empreinte: string): string { if (!courante || courante.empreinte !== empreinte) courante = { empreinte, cle: generer() }; return courante.cle; },
    oublier(): void { courante = null; },
  };
}
export type Tentative = ReturnType<typeof creerTentative>;

export type PreparationEnvoi = { ok: true; payload: CreationCommandePayload } | { ok: false; erreurs: ErreursSaisie };
/**
 * Construit le corps de la commande (retrait ou livraison) à partir du panier réel, des prix relus et de la saisie.
 * Aucune option n'est proposée dans l'application : `optionIds` reste vide (le catalogue public ne porte ni option ni supplément).
 */
export function preparerEnvoi(panier: PanierReel, plats: readonly PlatCataloguePublic[], saisie: SaisieCommande, tentative: Tentative, compteId = ''): PreparationEnvoi {
  const { erreurs, nom, telephone } = validerSaisie(saisie);
  const bilan = chiffrer(panier, plats);
  if (!panier.restaurantId || !panier.lignes.length) erreurs.panier = 'Votre panier est vide.';
  else if (bilan.total === null) erreurs.panier = 'Le total doit être vérifié : actualisez le panier.';
  const livraison = saisie.mode === 'livraison';
  if (saisie.mode !== undefined && saisie.mode !== 'retrait' && !livraison) erreurs.livraison = 'Ce mode de commande n’est pas pris en charge.'; // jamais sur_place
  // Livraison : l'estimation doit dater de CE restaurant, CE quartier et CE sous-total ; sinon elle est périmée et rien ne part.
  if (livraison && !erreurs.quartier && !estimationValable(saisie.estimation, panier.restaurantId, saisie.quartierId, bilan.total)) erreurs.livraison = 'Les frais de livraison doivent être recalculés avant l’envoi.';
  if (erreurs.nom || erreurs.telephone || erreurs.consentement || erreurs.panier || erreurs.adresse || erreurs.quartier || erreurs.livraison || telephone === null || bilan.total === null || !panier.restaurantId) return { ok: false, erreurs };
  const lignes = panier.lignes.map(l => ({ menuItemId: l.platId, quantite: l.quantite, optionIds: [] as string[] }));
  const base = { restaurantId: panier.restaurantId, lignes, sousTotalAffiche: bilan.total, consentementReglement: true };
  if (!livraison) {
    const empreinte = JSON.stringify([compteId, panier.restaurantId, 'retrait', lignes, nom, telephone, bilan.total]);
    return { ok: true, payload: { cleIdempotence: tentative.cle(empreinte), ...base, client: { nom, telephone, adresse: null }, mode: 'retrait' } };
  }
  const adresse = (saisie.adresse ?? '').trim(); const quartierId = saisie.quartierId as string; const est = (saisie.estimation as EstimationObtenue).estimation;
  const fraisAffiches = est.statut === 'ok' ? est.fraisGnf : undefined; // calcul éteint : aucun montant exigé ni envoyé
  // L'empreinte porte tout ce que le client a vu et confirmé : mode, adresse, quartier, frais. Si l'un change, la clé change.
  const empreinte = JSON.stringify([compteId, panier.restaurantId, 'livraison', lignes, nom, telephone, adresse, quartierId, fraisAffiches ?? null, bilan.total]);
  return { ok: true, payload: {
    cleIdempotence: tentative.cle(empreinte), ...base, client: { nom, telephone, adresse }, mode: 'livraison',
    destination: { quartierId }, ...(fraisAffiches !== undefined ? { fraisAffiches } : {}),
  } };
}
