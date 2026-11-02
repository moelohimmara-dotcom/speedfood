import type { CreationCommandePayload } from '../../../../packages/shared/src/contracts/commande.ts';
import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';
import { chiffrer, type PanierReel } from './panier-reel.ts';

/**
 * Domaine pur de l'envoi d'une commande en RETRAIT depuis l'application (lot A).
 * Aucun prix par ligne n'est envoyé : le serveur recalcule, on ne transmet que `sousTotalAffiche` pour comparaison.
 * Règles reprises du serveur (apps/web/src/lib/commande/validation.ts) : nom 2 à 120 caractères, téléphone guinéen normalisé en +224…,
 * clé d'idempotence = UUID v4.
 */
export const NOM_MIN = 2;
export const NOM_MAX = 120;
const CLE_IDEMPOTENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JETON_SUIVI = /^[A-Za-z0-9_-]{40}$/;
const REFERENCE = /^[A-Za-z0-9-]{1,40}$/;

export type GenreErreurCommande = 'validation' | 'session' | 'prix' | 'trop_de_requetes' | 'serveur' | 'reseau' | 'reponse_invalide';

/** Erreur d'envoi de commande. `incertain` : la commande a pu être créée côté serveur (rejouer avec la MÊME clé, ou vérifier ses commandes). */
export class ErreurCommande extends Error {
  genre: GenreErreurCommande; incertain: boolean; sousTotalServeur: number | null;
  /** Vrai seulement si la réponse PROUVE qu'aucune commande n'a été créée (400 et 409 du serveur) : seul cas où un envoi incertain peut être abandonné d'office. */
  absenceProuvee: boolean;
  constructor(genre: GenreErreurCommande, message: string, incertain = false, sousTotalServeur: number | null = null, absenceProuvee = false) {
    super(message); this.absenceProuvee = absenceProuvee; this.name = 'ErreurCommande'; this.genre = genre; this.incertain = incertain; this.sousTotalServeur = sousTotalServeur;
  }
}

/** Table des refus du serveur : statut HTTP (et code `erreur.code` pour distinguer 409) vers un message français fixe. Aucun texte brut du serveur n'est affiché. */
export function refusServeur(statut: number, code: string | null, sousTotalServeur: number | null = null): ErreurCommande {
  const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
  if (statut === 400) return new ErreurCommande('validation', 'Votre commande n’a pas été acceptée : vérifiez votre nom, votre téléphone et vos plats (un plat n’est peut-être plus disponible), puis actualisez le panier.', false, null, true);
  if (statut === 401 || statut === 403) return new ErreurCommande('session', 'Votre session a expiré. Reconnectez-vous depuis « Mon compte », puis renvoyez votre commande.');
  if (statut === 409 || code === 'CONFLIT_ETAT') {
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

export interface SaisieCommande { nom: string; telephone: string; consentement: boolean }
export interface ErreursSaisie { nom?: string; telephone?: string; consentement?: string; panier?: string }

/** Validation côté client, pour afficher les erreurs vite : le serveur revalide tout. */
export function validerSaisie(s: SaisieCommande): { erreurs: ErreursSaisie; nom: string; telephone: string | null } {
  const erreurs: ErreursSaisie = {};
  const nom = s.nom.trim();
  if (nom.length < NOM_MIN || nom.length > NOM_MAX) erreurs.nom = `Indiquez votre nom (${NOM_MIN} à ${NOM_MAX} caractères).`;
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
 * Construit le corps de la commande (retrait) à partir du panier réel, des prix relus et de la saisie.
 * Aucune option n'est proposée dans l'application : `optionIds` reste vide (le catalogue public ne porte ni option ni supplément).
 */
export function preparerEnvoi(panier: PanierReel, plats: readonly PlatCataloguePublic[], saisie: SaisieCommande, tentative: Tentative, compteId = ''): PreparationEnvoi {
  const { erreurs, nom, telephone } = validerSaisie(saisie);
  const bilan = chiffrer(panier, plats);
  if (!panier.restaurantId || !panier.lignes.length) erreurs.panier = 'Votre panier est vide.';
  else if (bilan.total === null) erreurs.panier = 'Le total doit être vérifié : actualisez le panier.';
  if (erreurs.nom || erreurs.telephone || erreurs.consentement || erreurs.panier || telephone === null || bilan.total === null || !panier.restaurantId) return { ok: false, erreurs };
  const lignes = panier.lignes.map(l => ({ menuItemId: l.platId, quantite: l.quantite, optionIds: [] as string[] }));
  const empreinte = JSON.stringify([compteId, panier.restaurantId, lignes, nom, telephone, bilan.total]);
  return { ok: true, payload: {
    cleIdempotence: tentative.cle(empreinte), restaurantId: panier.restaurantId,
    client: { nom, telephone, adresse: null }, mode: 'retrait', lignes, sousTotalAffiche: bilan.total, consentementReglement: true,
  } };
}
