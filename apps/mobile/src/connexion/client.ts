import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';
import { lireCommandes, lireSuivi } from './commandes.ts';
import { confirmationSuppressionValide, ErreurSuppressionCompte, MOT_CONFIRMATION } from './suppression-compte.ts';
import { traduireErreurAuth, verifierEmail, verifierInscription } from './auth-publique.ts';
import { ErreurEspaceClient, estUuid, lireEspaceComplet, validerAdresse, validerPseudo, verifierProfil, type ActionAdresse, type ChampsProfil, type EspaceComplet } from './espace-client.ts';
import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';
import { SITE_WEB } from './aide.ts';
import { ADRESSE_MAX, ADRESSE_MIN, ErreurCommande, erreurReseau, lireEstimation, lireReponseCreation, refusServeur, type ResultatEstimation } from '../catalogue/commande-reelle.ts';
import { ErreurReglement, MODES_REGLEMENT, erreurReponseReglement, erreurReseauReglement, lireReponseDeclaration, refusDeclaration } from './reglement.ts';
import { ACTIONS_DE_STATUT, ACTIONS_RESTAURATEUR, decisionPaiementDe, ErreurRestaurateur, erreurLocaleLivraison, erreurReponseLivraison, erreurReseauLivraison, refusLivraisonRestaurateur, erreurReponseRestaurateur, erreurReseauRestaurateur, lireListeRestaurateur, lireRaisonSecurite, lireReponseAction, lireRoles, refusRestaurateur, type ActionRestaurateur, type ListeRestaurateur, type RolesCompte, type TypeDocument, type ValeursPropositionRestaurateur } from './restaurateur.ts';
import { corpsDeAction, erreurLocalePhoto, erreurReponseService, erreurReseauPhoto, erreurReseauService, lireMenuRestaurateur, lireReglagesRestaurateur, refusService, type ActionService, type MenuRestaurateur, type ReglagesRestaurateur } from './serviceRestaurateur.ts';
import { CHEMIN_PHOTO_APP, PHOTO_TAILLE_MAX_OCTETS } from '../../../../packages/shared/src/contracts/restaurant-photo.ts';
import { lireValeursPropositionApp, type RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';
import { CHEMIN_LIVRAISON_APP, MESSAGE_CODE_LIVRAISON, lireActionLivraisonApp, lireDemandeLivraisonApp, type ActionLivraisonApp } from '../../../../packages/shared/src/contracts/restaurant-livraison.ts';
import { lireReferencePaiement } from '../../../../packages/shared/src/paiement/regles.ts';
import { ErreurLivreur, REGEX_UUID_LIVREUR, lireEnLigneLivreur, lireEtatLivreur, lireFicheLivreur, type DemandeCourseLivreur, type EtatLivreur, type FicheLivreur } from './livreur.ts';
import { lireGainsLivreur, lirePageCoursesLivreur, preparerPageCourses, type GainsLivreur, type PageCoursesLivreur } from './gains-livreur.ts';
import { ErreurCandidature, corpsCandidature as produireCorpsCandidature, lireLectureMenu, lireVueCandidature, type BrouillonCandidature, type LectureMenu, type VueCandidature } from './candidature.ts';
import { ErreurEquipe } from './equipe.ts';
import { DEBUT_PERIODE_FINANCES, FIN_PERIODE_FINANCES, lireFinancesEquipe, type FinancesEquipe } from './finances-equipe.ts';
import { lireTableauEquipe, type TableauEquipe } from './tableau-equipe.ts';
import {
  STATUTS_COMMANDE_EQUIPE, estActionRepartitionEquipe, lireAccesEquipe, lireCommandesARepartir, lireCommandesEquipe, lireCoordonneesEquipe, lireDetailCommandeEquipe, preparerMotifEquipe,
  type AccesEquipe, type ActionRepartitionEquipe, type CommandeARepartir, type CommandeEquipe, type CoordonneesEquipe, type ReponseDetailEquipe, type StatutCommandeEquipe,
} from './commandes-equipe.ts';
import { lirePaiementsEquipe, type PaiementsEquipe } from './paiements-equipe.ts';
import { lireExploitationEquipe, preparerActionLivraisonEquipe, preparerActionLivreurEquipe, type ExploitationEquipe } from './exploitation-equipe.ts';
import {
  STATUTS_PARTENARIAT_EQUIPE, STATUTS_REFERENCEMENT_EQUIPE, lireFicheRestaurantEquipe, lireMenusEquipe, lireOptionsReferencement, lirePartenariatsEquipe,
  lirePlatsMenuEquipe, lireReferencementsEquipe, lireRestaurantsEquipe, validerProfilSimpleEquipe,
  type DemandePartenariat, type DemandeReferencement, type FicheRestaurantEquipe, type MenusEquipe, type PlatMenuEquipe, type RestaurantEquipe,
} from './catalogue-equipe.ts';
import type { FichierPhotoPrete } from './serviceRestaurateur.ts';
import { lireFileLivreur, type FileLivreur } from './file-livreur.ts';
import { lireCorpsCourseLivreur, lireReponseActionLivreur } from '../../../../packages/shared/src/contracts/livreur-course.ts';
import { lirePageHistorique, preparerPageHistorique, type PageHistorique } from './historique-restaurateur.ts';
import { lireActiviteRestaurateur, type ActiviteRestaurateur } from './activite-restaurateur.ts';
import type { CreationCommandePayload } from '../../../../packages/shared/src/contracts/commande.ts';
const SUPABASE = 'https://ggldjdizqrtpetdiohxy.supabase.co';
export interface SessionAuth { accessToken: string; refreshToken: string; expiresAt: number; userId: string }
export interface ResumeCompte { pseudo: string | null; favoris: number; adresses: number }
export class ErreurConnexion extends Error {
  definitive: boolean;
  constructor(message: string, definitive = false) { super(message); this.name = 'ErreurConnexion'; this.definitive = definitive; }
}
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErreurConnexion('Réponse de connexion invalide.'); return v as Record<string, unknown>; }
function secret(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\s\x00-\x1f]/.test(v)) throw new ErreurConnexion('Réponse de connexion invalide.'); return v; }
/** Textes et table de refus d'une famille de routes du restaurateur (commandes, ou service et menu). */
interface TextesRestaurateur { nonMembre: string; lectureIllisible: string; refus: (statut: number, raison: RaisonSecuriteCompte | null, corps: unknown) => ErreurRestaurateur; reseau: () => ErreurRestaurateur; reponse: () => ErreurRestaurateur }
const TEXTES_COMMANDES: TextesRestaurateur = { nonMembre: 'Ce compte n’est rattaché à aucun restaurant, ou n’a pas le droit de voir ces commandes. Vérifiez votre accès sur le site.', lectureIllisible: 'Les commandes reçues sont illisibles. Réessayez dans un instant.', refus: refusRestaurateur, reseau: erreurReseauRestaurateur, reponse: erreurReponseRestaurateur };
/** Livraison par le restaurant (lot D5) : mêmes règles d'envoi, table de refus propre (code faux, essais restants, plafond atteint). */
const TEXTES_LIVRAISON: TextesRestaurateur = { nonMembre: 'Ce compte n’est rattaché à aucun restaurant.', lectureIllisible: 'Réponse du service illisible.', refus: refusLivraisonRestaurateur, reseau: erreurReseauLivraison, reponse: erreurReponseLivraison };
const TEXTES_SERVICE: TextesRestaurateur = { nonMembre: 'Ce compte n’est rattaché à aucun restaurant, ou n’a pas le droit de voir son service. Vérifiez votre accès sur le site.', lectureIllisible: 'Les informations reçues sont illisibles. Réessayez dans un instant.', refus: refusService, reseau: erreurReseauService, reponse: erreurReponseService };
/** Délai d'un envoi de photo (le fichier part sur le réseau mobile) : plus long que celui d'une commande ; après ce délai la réponse est « incertaine » (jamais de relance). */
export const DELAI_PHOTO_MS = 60000;
/**
 * Fichier d'un formulaire : un objet « fichier » (nom, type, taille, `bytes()`) dont les OCTETS sont déjà lus en mémoire. Cause réelle de l'échec du 4 novembre 2026 (APK release, Android 14) : depuis Expo SDK 57
 * le `fetch` global est `expo/fetch`, qui ne sait PAS envoyer l'objet `{ uri, name, type }` propre à React Native (`convertFormData.ts` : « `uri` is not supported for React Native's FormData » ; il lève
 * « Unsupported FormDataPart implementation » AVANT tout octet envoyé). Il accepte une chaîne, un Blob, ou un objet qui a `bytes()`. Les octets sont donc lus ICI, avant l'envoi : une photo qui ne se lit pas
 * est un échec LOCAL (rien n'est parti), jamais une réponse « incertaine ». Injectable pour les tests.
 */
export interface FichierFormulaire { name: string; type: string; size: number; bytes(): Promise<Uint8Array> }
export type LecteurFichierFormulaire = (f: { uri: string; nom: string; type: string }) => Promise<FichierFormulaire>;
export const fichierDeFormulaireNatif: LecteurFichierFormulaire = async (f) => {
  // Même lecture locale (`file://`) que la mesure de la taille dans photoPlatNatif.ts : aucun réseau.
  const reponse = await fetch(f.uri);
  if (!reponse.ok) throw new Error('lecture');
  const octets = new Uint8Array(await reponse.arrayBuffer());
  return { name: f.nom, type: f.type, size: octets.byteLength, bytes: async () => octets };
};
/** Octets d'une photo prête à partir : de 1 octet à 5 Mo, et signature JPEG (FF D8 FF). Sinon elle ne part pas. */
export function octetsDePhotoValides(octets: Uint8Array): boolean {
  return octets.byteLength > 0 && octets.byteLength <= PHOTO_TAILLE_MAX_OCTETS && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff;
}
/**
 * Un formulaire est « envoyable » quand chaque partie est une chaîne ou un fichier que le `fetch` sait lire (nom, type, `bytes()`). Contrôle fait AVANT le réseau : une partie d'une autre forme
 * (par exemple l'ancien `{ uri }`) est un défaut local, pas une panne réseau. Si l'implémentation ne permet pas de parcourir le formulaire, on ne peut rien affirmer : on laisse passer.
 */
export function formulaireEnvoyable(formulaire: FormData): boolean {
  const entries = (formulaire as unknown as { entries?: () => Iterable<[string, unknown]> }).entries;
  if (typeof entries !== 'function') return true;
  for (const [, v] of entries.call(formulaire)) {
    if (typeof v === 'string') continue;
    const f = v as { name?: unknown; type?: unknown; bytes?: unknown } | null;
    if (!f || typeof f !== 'object' || typeof f.name !== 'string' || typeof f.type !== 'string' || typeof f.bytes !== 'function') return false;
  }
  return true;
}
/** Code court (jeu fermé, jamais d'adresse, de jeton ni de contenu) d'une exception levée par le `fetch` pendant l'envoi d'une photo : lisible dans le message pour un prochain essai réel. */
export function codeEchecPhoto(e: unknown, delaiAtteint: boolean): 'delai' | 'formulaire' | 'reseau' {
  if (delaiAtteint) return 'delai';
  const m = e instanceof Error ? e.message : '';
  return /^Unsupported FormData/.test(m) ? 'formulaire' : 'reseau';
}
/** Message d'un refus du serveur (`erreur.message`), seulement s'il est un texte court et lisible ; sinon `null`. */
function messageServeurLivreur(corps: unknown): string | null {
  const m = corps && typeof corps === 'object' ? (corps as { erreur?: { message?: unknown } }).erreur?.message : undefined;
  if (typeof m !== 'string') return null;
  const propre = m.trim().replace(/\s+/g, ' ');
  return propre.length >= 1 && propre.length <= 200 ? propre : null;
}
export function creerAuth(fetcher: typeof fetch = fetch, delaiCommandeMs = 20000, fichierDeFormulaire: LecteurFichierFormulaire = fichierDeFormulaireNatif) {
  let configuration: Promise<string> | null = null;
  async function requete(url: string, options: RequestInit, auth = false, renouvellement = false, refus: Record<number,string> = {}) {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), 15000);
    try {
      const r = await fetcher(url, { ...options, credentials: 'omit', signal: controle.signal });
      if (!r.ok) {
        if (refus[r.status]) throw new ErreurConnexion(refus[r.status]);
        if (auth && (r.status === 401 || r.status === 403)) configuration = null;
        if (r.status === 429) throw new ErreurConnexion('Trop de tentatives. Patientez avant de réessayer.');
        if (auth && (r.status === 400 || r.status === 401 || r.status === 403)) throw new ErreurConnexion(renouvellement ? 'Votre session a expiré. Reconnectez-vous.' : 'Connexion refusée. Vérifiez vos identifiants et la confirmation de votre adresse.', true);
        if (r.status === 401 || r.status === 403) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.',true);
        throw new ErreurConnexion('Le service est indisponible. Réessayez dans un instant.');
      }
      if (r.status === 204) return {};
      if (!(r.headers.get('content-type') ?? '').includes('application/json') || Number(r.headers.get('content-length')) > 262144) throw new ErreurConnexion('Réponse de connexion invalide.');
      const texte = await r.text(); if (texte.length > 262144) throw new ErreurConnexion('Réponse de connexion invalide.');
      return objet(JSON.parse(texte));
    } catch (e) { if (e instanceof ErreurConnexion) throw e; throw new ErreurConnexion('Impossible de joindre Speedfood. Vérifiez votre connexion.'); }
    finally { clearTimeout(timer); }
  }
  async function cle() {
    configuration ??= requete(ORIGINE_CATALOGUE+'/api/v1/connexion/configuration', { method:'GET' }).then(v => {
      if (v.ok !== true || v.urlSupabase !== SUPABASE || typeof v.clePublique !== 'string' || v.clePublique.startsWith('sb_secret_')) throw new ErreurConnexion('La connexion est indisponible dans cette version.');
      return secret(v.clePublique,2048);
    }).catch(e => { configuration = null; throw e; });
    return configuration;
  }
  async function jetons(type: 'password' | 'refresh_token', donnees: object): Promise<SessionAuth> {
    const k = await cle();
    const v = await requete(SUPABASE+'/auth/v1/token?grant_type='+type, { method:'POST', headers:{ apikey:k, 'Content-Type':'application/json' }, body:JSON.stringify(donnees) },true,type==='refresh_token');
    return sessionDe(v);
  }
  /** Lecture stricte d'une réponse qui ouvre une session (connexion, renouvellement, inscription sans confirmation d'e-mail). */
  function sessionDe(v: Record<string, unknown>): SessionAuth {
    const user = objet(v.user);
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || typeof v.expires_in !== 'number' || !Number.isSafeInteger(v.expires_in) || v.expires_in < 1 || v.expires_in > 86400) throw new ErreurConnexion('Réponse de connexion invalide.');
    return { accessToken:secret(v.access_token,16384), refreshToken:secret(v.refresh_token,1024), expiresAt:Math.floor(Date.now()/1000)+v.expires_in, userId:user.id };
  }
  /**
   * Appel PUBLIC du service d'authentification (inscription, mot de passe oublié) : clé publique seulement, aucun cookie, UN SEUL essai. Rend le statut et le corps lu (ou `null`) : le texte brut
   * du serveur n'est jamais affiché, `traduireErreurAuth` en fait un message français. Réseau coupé ou délai dépassé : message neutre.
   */
  async function authPublic(chemin: string, parametres: Record<string, string>, corps: object): Promise<{ ok: boolean; statut: number; texte: string; json: Record<string, unknown> | null }> {
    const k = await cle();
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), 15000);
    try {
      let r: Response;
      try { r = await fetcher(SUPABASE+'/auth/v1/'+chemin+'?'+new URLSearchParams(parametres).toString(), { method:'POST', credentials:'omit', signal:controle.signal, headers:{ apikey:k, 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify(corps) }); }
      catch { throw new ErreurConnexion('Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.'); }
      let texte = ''; let json: Record<string, unknown> | null = null;
      try { texte = await r.text(); if (texte.length > 262144) texte = ''; const v: unknown = JSON.parse(texte); json = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { json = null; }
      return { ok: r.ok, statut: r.status, texte, json };
    } finally { clearTimeout(timer); }
  }
  /** UN SEUL essai, jamais de relance automatique : un envoi incertain se rejoue à la main avec la même clé d'idempotence. */
  async function postCommande(accessToken: string, payload: CreationCommandePayload): Promise<{ reference: string; jeton: string; idempotent: boolean }> {
    // Refus AVANT tout appel réseau : `sur_place` n'est jamais envoyé ; la livraison exige adresse et quartier, le retrait n'en porte pas.
    const modeOk = payload.mode === 'retrait' ? !payload.destination && payload.fraisAffiches === undefined
      : payload.mode === 'livraison' && typeof payload.destination?.quartierId === 'string' && payload.destination.latitude === undefined && payload.destination.longitude === undefined
        && typeof payload.client.adresse === 'string' && payload.client.adresse.trim().length >= ADRESSE_MIN && payload.client.adresse.length <= ADRESSE_MAX;
    if (!modeOk) throw new ErreurCommande('validation', 'Cette application envoie des commandes en retrait, ou en livraison vers un quartier avec une adresse.');
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try {
      r = await fetcher(ORIGINE_CATALOGUE+'/api/v1/commandes', { method:'POST', credentials:'omit', signal:controle.signal, headers:{ Authorization:'Bearer '+accessToken, 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify(payload) });
    } catch { clearTimeout(timer); throw erreurReseau(); }
    try {
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      let corps: unknown = null;
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
      if (!r.ok) {
        const o = corps && typeof corps === 'object' ? corps as { erreur?: { code?: unknown; champs?: Record<string, unknown> } } : {};
        const code = typeof o.erreur?.code === 'string' ? o.erreur.code : null;
        const brut = o.erreur?.champs && typeof o.erreur.champs === 'object' ? o.erreur.champs.sousTotalServeur : undefined;
        const total = typeof brut === 'string' && /^\d{1,12}$/.test(brut) ? Number(brut) : null;
        const fraisBrut = o.erreur?.champs && typeof o.erreur.champs === 'object' ? o.erreur.champs.fraisServeur : undefined;
        const frais = typeof fraisBrut === 'string' && /^\d{1,12}$/.test(fraisBrut) ? Number(fraisBrut) : null;
        throw refusServeur(r.status, code, total, frais, payload.mode === 'livraison');
      }
      return lireReponseCreation(r.status, corps);
    } finally { clearTimeout(timer); }
  }
  /** Frais et durée de livraison calculés par le serveur (un seul essai, délai de `requete`, réponse bornée). Jeton porteur strict ; `non_calcule` = interrupteur éteint. */
  async function postEstimation(accessToken: string, restaurantId: string, quartierId: string, sousTotal: number): Promise<ResultatEstimation> {
    if (!Number.isSafeInteger(sousTotal) || sousTotal < 0) throw new ErreurConnexion('Le total doit être vérifié avant de calculer la livraison.');
    const v = await requete(ORIGINE_CATALOGUE+'/api/v1/livraison/estimation', { method:'POST', headers:{ Authorization:'Bearer '+accessToken, 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({ restaurantId, destination:{ quartierId }, sousTotal }) });
    try { return lireEstimation(v); } catch { throw new ErreurConnexion('Réponse du calcul de livraison illisible.'); }
  }
  /**
   * Déclaration du règlement (`POST /api/v1/suivi/paiement`) : UN SEUL essai, jamais de relance automatique. Le jeton de suivi est la clé : dans le corps seulement, jamais dans
   * l'adresse ni dans un message. Rejouable côté serveur, mais après une réponse inconnue l'appelant relit d'abord le suivi. Aucun montant n'est transmis.
   */
  async function postDeclaration(jeton: string, mode: string, reference: string | null): Promise<void> {
    if (!jeton || mode === 'especes' || !(MODES_REGLEMENT as readonly string[]).includes(mode)) throw new ErreurReglement('refus', 'Ce mode de règlement ne peut pas être déclaré depuis l’application.');
    if (reference !== null && !lireReferencePaiement(reference).ok) throw new ErreurReglement('refus', 'La référence contient 4 à 40 lettres, chiffres, points ou tirets.');
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try {
      r = await fetcher(ORIGINE_CATALOGUE+'/api/v1/suivi/paiement', { method:'POST', credentials:'omit', signal:controle.signal, headers:{ 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify(reference === null ? { jeton, mode } : { jeton, mode, reference }) });
    } catch { clearTimeout(timer); throw erreurReseauReglement(); }
    try {
      if (!r.ok) { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } throw refusDeclaration(r.status); }
      let corps: unknown = null;
      try {
        if (!(r.headers.get('content-type') ?? '').includes('application/json') || Number(r.headers.get('content-length')) > 262144) throw 0;
        const texte = await r.text(); if (texte.length > 262144) throw 0; corps = JSON.parse(texte);
      } catch { throw erreurReponseReglement(); }
      lireReponseDeclaration(corps);
    } finally { clearTimeout(timer); }
  }
  /**
   * Espace restaurateur (lot D1), routes de l'API unique : jeton porteur strict, aucun cookie, restaurant désigné par le serveur (jamais envoyé d'ici). UN SEUL essai par appel,
   * jamais de relance automatique. Le 401 termine la session (comme les autres lectures privées) ; un 403 « sécurité du compte » est rendu tel quel, sans texte du serveur.
   */
  async function appelRestaurateur(accessToken: string, chemin: string, options: { method: 'GET' | 'POST'; corps?: object; formulaire?: FormData; delaiMs?: number }, lecture: boolean, textes: TextesRestaurateur = TEXTES_COMMANDES): Promise<unknown> {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), options.delaiMs ?? delaiCommandeMs);
    let r: Response;
    try {
      // Formulaire (photo) : PAS de Content-Type écrit ici, le système y met la frontière du multipart.
      r = await fetcher(ORIGINE_CATALOGUE+chemin, { method:options.method, credentials:'omit', signal:controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', ...(options.corps && !options.formulaire ? { 'Content-Type':'application/json' } : {}) }, ...(options.formulaire ? { body:options.formulaire } : options.corps ? { body:JSON.stringify(options.corps) } : {}) });
    } catch (e) {
      const delaiAtteint = controle.signal.aborted; clearTimeout(timer);
      if (lecture) throw new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood. Vérifiez votre connexion.');
      if (!options.formulaire) throw textes.reseau();
      // Photo : le code dit d'où vient l'échec. `formulaire` = le fetch a refusé le formulaire AVANT d'envoyer un seul octet (échec local, rien d'enregistré) ; `delai` / `reseau` = incertain.
      const code = codeEchecPhoto(e, delaiAtteint);
      throw code === 'formulaire' ? erreurLocalePhoto(code) : erreurReseauPhoto(code);
    }
    try {
      let corps: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (!r.ok) {
        const raison = r.status === 403 ? lireRaisonSecurite(corps) : null;
        // Compte non membre qui LIT la liste : un message propre à la lecture (le texte « traiter cette commande » est celui des actions).
        if (lecture && r.status === 403 && raison === null) throw new ErreurRestaurateur('refus', textes.nonMembre);
        const refus = textes.refus(r.status, raison, corps);
        // Une lecture n'est jamais « incertaine » au sens d'une écriture : elle se rejoue à la main.
        if (lecture && refus.incertain) throw new ErreurRestaurateur(refus.genre, 'Le service est indisponible. Réessayez dans un instant.');
        throw refus;
      }
      if (corps === null) throw lecture ? new ErreurRestaurateur('reponse_invalide', textes.lectureIllisible) : textes.reponse();
      return corps;
    } finally { clearTimeout(timer); }
  }
  /**
   * Appels candidature (lot 4, B12), routes DU SITE comme l'ancienne appli : un seul essai, jamais de relance. 401 = session terminée ;
   * refus explicite du serveur (400, 409) = `refus` avec son message court ; réseau, délai, 5xx ou réponse illisible après un envoi = `incertain`.
   */
  async function appelCandidature(accessToken: string, chemin: string, options: { method: 'GET' | 'POST'; corps?: object; formulaire?: FormData; ecriture: boolean; defaut: string }): Promise<Record<string, unknown>> {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), options.formulaire ? DELAI_PHOTO_MS : delaiCommandeMs);
    let r: Response;
    try {
      r = await fetcher(SITE_WEB+chemin, { method: options.method, credentials:'omit', signal: controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', ...(options.corps ? { 'Content-Type':'application/json' } : {}) }, ...(options.formulaire ? { body: options.formulaire } : options.corps ? { body: JSON.stringify(options.corps) } : {}) });
    } catch { clearTimeout(timer); throw options.ecriture ? new ErreurCandidature('incertain', 'Impossible de joindre Speedfood. Votre envoi a peut-être été enregistré : relisez votre demande avant de réessayer.') : new ErreurCandidature('refus', 'Impossible de joindre Speedfood. Vérifiez votre connexion.'); }
    try {
      let corps: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (r.status === 400 || r.status === 409) throw new ErreurCandidature('refus', messageServeurLivreur(corps) ?? options.defaut);
      if (r.status === 429) throw new ErreurCandidature('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
      if (!r.ok) throw options.ecriture ? new ErreurCandidature('incertain', 'Le service est indisponible. Votre envoi a peut-être été enregistré : relisez votre demande avant de réessayer.') : new ErreurCandidature('refus', 'Le service est indisponible. Réessayez dans un instant.');
      if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) throw options.ecriture ? new ErreurCandidature('incertain', 'Réponse du service illisible. Relisez votre demande avant de réessayer.') : new ErreurCandidature('refus', 'Réponse du service illisible. Réessayez dans un instant.');
      return corps as Record<string, unknown>;
    } finally { clearTimeout(timer); }
  }
  /**
   * Lecture d'un module de l'espace équipe (lots 5 à 8), route DU SITE : un seul essai. Le serveur décide du droit (permission par module) :
   * 403 = refus rendu avec son message court, sans jamais contourner ; 401 = session terminée.
   */
  async function appelEquipeLecture(accessToken: string, chemin: string, defaut: string): Promise<Record<string, unknown>> {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try { r = await fetcher(SITE_WEB+chemin, { method:'GET', credentials:'omit', signal: controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } }); }
    catch { clearTimeout(timer); throw new ErreurEquipe('refus', 'Impossible de joindre Speedfood. Vérifiez votre connexion.'); }
    try {
      let corps: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (r.status === 403) throw new ErreurEquipe('refus', messageServeurLivreur(corps) ?? 'Votre compte n’a pas le droit d’ouvrir ce module. Vérifiez votre accès sur le site.');
      if (!r.ok) throw new ErreurEquipe('refus', 'Le service est indisponible. Réessayez dans un instant.');
      if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurEquipe('refus', defaut);
      return corps as Record<string, unknown>;
    } finally { clearTimeout(timer); }
  }
  /**
   * Écriture sensible de l'espace équipe (statut support, coordonnées, répartition) : un seul essai, jamais de relance (le serveur trace l'action).
   * Refus explicite (400, 403, 409) = `refus` avec le message court du serveur ; réseau, délai, 5xx ou réponse illisible = `incertain`.
   */
  async function appelEquipeEcriture(accessToken: string, chemin: string, corps: object, defaut: string): Promise<Record<string, unknown>> {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try { r = await fetcher(SITE_WEB+chemin, { method:'POST', credentials:'omit', signal: controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', 'Content-Type':'application/json' }, body: JSON.stringify(corps) }); }
    catch { clearTimeout(timer); throw new ErreurEquipe('incertain', 'Impossible de joindre Speedfood. L’action a peut-être été appliquée : actualisez avant de réessayer.'); }
    try {
      let lu: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) lu = JSON.parse(texte); } catch { lu = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (r.status === 400 || r.status === 403 || r.status === 409) throw new ErreurEquipe('refus', messageServeurLivreur(lu) ?? defaut);
      if (r.status === 429) throw new ErreurEquipe('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
      if (!r.ok) throw new ErreurEquipe('incertain', 'Le service est indisponible. L’action a peut-être été appliquée : actualisez avant de réessayer.');
      if (lu === null || typeof lu !== 'object' || Array.isArray(lu) || (lu as { ok?: unknown }).ok !== true) throw new ErreurEquipe('incertain', 'Réponse du service illisible. Actualisez avant de réessayer.');
      return lu as Record<string, unknown>;
    } finally { clearTimeout(timer); }
  }
  const uuidEquipe = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  /** Formulaire photo de candidature : les octets sont lus et vérifiés AVANT le réseau (échec local = rien n'est parti). */
  async function formulairePhotoCandidature(fichier: FichierPhotoPrete, type?: 'logo' | 'photo'): Promise<FormData> {
    let relu: FichierFormulaire;
    try {
      relu = await fichierDeFormulaire({ uri: fichier.uri, nom: fichier.nom, type: fichier.type });
      if (!octetsDePhotoValides(await relu.bytes())) throw new Error('octets');
    } catch { throw new ErreurCandidature('refus', 'La photo n’a pas pu être préparée pour l’envoi : rien n’a été enregistré. Choisissez-la à nouveau, ou une autre.'); }
    const formulaire = new FormData();
    if (type) formulaire.append('type', type);
    formulaire.append('fichier', relu as unknown as Blob);
    return formulaire;
  }
  /**
   * Écriture livreur (bascule, offre, course) : un seul essai. 401 = session terminée ; 400 = refus explicite (le message du serveur, s'il est lisible, est rendu par `refus`) ;
   * 429 = refus ; réseau, délai, autre statut ou réponse illisible = INCERTAIN (l'action a pu être appliquée : jamais de relance automatique).
   */
  async function ecritureLivreur(accessToken: string, chemin: string, corpsEnvoye: object, confirmer: (corps: unknown) => unknown, textes: { reseau: string; refus: (messageServeur: string | null) => string; indisponible: string; illisible: string }): Promise<void> {
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try {
      r = await fetcher(ORIGINE_CATALOGUE+chemin, { method:'POST', credentials:'omit', signal:controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', 'Content-Type':'application/json' }, body: JSON.stringify(corpsEnvoye) });
    } catch { clearTimeout(timer); throw new ErreurLivreur('incertain', textes.reseau); }
    try {
      let corps: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (r.status === 400) throw new ErreurLivreur('refus', textes.refus(messageServeurLivreur(corps)));
      if (r.status === 429) throw new ErreurLivreur('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
      if (!r.ok) throw new ErreurLivreur('incertain', textes.indisponible);
      try { confirmer(corps); } catch { throw new ErreurLivreur('incertain', textes.illisible); }
    } finally { clearTimeout(timer); }
  }
  /**
   * Écriture de l'espace client (profil, adresses, favoris) : UN SEUL essai, jamais rejouée toute seule (un favori se BASCULE, une adresse s'AJOUTE). 401 = session terminée ; 400 (message du serveur,
   * s'il est lisible) et 429 = `refus` (rien d'enregistré) ; réseau, délai, autre statut ou réponse illisible = `incertain` (l'appelant relit l'espace). Le porteur n'est que dans l'en-tête.
   */
  async function ecritureEspace(accessToken: string, chemin: string, corpsEnvoye: object, avecFavori = false): Promise<{ message: string; favori?: boolean }> {
    const incertain = () => new ErreurEspaceClient('incertain', 'Impossible de confirmer l’enregistrement. Actualisez pour voir l’état réel.');
    const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
    let r: Response;
    try { r = await fetcher(ORIGINE_CATALOGUE+'/api/v1/client/'+chemin, { method:'POST', credentials:'omit', signal:controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', 'Content-Type':'application/json' }, body:JSON.stringify(corpsEnvoye) }); }
    catch { clearTimeout(timer); throw incertain(); }
    try {
      let corps: unknown = null;
      const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
      if (json) { try { const t = await r.text(); if (t.length <= 262144) corps = JSON.parse(t); } catch { corps = null; } }
      else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
      if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
      if (r.status === 429) throw new ErreurEspaceClient('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
      if (r.status === 400) throw new ErreurEspaceClient('refus', messageServeurLivreur(corps) ?? 'La modification n’a pas été enregistrée. Réessayez dans un instant.');
      if (!r.ok || !corps || typeof corps !== 'object' || (corps as { ok?: unknown }).ok !== true) throw incertain();
      const o = corps as { message?: unknown; favori?: unknown };
      if (avecFavori && typeof o.favori !== 'boolean') throw incertain();
      const message = messageServeurLivreur({ erreur: { message: o.message } }) ?? 'Enregistré.';
      return avecFavori ? { message, favori: o.favori as boolean } : { message };
    } finally { clearTimeout(timer); }
  }
  return {
    /** Espace client complet (profil, adresses, favoris) : lecture seule, un seul essai. */
    async espaceComplet(accessToken: string): Promise<EspaceComplet> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/client/espace', { method:'GET', headers:{ Authorization:'Bearer '+accessToken } });
      try { return lireEspaceComplet(v); } catch { throw new ErreurConnexion('Votre espace est illisible. Réessayez dans un instant.'); }
    },
    /** Favori (B9) : bascule ajout/retrait. Le résultat dit l'état voulu par le serveur ; un résultat incertain se règle en relisant l'espace, jamais en rejouant. */
    async basculerFavori(accessToken: string, restaurantId: string): Promise<{ message: string; favori: boolean }> {
      if (!estUuid(restaurantId)) throw new ErreurEspaceClient('refus', 'Restaurant introuvable.');
      const r = await ecritureEspace(accessToken, 'favoris', { restaurantId }, true);
      return { message: r.message, favori: r.favori === true };
    },
    /** Profil (B11) : seuls les champs fournis changent. Règles vérifiées avant le réseau. */
    async enregistrerProfil(accessToken: string, champs: ChampsProfil): Promise<{ message: string }> {
      const probleme = verifierProfil(champs);
      if (probleme !== null) throw new ErreurEspaceClient('refus', probleme);
      const corps: Record<string, unknown> = {};
      if (champs.pseudo !== undefined) { const v = validerPseudo(champs.pseudo); if (v.ok) corps.pseudo = v.pseudo; }
      if (champs.avatar !== undefined) corps.avatar = champs.avatar;
      if (champs.modePrefere !== undefined) corps.modePrefere = champs.modePrefere;
      if (champs.notificationsCommande !== undefined) corps.notificationsCommande = champs.notificationsCommande;
      return ecritureEspace(accessToken, 'profil', corps);
    },
    /** Carnet d'adresses (B10) : ajouter, supprimer ou définir la principale. Règles vérifiées avant le réseau. */
    async actionAdresse(accessToken: string, a: ActionAdresse): Promise<{ message: string }> {
      if (a.action === 'ajouter') {
        const v = validerAdresse(a.libelle, a.adresse);
        if (!v.ok) throw new ErreurEspaceClient('refus', v.erreur);
        return ecritureEspace(accessToken, 'adresses', { action: 'ajouter', libelle: v.libelle, adresse: v.adresse });
      }
      if ((a.action !== 'supprimer' && a.action !== 'defaut') || !estUuid(a.adresseId)) throw new ErreurEspaceClient('refus', 'Adresse inconnue.');
      return ecritureEspace(accessToken, 'adresses', { action: a.action, adresseId: a.adresseId });
    },
    /**
     * Inscription (parité A2, route `signup` du service d'authentification, mêmes données que l'ancienne appli). Règles vérifiées AVANT le réseau. Rend la session si le service n'exige pas de confirmation
     * d'e-mail, sinon `null` (un e-mail de confirmation est parti). Une adresse déjà inscrite reçoit la même réponse qu'une nouvelle : on ne révèle pas qui a un compte. Un seul essai.
     */
    async inscrire(nom: string, telephone: string, email: string, motDePasse: string): Promise<SessionAuth | null> {
      const probleme = verifierInscription({ nom, telephone, email, motDePasse });
      if (probleme !== null) throw new ErreurConnexion(probleme);
      const r = await authPublic('signup', { redirect_to: SITE_WEB + '/auth/confirmation?suite=%2Fcompte' }, { email: email.trim(), password: motDePasse, data: { nom_commande: nom.trim(), telephone: normaliserTelephone(telephone) } });
      if (!r.ok) throw new ErreurConnexion(traduireErreurAuth(r.statut, r.texte));
      if (r.json === null || typeof r.json.access_token !== 'string') return null;
      try { return sessionDe(r.json); } catch { return null; }
    },
    /** Mot de passe oublié (parité A3, route `recover`) : même réponse que le compte existe ou non. Le lien reçu s'ouvre dans le navigateur, sur la page du site. Un seul essai. */
    async demanderReinitialisation(email: string): Promise<void> {
      const probleme = verifierEmail(email);
      if (probleme !== null) throw new ErreurConnexion(probleme);
      const r = await authPublic('recover', { redirect_to: SITE_WEB + '/auth/confirmation?suite=%2Fconnexion%2Fnouveau-mot-de-passe' }, { email: email.trim() });
      if (r.ok) return;
      // Trop de demandes ou panne : message précis ; sinon l'envoi a échoué, sans détail technique.
      if (r.statut === 429 || r.statut >= 500) throw new ErreurConnexion(traduireErreurAuth(r.statut, r.texte));
      throw new ErreurConnexion('L’e-mail n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.');
    },
    creerCommande: postCommande,
    declarerPaiement: postDeclaration,
    async ficheLivreur(accessToken: string): Promise<FicheLivreur | null> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/livreur/fiche', { method:'GET', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } });
      try { return lireFicheLivreur(v); } catch { throw new ErreurConnexion('La fiche reçue est illisible. Réessayez dans un instant.'); }
    },
    /** Accès du compte dans l'équipe (rôle, permissions, menu déjà filtrés par le serveur). */
    async accesEquipe(accessToken: string): Promise<AccesEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/moi', 'Votre accès équipe reçu est illisible. Réessayez dans un instant.');
      try { return lireAccesEquipe(v); } catch { throw new ErreurEquipe('refus', 'Votre accès équipe reçu est illisible. Réessayez dans un instant.'); }
    },
    /** Recherche de commandes pour le support (coordonnées déjà masquées par la base). */
    async commandesEquipe(accessToken: string, recherche: { statut?: string; reference?: string; jour?: boolean }): Promise<{ commandes: CommandeEquipe[]; illisibles: number }> {
      const q = new URLSearchParams();
      if (recherche.statut) q.set('statut', recherche.statut);
      if (recherche.reference) q.set('reference', recherche.reference.slice(0, 40));
      if (recherche.jour) q.set('jour', '1');
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/commandes?' + q.toString(), 'Les commandes reçues sont illisibles. Réessayez dans un instant.');
      try { return lireCommandesEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les commandes reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Détail d'une commande pour le support (historique, propositions, transitions permises). */
    async detailCommandeEquipe(accessToken: string, commandeId: string): Promise<ReponseDetailEquipe> {
      if (!uuidEquipe.test(commandeId)) throw new ErreurEquipe('refus', 'Commande introuvable. Actualisez la liste.');
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/commandes/' + commandeId, 'Le détail reçu est illisible. Réessayez dans un instant.');
      try { return lireDetailCommandeEquipe(v); } catch { throw new ErreurEquipe('refus', 'Le détail reçu est illisible. Réessayez dans un instant.'); }
    },
    /** Fait passer une commande à un statut cible (motif obligatoire, tracé par le serveur). Un seul essai. */
    async changerStatutEquipe(accessToken: string, commandeId: string, vers: StatutCommandeEquipe, motifBrut: string): Promise<void> {
      if (!uuidEquipe.test(commandeId) || !(STATUTS_COMMANDE_EQUIPE as readonly string[]).includes(vers)) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez le détail.');
      const motif = preparerMotifEquipe(motifBrut);
      if (motif === null) throw new ErreurEquipe('refus', 'Un motif est obligatoire (500 caractères au plus) pour une action de support.');
      await appelEquipeEcriture(accessToken, '/api/v1/equipe/commandes/' + commandeId + '/statut', { vers, motif }, 'Impossible d’appliquer ce changement de statut.');
    },
    /** Révèle les coordonnées d'un client (motif obligatoire, trace d'audit écrite par le serveur avant la réponse). Un seul essai. */
    async revelerCoordonneesEquipe(accessToken: string, commandeId: string, motifBrut: string): Promise<CoordonneesEquipe> {
      if (!uuidEquipe.test(commandeId)) throw new ErreurEquipe('refus', 'Commande introuvable. Actualisez la liste.');
      const motif = preparerMotifEquipe(motifBrut);
      if (motif === null) throw new ErreurEquipe('refus', 'Un motif est obligatoire (500 caractères au plus) pour révéler les coordonnées.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/commandes/' + commandeId + '/coordonnees', { motif }, 'Les coordonnées n’ont pas pu être révélées.');
      try { return lireCoordonneesEquipe(v); } catch { throw new ErreurEquipe('incertain', 'Réponse du service illisible. Par prudence, considérez la révélation comme non faite et actualisez.'); }
    },
    /** Commandes actives des établissements tenus par l'équipe (poste de répartition). */
    async commandesARepartir(accessToken: string): Promise<{ commandes: CommandeARepartir[]; illisibles: number }> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/repartition', 'Les commandes à répartir reçues sont illisibles. Réessayez dans un instant.');
      try { return lireCommandesARepartir(v); } catch { throw new ErreurEquipe('refus', 'Les commandes à répartir reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Fait avancer une commande au poste de répartition (action de la liste blanche, tracée par le serveur). Un seul essai. */
    async actionRepartitionEquipe(accessToken: string, commandeId: string, action: ActionRepartitionEquipe): Promise<StatutCommandeEquipe> {
      if (!uuidEquipe.test(commandeId) || !estActionRepartitionEquipe(action)) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez la liste.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/repartition/action', { commandeId, action }, 'Impossible d’appliquer cette action.');
      const s = v.statut;
      if (typeof s !== 'string' || !(STATUTS_COMMANDE_EQUIPE as readonly string[]).includes(s)) throw new ErreurEquipe('incertain', 'Réponse du service illisible. Actualisez la liste avant de réessayer.');
      return s as StatutCommandeEquipe;
    },
    /** Exploitation livreurs (lot 5, E1) : courses en cours et fiches des livreurs (jamais le dossier d'identité, le serveur ne le renvoie pas). */
    async exploitationEquipe(accessToken: string): Promise<ExploitationEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/livraisons', 'L’exploitation reçue est illisible. Réessayez dans un instant.');
      try { return lireExploitationEquipe(v); } catch { throw new ErreurEquipe('refus', 'L’exploitation reçue est illisible. Réessayez dans un instant.'); }
    },
    /** Action sur une livraison (corps préparé et vérifié avant le réseau ; le serveur trace). Un seul essai ; renvoie le message du serveur. */
    async actionLivraisonEquipe(accessToken: string, action: string, livraisonId: string, livreurId?: string): Promise<string> {
      const corps = preparerActionLivraisonEquipe(action, livraisonId, livreurId);
      if (corps === null) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez l’exploitation.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/livraisons/action', corps, 'Impossible d’appliquer cette action sur la livraison.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Livraison mise à jour.';
    },
    /** Action sur un livreur (motif seulement où le serveur l'exige ; le serveur trace). Un seul essai ; renvoie le message du serveur. */
    async actionLivreurEquipe(accessToken: string, action: string, livreurId: string, motif?: string): Promise<string> {
      const corps = preparerActionLivreurEquipe(action, livreurId, motif);
      if (corps === null) throw new ErreurEquipe('refus', 'Demande invalide : vérifiez l’action et le motif (5 caractères au moins quand il est exigé).');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/livreurs/action', corps, 'Impossible d’appliquer cette action sur le livreur.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Livreur mis à jour.';
    },
    /** Établissements vus par l'équipe (lot 6, E4) : état seulement, publication et suspension restent sur le site. */
    async restaurantsEquipe(accessToken: string): Promise<{ restaurants: RestaurantEquipe[]; illisibles: number }> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/restaurants', 'Les établissements reçus sont illisibles. Réessayez dans un instant.');
      try { return lireRestaurantsEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les établissements reçus sont illisibles. Réessayez dans un instant.'); }
    },
    /** Fiche d'un établissement pour l'équipe (identité, état, menu). */
    async ficheRestaurantEquipe(accessToken: string, restaurantId: string): Promise<FicheRestaurantEquipe> {
      if (!uuidEquipe.test(restaurantId)) throw new ErreurEquipe('refus', 'Établissement introuvable. Actualisez la liste.');
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/restaurants/' + restaurantId, 'La fiche reçue est illisible. Réessayez dans un instant.');
      try { return lireFicheRestaurantEquipe(v); } catch { throw new ErreurEquipe('refus', 'La fiche reçue est illisible. Réessayez dans un instant.'); }
    },
    /** Modification simple d'un établissement (horaires + numéro interne, validés avant le réseau comme le serveur). Un seul essai. */
    async modifierProfilEquipe(accessToken: string, restaurantId: string, horaires: string, telephoneBrut: string): Promise<string> {
      if (!uuidEquipe.test(restaurantId)) throw new ErreurEquipe('refus', 'Établissement introuvable. Actualisez la liste.');
      const validation = validerProfilSimpleEquipe(horaires, telephoneBrut);
      if (!validation.ok) throw new ErreurEquipe('refus', validation.message);
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/restaurants/' + restaurantId + '/profil', { horaires: validation.horaires, telephone: validation.telephone ?? '' }, 'Impossible d’enregistrer ce profil.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Profil enregistré.';
    },
    /** Fraîcheur des menus des établissements tenus par l'équipe (lot 6, E5). */
    async menusEquipe(accessToken: string): Promise<MenusEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/menus', 'Les menus reçus sont illisibles. Réessayez dans un instant.');
      try { return lireMenusEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les menus reçus sont illisibles. Réessayez dans un instant.'); }
    },
    /** Plats du menu d'un établissement tenu par l'équipe. */
    async platsMenuEquipe(accessToken: string, restaurantId: string): Promise<{ nom: string; plats: PlatMenuEquipe[] }> {
      if (!uuidEquipe.test(restaurantId)) throw new ErreurEquipe('refus', 'Établissement introuvable. Actualisez la liste.');
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/menus/' + restaurantId, 'Le menu reçu est illisible. Réessayez dans un instant.');
      try { return lirePlatsMenuEquipe(v); } catch { throw new ErreurEquipe('refus', 'Le menu reçu est illisible. Réessayez dans un instant.'); }
    },
    /** Reconfirme un plat disponible, ou tout le menu si aucun plat n'est donné. Un seul essai. */
    async reconfirmerMenuEquipe(accessToken: string, restaurantId: string, platId?: string): Promise<string> {
      if (!uuidEquipe.test(restaurantId) || (platId !== undefined && !uuidEquipe.test(platId))) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez le menu.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/menus/confirmer', platId ? { restaurantId, platId } : { restaurantId }, 'Impossible de reconfirmer pour le moment.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Menu reconfirmé.';
    },
    /** Marque un plat épuisé ou le remet en vente. Un seul essai. */
    async disponibiliteMenuEquipe(accessToken: string, restaurantId: string, platId: string, disponible: boolean): Promise<string> {
      if (!uuidEquipe.test(restaurantId) || !uuidEquipe.test(platId) || typeof disponible !== 'boolean') throw new ErreurEquipe('refus', 'Demande invalide. Actualisez le menu.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/menus/disponibilite', { restaurantId, platId, disponible }, 'Impossible d’enregistrer pour le moment.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Plat mis à jour.';
    },
    /** Demandes de référencement (le téléphone du responsable est envoyé pour le rappeler ; jamais l'e-mail). */
    async referencementsEquipe(accessToken: string): Promise<{ demandes: DemandeReferencement[]; illisibles: number }> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/referencements', 'Les demandes reçues sont illisibles. Réessayez dans un instant.');
      try { return lireReferencementsEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les demandes reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Catégories et quartiers officiels pour créer l'établissement d'une demande. */
    async optionsReferencement(accessToken: string): Promise<{ categories: Array<{ id: string; nom: string }>; quartiers: Array<{ id: string; nom: string }> }> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/referencements/options', 'Les listes reçues sont illisibles. Réessayez dans un instant.');
      try { return lireOptionsReferencement(v); } catch { throw new ErreurEquipe('refus', 'Les listes reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Change le statut d'une demande de référencement (jamais « creee » à la main). Un seul essai. */
    async statutReferencement(accessToken: string, demandeId: string, statut: string, motif?: string): Promise<string> {
      if (!uuidEquipe.test(demandeId) || !(STATUTS_REFERENCEMENT_EQUIPE as readonly string[]).includes(statut) || statut === 'creee') throw new ErreurEquipe('refus', 'Demande invalide. Actualisez la liste.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/referencements/statut', { id: demandeId, statut, ...(motif ? { motif } : {}) }, 'Le statut n’a pas pu être changé.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Statut enregistré.';
    },
    /** Crée l'établissement (non publié) d'une demande, catégorie et quartier des listes officielles. Un seul essai. */
    async creerEtablissementReferencement(accessToken: string, demandeId: string, categorieId: string, quartierId: string): Promise<string> {
      if (!uuidEquipe.test(demandeId) || !uuidEquipe.test(categorieId) || !uuidEquipe.test(quartierId)) throw new ErreurEquipe('refus', 'Choisissez une catégorie et un quartier des listes proposées.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/referencements/creer-etablissement', { id: demandeId, categorieId, quartierId }, 'L’établissement n’a pas pu être créé.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Établissement créé (non publié).';
    },
    /** Rattache le compte du candidat à son établissement créé, comme propriétaire (décision humaine). Un seul essai. */
    async rattacherReferencement(accessToken: string, demandeId: string): Promise<string> {
      if (!uuidEquipe.test(demandeId)) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez la liste.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/referencements/rattacher', { id: demandeId }, 'Le compte n’a pas pu être rattaché.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Compte rattaché à l’établissement.';
    },
    /** Demandes de partenariat reçues par la page « Devenir partenaire ». */
    async partenariatsEquipe(accessToken: string): Promise<{ partenariats: DemandePartenariat[]; illisibles: number }> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/partenariats', 'Les demandes reçues sont illisibles. Réessayez dans un instant.');
      try { return lirePartenariatsEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les demandes reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Change le statut d'une demande de partenariat (suppression laissée au site, irréversible). Un seul essai. */
    async statutPartenariat(accessToken: string, demandeId: string, statut: string): Promise<string> {
      if (!uuidEquipe.test(demandeId) || !(STATUTS_PARTENARIAT_EQUIPE as readonly string[]).includes(statut)) throw new ErreurEquipe('refus', 'Demande invalide. Actualisez la liste.');
      const v = await appelEquipeEcriture(accessToken, '/api/v1/equipe/partenariats/statut', { id: demandeId, statut }, 'Le statut n’a pas pu être changé.');
      return typeof v.message === 'string' && v.message.length > 0 && v.message.length <= 300 ? v.message : 'Statut enregistré.';
    },
    /** Tableau de bord de l'équipe (lot 5, E1/E15) : seuls les blocs permis au rôle sont renvoyés ; un bloc absent n'est jamais inventé. */
    async tableauEquipe(accessToken: string): Promise<TableauEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/tableau', 'Le tableau de bord reçu est illisible. Réessayez dans un instant.');
      try { return lireTableauEquipe(v); } catch { throw new ErreurEquipe('refus', 'Le tableau de bord reçu est illisible. Réessayez dans un instant.'); }
    },
    /** Paiements en ligne vus par l'équipe (lot 5, E3) : lecture seule, aucun numéro de versement retenu. */
    async paiementsEquipe(accessToken: string): Promise<PaiementsEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/paiements', 'Les paiements reçus sont illisibles. Réessayez dans un instant.');
      try { return lirePaiementsEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les paiements reçus sont illisibles. Réessayez dans un instant.'); }
    },
    /** Finances de l'équipe (lot 5, E2) : relevé L3 en lecture seule, période par défaut de l'ancienne appli. */
    async financesEquipe(accessToken: string, debut: string = DEBUT_PERIODE_FINANCES, fin: string = FIN_PERIODE_FINANCES): Promise<FinancesEquipe> {
      const v = await appelEquipeLecture(accessToken, '/api/v1/equipe/finances?debut=' + encodeURIComponent(debut) + '&fin=' + encodeURIComponent(fin), 'Les finances reçues sont illisibles. Réessayez dans un instant.');
      try { return lireFinancesEquipe(v); } catch { throw new ErreurEquipe('refus', 'Les finances reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** La demande de candidature du compte (lot 4, B12), ou `null` s'il n'en a pas. Route du site, un seul essai. */
    async lireCandidature(accessToken: string): Promise<VueCandidature | null> {
      const v = await appelCandidature(accessToken, '/api/v1/candidature', { method:'GET', ecriture:false, defaut:'Votre demande n’a pas pu être chargée.' });
      try { return lireVueCandidature(v); } catch { throw new ErreurCandidature('refus', 'Votre demande reçue est illisible. Réessayez dans un instant.'); }
    },
    /** Dépose la candidature remplie (corps produit par le domaine, revérifié avant le réseau par l'écran ; le serveur revérifie tout). Un seul essai. */
    async deposerCandidature(accessToken: string, brouillon: BrouillonCandidature): Promise<VueCandidature> {
      const v = await appelCandidature(accessToken, '/api/v1/candidature', { method:'POST', corps: produireCorpsCandidature(brouillon), ecriture:true, defaut:'Votre demande n’a pas pu être envoyée.' });
      try { const vue = lireVueCandidature(v); if (vue === null) throw new Error('vide'); return vue; } catch { throw new ErreurCandidature('incertain', 'Réponse du service illisible. Relisez votre demande avant de réessayer.'); }
    },
    /** Envoie le logo ou la photo de la candidature déposée (multipart, un seul essai) ; renvoie la demande relue par le serveur. */
    async envoyerImageCandidature(accessToken: string, type: 'logo' | 'photo', fichier: FichierPhotoPrete): Promise<VueCandidature> {
      const formulaire = await formulairePhotoCandidature(fichier, type);
      const v = await appelCandidature(accessToken, '/api/v1/candidature/image', { method:'POST', formulaire, ecriture:true, defaut:'L’image n’a pas pu être envoyée.' });
      try { const vue = lireVueCandidature(v); if (vue === null) throw new Error('vide'); return vue; } catch { throw new ErreurCandidature('incertain', 'Réponse du service illisible. Relisez votre demande avant de réessayer.'); }
    },
    /** Fait lire une photo de menu par le serveur (rien n'est conservé) : la liste revient pour relecture avant ajout au brouillon. */
    async lireMenuPhotoCandidature(accessToken: string, fichier: FichierPhotoPrete): Promise<LectureMenu> {
      const formulaire = await formulairePhotoCandidature(fichier);
      const v = await appelCandidature(accessToken, '/api/v1/candidature/menu-photo', { method:'POST', formulaire, ecriture:false, defaut:'La photo n’a pas pu être lue. Saisissez les plats à la main.' });
      try { return lireLectureMenu(v); } catch { throw new ErreurCandidature('refus', 'La lecture reçue est illisible. Saisissez les plats à la main.'); }
    },
    /**
     * File des courses du livreur (lot 3, D5) : route DU SITE comme l'ancienne appli (`GET /api/v1/livreur/file`, créée pour la parité).
     * Lecture seule, un seul essai, strictement relue ; `null` = ce compte n'est pas livreur.
     */
    async fileLivreur(accessToken: string): Promise<FileLivreur | null> {
      const v = await requete(SITE_WEB+'/api/v1/livreur/file', { method:'GET', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } });
      try { return lireFileLivreur(v); } catch { throw new ErreurConnexion('Votre file de courses reçue est illisible. Réessayez dans un instant.'); }
    },
    /**
     * Gains du livreur (lot 3, D7) : route DU SITE comme l'ancienne appli (`GET /api/v1/livreur/gains`, l'API unique ne l'héberge pas encore).
     * Lecture seule, un seul essai ; `null` = ce compte n'est pas livreur. Le montant lu est un frais de course, jamais une paie.
     */
    async gainsLivreur(accessToken: string): Promise<GainsLivreur | null> {
      const v = await requete(SITE_WEB+'/api/v1/livreur/gains', { method:'GET', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } });
      try { return lireGainsLivreur(v); } catch { throw new ErreurConnexion('Vos courses reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /**
     * Historique paginé des courses livrées (lot 3, D6) : route DU SITE comme l'ancienne appli (`POST /api/v1/livreur/historique`, corps `{page}`).
     * La page est vérifiée AVANT le réseau ; un seul essai ; `null` = ce compte n'est pas livreur.
     */
    async historiqueLivreur(accessToken: string, page: number): Promise<PageCoursesLivreur | null> {
      const demandee = preparerPageCourses(page);
      if (demandee === null) throw new ErreurLivreur('refus', 'Cette page d’historique n’est pas valide. Actualisez vos courses.');
      const v = await requete(SITE_WEB+'/api/v1/livreur/historique', { method:'POST', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', 'Content-Type':'application/json' }, body: JSON.stringify({ page: demandee }) });
      try { return lirePageCoursesLivreur(v); } catch { throw new ErreurConnexion('Votre historique reçu est illisible. Réessayez dans un instant.'); }
    },
    /** État G2 (fiche + offre) : lecture pure, un seul essai, aucun identifiant de compte dans l'URL ni le corps. */
    async etatLivreur(accessToken: string): Promise<EtatLivreur | null> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/livreur/etat', { method:'GET', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } });
      try { return lireEtatLivreur(v); } catch { throw new ErreurConnexion('L’état reçu est illisible. Réessayez dans un instant.'); }
    },
    /**
     * Bascule de disponibilité G2 : un seul essai, jamais de relance ; le corps ne porte que le booléen demandé.
     * Un refus explicite du serveur (400) est distingué d'un résultat incertain (réseau, délai, 5xx, réponse illisible),
     * pour que l'écran verrouille le bouton seulement quand l'écriture a pu être appliquée.
     */
    async basculerEnLigneLivreur(accessToken: string, enLigne: boolean): Promise<void> {
      await ecritureLivreur(accessToken, '/api/v1/livreur/en-ligne', { enLigne }, lireEnLigneLivreur, {
        reseau: 'Impossible de joindre Speedfood. Vérifiez votre connexion.',
        refus: () => 'Changement refusé : votre état a peut-être changé. Actualisez votre état.',
        indisponible: 'Le service est indisponible. Votre disponibilité a peut-être changé : actualisez pour vérifier.',
        illisible: 'La réponse de disponibilité est illisible. Actualisez votre état pour vérifier.',
      });
    },
    /**
     * Réponse à l'offre affichée (G3) : `POST /api/v1/livreur/offre`, UN SEUL essai, jamais de relance. Identifiant (UUID) et réponse vérifiés ICI avant le réseau ;
     * le corps ne porte que l'offre et la réponse (le compte vient du jeton). Refus explicite (400) = rien d'appliqué ; tout le reste = incertain.
     */
    async repondreOffreLivreur(accessToken: string, offreId: string, reponse: 'acceptee' | 'refusee'): Promise<void> {
      if (typeof offreId !== 'string' || !REGEX_UUID_LIVREUR.test(offreId) || (reponse !== 'acceptee' && reponse !== 'refusee')) throw new ErreurLivreur('refus', 'Cette offre n’est plus lisible. Actualisez votre état.');
      await ecritureLivreur(accessToken, '/api/v1/livreur/offre', { offreId, reponse }, lireReponseActionLivreur, {
        reseau: 'Impossible de joindre Speedfood. Votre réponse a peut-être été enregistrée : actualisez votre état pour vérifier.',
        refus: message => message ?? 'Réponse refusée : l’offre a peut-être changé. Actualisez votre état.',
        indisponible: 'Le service est indisponible. Votre réponse a peut-être été enregistrée : actualisez votre état pour vérifier.',
        illisible: 'La réponse du service est illisible. Votre réponse a peut-être été enregistrée : actualisez votre état pour vérifier.',
      });
    },
    /**
     * Avancement de la course affichée (G3) : `POST /api/v1/livreur/course`, UN SEUL essai, jamais de relance, même après une réponse incertaine. Le corps est produit par le contrat
     * partagé avec le serveur AVANT le réseau (livraison UUID, étape connue, code de EXACTEMENT 4 chiffres seulement avec « livree », raison seulement avec « echec ») : une demande invalide
     * ne part jamais et ne verrouille rien. Le code n'est ni journalisé, ni conservé, ni repris dans un message d'erreur.
     */
    async avancerCourseLivreur(accessToken: string, demande: DemandeCourseLivreur): Promise<void> {
      const corps = lireCorpsCourseLivreur(demande);
      if (corps === null) throw new ErreurLivreur('refus', 'Cette étape ne peut pas être envoyée telle quelle. Vérifiez la saisie ou actualisez votre état.');
      const code = corps.code;
      await ecritureLivreur(accessToken, '/api/v1/livreur/course', corps, lireReponseActionLivreur, {
        reseau: 'Impossible de joindre Speedfood. Votre action a peut-être été enregistrée : actualisez votre état pour vérifier avant de recommencer.',
        refus: message => (message !== null && code !== undefined && message.includes(code) ? 'Code de remise incorrect.' : message ?? 'Action refusée : votre course a peut-être changé. Actualisez votre état.'),
        indisponible: 'Le service est indisponible. Votre action a peut-être été enregistrée : actualisez votre état pour vérifier avant de recommencer.',
        illisible: 'La réponse du service est illisible. Votre action a peut-être été enregistrée : actualisez votre état pour vérifier avant de recommencer.',
      });
    },
    /** Quels espaces ce compte peut-il ouvrir ? (affichage seulement). */
    async moi(accessToken: string): Promise<RolesCompte> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/moi', { method:'GET', headers:{ Authorization:'Bearer '+accessToken } });
      try { return lireRoles(v); } catch { throw new ErreurConnexion('Impossible de lire les espaces de ce compte.'); }
    },
    async commandesRestaurant(accessToken: string): Promise<ListeRestaurateur> {
      const corps = await appelRestaurateur(accessToken, '/api/v1/restaurant/commandes', { method:'GET' }, true);
      try { return lireListeRestaurateur(corps as Record<string, unknown>); } catch { throw new ErreurRestaurateur('reponse_invalide', 'Les commandes reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /**
     * Historique des commandes finies, page par page (route `/restaurant/historique`, lot 2 / C8). La page demandée est vérifiée AVANT le réseau et portée par le corps :
     * le serveur répond toujours par la page exactement demandée. Lecture seule, UN SEUL essai. Le restaurant n'est jamais envoyé (le serveur le tire du compte) et
     * la réponse est relue strictement : aucune coordonnée client n'est retenue.
     */
    async historiqueRestaurant(accessToken: string, page: number, taille: number): Promise<PageHistorique> {
      const demande = preparerPageHistorique(page, taille);
      if (demande === null) throw new ErreurRestaurateur('refus', 'Cette page d’historique n’est pas valide. Actualisez l’historique.');
      const corps = await appelRestaurateur(accessToken, '/api/v1/restaurant/historique', { method:'POST', corps: demande }, true);
      try { return lirePageHistorique(corps as Record<string, unknown>); } catch { throw new ErreurRestaurateur('reponse_invalide', 'L’historique reçu est illisible. Réessayez dans un instant.'); }
    },
    /**
     * Établit le reçu numéroté ou la facture d'UNE commande (route `/commandes/document`, lot 2 / C5). Type de la liste blanche et identifiant vérifiés AVANT le
     * réseau ; UN SEUL essai (émettre attribue un numéro : jamais de relance automatique, la liste relue montre le document établi). Le corps ne porte que la commande et le type.
     */
    async emettreDocumentRestaurateur(accessToken: string, commandeId: string, type: TypeDocument): Promise<void> {
      if (type !== 'recu' && type !== 'facture') throw new ErreurRestaurateur('refus', 'Ce document n’est pas disponible dans l’application.');
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(commandeId)) throw new ErreurRestaurateur('refus', 'Commande introuvable. Actualisez la liste.');
      lireReponseAction(await appelRestaurateur(accessToken, '/api/v1/restaurant/commandes/document', { method:'POST', corps:{ commandeId, type } }, false));
    },
    /** Activité du restaurant (route `/restaurant/activite`, lot 2 / C10) : bilans du jour et des 7 jours, répartition, dernières terminées. Lecture seule, UN SEUL essai, relue strictement. */
    async activiteRestaurant(accessToken: string): Promise<ActiviteRestaurateur> {
      const corps = await appelRestaurateur(accessToken, '/api/v1/restaurant/activite', { method:'GET' }, true);
      try { return lireActiviteRestaurateur(corps as Record<string, unknown>); } catch { throw new ErreurRestaurateur('reponse_invalide', 'L’activité reçue est illisible. Réessayez dans un instant.'); }
    },
    /**
     * Accepter, refuser, marquer prête ou terminée (route `/commandes/action`) ; confirmer ou contester un paiement déclaré (route `/commandes/paiement`). Liste blanche vérifiée AVANT tout
     * appel réseau (jamais la livraison ni une valeur inconnue ; la proposition de prix a sa propre fonction, avec ses montants). UN SEUL essai. Le corps ne porte que l'identifiant de la commande et l'action ou la décision.
     */
    async actionRestaurateur(accessToken: string, commandeId: string, action: ActionRestaurateur): Promise<void> {
      if (!(ACTIONS_RESTAURATEUR as readonly string[]).includes(action) || (action !== 'paiement_recu' && action !== 'paiement_non_recu' && !(ACTIONS_DE_STATUT as readonly string[]).includes(action))) throw new ErreurRestaurateur('refus', 'Cette action n’est pas disponible dans l’application.');
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(commandeId)) throw new ErreurRestaurateur('refus', 'Commande introuvable. Actualisez la liste.');
      const decision = decisionPaiementDe(action);
      if (decision !== null) lireReponseAction(await appelRestaurateur(accessToken, '/api/v1/restaurant/commandes/paiement', { method:'POST', corps:{ commandeId, decision } }, false));
      else lireReponseAction(await appelRestaurateur(accessToken, '/api/v1/restaurant/commandes/action', { method:'POST', corps:{ commandeId, action } }, false));
    },
    /**
     * Propose un autre prix au client (route `/commandes/proposition`). Les montants (entiers en GNF, de 0 à 10 000 000) et les conditions (500 caractères au plus) sont revérifiés ICI,
     * avant tout appel réseau : une saisie invalide ne part jamais. UN SEUL essai. Le corps ne porte que la commande, les montants et les conditions (jamais le restaurant).
     */
    async proposerRestaurateur(accessToken: string, commandeId: string, valeurs: ValeursPropositionRestaurateur): Promise<void> {
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(commandeId)) throw new ErreurRestaurateur('refus', 'Commande introuvable. Actualisez la liste.');
      const lu = lireValeursPropositionApp(valeurs ?? {});
      if (!lu.ok) throw new ErreurRestaurateur('refus', 'Les montants de la proposition ne sont pas valides. Corrigez-les puis recommencez.');
      lireReponseAction(await appelRestaurateur(accessToken, '/api/v1/restaurant/commandes/proposition', { method:'POST', corps:{ commandeId, nouveauSousTotal:lu.valeurs.nouveauSousTotal, nouveauxFraisLivraison:lu.valeurs.nouveauxFraisLivraison, conditionsModifiees:lu.valeurs.conditionsModifiees } }, false));
    },
    /**
     * Livraison par le restaurant (route `/livraison/action`, lot D5) : « partir », « livree » (avec le code à 4 chiffres du client) ou « annuler ». Tout est vérifié ICI avant le réseau, avec le contrat
     * partagé avec le serveur : action de la liste blanche, identifiant de livraison, code de EXACTEMENT 4 chiffres (sinon échec LOCAL : rien ne part). UN SEUL essai. Le corps ne porte que la livraison, l'action
     * et, pour « livree » seulement, le code (jamais le restaurant). Le code n'est ni conservé ni repris dans une erreur.
     */
    async actionLivraisonRestaurateur(accessToken: string, livraisonId: string, action: ActionLivraisonApp, code?: string): Promise<void> {
      if (lireActionLivraisonApp(action) === null) throw erreurLocaleLivraison('Cette action n’est pas disponible dans l’application.');
      const demande = lireDemandeLivraisonApp({ livraisonId, action, code });
      if (!demande.ok) throw erreurLocaleLivraison(demande.message === MESSAGE_CODE_LIVRAISON ? MESSAGE_CODE_LIVRAISON : 'Livraison introuvable. Actualisez la liste.');
      const corps = demande.action === 'livree' ? { livraisonId: demande.livraisonId, action: demande.action, code: demande.code } : { livraisonId: demande.livraisonId, action: demande.action };
      lireReponseAction(await appelRestaurateur(accessToken, CHEMIN_LIVRAISON_APP, { method:'POST', corps }, false, TEXTES_LIVRAISON));
    },
    /** Réglages du service (GET) : horaires, ouvert, accepte commandes, délai de préparation, plats à reconfirmer (liste du serveur). Lecture seule, un seul essai. */
    async reglagesRestaurateur(accessToken: string): Promise<ReglagesRestaurateur> {
      const corps = await appelRestaurateur(accessToken, '/api/v1/restaurant/reglages', { method:'GET' }, true, TEXTES_SERVICE);
      try { return lireReglagesRestaurateur(corps as Record<string, unknown>); } catch { throw new ErreurRestaurateur('reponse_invalide', 'Les informations reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /** Menu du restaurant (GET) : plats non archivés avec leur disponibilité. Lecture seule, un seul essai. */
    async menuRestaurateur(accessToken: string): Promise<MenuRestaurateur> {
      const corps = await appelRestaurateur(accessToken, '/api/v1/restaurant/menu', { method:'GET' }, true, TEXTES_SERVICE);
      try { return lireMenuRestaurateur(corps as Record<string, unknown>); } catch { throw new ErreurRestaurateur('reponse_invalide', 'Les informations reçues sont illisibles. Réessayez dans un instant.'); }
    },
    /**
     * Écrit UNE action du service ou du menu (lot D4a) : interrupteur (route statut), horaires et délai (route réglages), disponibilité d'un plat, confirmation d'un plat ou de tous (route menu/action).
     * Le corps est produit par `corpsDeAction` (validation partagée avec le serveur) AVANT tout appel réseau : une saisie invalide ne part jamais. Le corps ne porte JAMAIS le restaurant. UN SEUL essai.
     */
    async ecrireService(accessToken: string, action: ActionService): Promise<void> {
      const envoi = corpsDeAction(action);
      if (envoi === null) throw new ErreurRestaurateur('refus', 'Cette demande n’est pas valide. Corrigez-la puis recommencez.');
      if (envoi.chemin === CHEMIN_PHOTO_APP) {
        // Lot D4c : formulaire multipart (plat + photo, ou plat + retirer=1). Le restaurant n'est jamais un champ. Le fichier a déjà passé le contrat partagé (JPEG, 5 Mo au plus) dans `corpsDeAction`.
        const formulaire = new FormData();
        for (const [cle, valeur] of Object.entries(envoi.corps)) formulaire.append(cle, String(valeur));
        if (envoi.fichier) {
          // ÉCHEC LOCAL (rien n'est parti, rien n'est enregistré, l'écran reste déverrouillé) : lecture du fichier, octets invalides, forme du formulaire. Les octets sont lus AVANT le réseau.
          let fichier: FichierFormulaire;
          try {
            fichier = await fichierDeFormulaire({ uri: envoi.fichier.uri, nom: envoi.fichier.nom, type: envoi.fichier.type });
            if (!octetsDePhotoValides(await fichier.bytes())) throw new Error('octets');
          } catch { throw erreurLocalePhoto('lecture'); }
          formulaire.append('photo', fichier as unknown as Blob);
          if (!formulaireEnvoyable(formulaire)) throw erreurLocalePhoto('formulaire');
        }
        lireReponseAction(await appelRestaurateur(accessToken, envoi.chemin, { method:'POST', formulaire, delaiMs: envoi.fichier ? DELAI_PHOTO_MS : undefined }, false, TEXTES_SERVICE));
        return;
      }
      lireReponseAction(await appelRestaurateur(accessToken, envoi.chemin, { method:'POST', corps:envoi.corps }, false, TEXTES_SERVICE));
    },
    estimerLivraison: postEstimation,
    async connecter(email: string, motDePasse: string) {
      if (!email.trim() || email.length > 254 || !motDePasse.length || motDePasse.length > 4096) throw new ErreurConnexion('Renseignez votre adresse e-mail et votre mot de passe.');
      return jetons('password',{ email:email.trim(), password:motDePasse });
    },
    renouveler: (refreshToken: string) => jetons('refresh_token',{ refresh_token:refreshToken }),
    async commandes(accessToken:string) {
      const v=await requete(ORIGINE_CATALOGUE+'/api/v1/commandes',{method:'GET',headers:{Authorization:'Bearer '+accessToken}});
      try{return lireCommandes(v);}catch{throw new ErreurConnexion('Impossible de lire vos commandes.');}
    },
    async suivi(jeton:string) {
      const v=await requete(ORIGINE_CATALOGUE+'/api/v1/suivi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jeton})});
      try{return lireSuivi(v);}catch{throw new ErreurConnexion('Impossible de lire le suivi de cette commande.');}
    },
    async annuler(jeton:string):Promise<{reference:string}> {
      const v=await requete(ORIGINE_CATALOGUE+'/api/v1/suivi/annuler',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jeton})},false,false,{
        409:'Le restaurant a déjà répondu à votre commande : elle ne peut plus être annulée ici. Appelez l’assistance Speedfood.',404:'Commande introuvable.',400:'Lien de suivi invalide. Actualisez vos commandes.'});
      if(v.ok!==true||typeof v.reference!=='string'||!v.reference.length||v.reference.length>40)throw new ErreurConnexion('Réponse d’annulation invalide.');
      return {reference:v.reference};
    },
    /** Réponse du client à la proposition révisée du restaurant (route du site `suivi/proposition`). UN SEUL essai ; le jeton ne va que dans le corps ; seul `ok:true` vaut succès. */
    async repondreProposition(jeton:string,propositionId:string,accepter:boolean):Promise<void> {
      if(typeof propositionId!=='string'||!propositionId.length||propositionId.length>64)throw new ErreurConnexion('Proposition invalide. Actualisez le suivi.');
      const v=await requete(ORIGINE_CATALOGUE+'/api/v1/suivi/proposition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jeton,propositionId,reponse:accepter?'acceptee':'refusee'})},false,false,{
        409:'Cette proposition n’est plus valable (expirée ou déjà traitée). Actualisez le suivi.',404:'Proposition introuvable. Actualisez le suivi.',400:'Réponse invalide : lien de suivi ou proposition invalide. Actualisez vos commandes.'});
      if(v.ok!==true)throw new ErreurConnexion('Réponse invalide du serveur.');
    },
    /**
     * Suppression du compte connecté (route `client/compte`, droit à l'effacement) : IRRÉVERSIBLE, UN SEUL essai, jamais de relance. Le mot SUPPRIMER est vérifié ICI avant le réseau (sinon rien ne part).
     * `refus` (400 : compte professionnel, mot refusé, panne côté serveur ; 429) = rien n'a été supprimé ; 401 = session terminée ; réseau, délai, autre statut ou réponse illisible = `incertain`
     * (la suppression a pu être faite : jamais présentée comme un succès). Le porteur n'est que dans l'en-tête, jamais dans l'adresse ni dans un message.
     */
    async supprimerCompte(accessToken:string,confirmation:string):Promise<void> {
      if(!confirmationSuppressionValide(confirmation))throw new ErreurSuppressionCompte('refus','Écrivez SUPPRIMER pour confirmer la suppression.');
      const incertain=()=>new ErreurSuppressionCompte('incertain','Impossible de confirmer la suppression. Actualisez votre espace : si votre session a pris fin, votre compte est bien supprimé.');
      const controle=new AbortController();const timer=setTimeout(()=>controle.abort(),delaiCommandeMs);
      let r:Response;
      try{r=await fetcher(ORIGINE_CATALOGUE+'/api/v1/client/compte',{method:'POST',credentials:'omit',signal:controle.signal,headers:{Authorization:'Bearer '+accessToken,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({confirmation:MOT_CONFIRMATION})});}
      catch{clearTimeout(timer);throw incertain();}
      try{
        let corps:unknown=null;
        const json=(r.headers.get('content-type')??'').includes('application/json')&&!(Number(r.headers.get('content-length'))>262144);
        if(json){try{const texte=await r.text();if(texte.length<=262144)corps=JSON.parse(texte);}catch{corps=null;}}
        else{try{await r.body?.cancel();}catch{/* corps déjà fermé */}}
        if(r.status===401)throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.',true);
        if(r.status===429)throw new ErreurSuppressionCompte('refus','Trop de tentatives. Patientez un instant avant de réessayer.');
        if(r.status===400)throw new ErreurSuppressionCompte('refus',messageServeurLivreur(corps)??'Le compte n’a pas été supprimé. Écrivez-nous depuis le centre d’aide si le problème persiste.');
        if(!r.ok)throw incertain();
        if(!corps||typeof corps!=='object'||(corps as {ok?:unknown}).ok!==true)throw incertain();
      }finally{clearTimeout(timer);}
    },
    async espace(accessToken: string): Promise<ResumeCompte> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/client/espace', { method:'GET', headers:{ Authorization:'Bearer '+accessToken } });
      if (v.ok !== true || !Array.isArray(v.favoris) || !Array.isArray(v.adresses) || v.favoris.length > 100 || v.adresses.length > 5) throw new ErreurConnexion('Impossible de lire votre espace client.');
      const p = v.profil === null ? null : objet(v.profil);
      if (p && (typeof p.pseudo !== 'string' || p.pseudo.length > 100)) throw new ErreurConnexion('Impossible de lire votre profil.');
      return { pseudo:p ? p.pseudo as string : null, favoris:v.favoris.length, adresses:v.adresses.length };
    },
    async deconnecter(accessToken: string) {
      const k = await cle();
      await requete(SUPABASE+'/auth/v1/logout?scope=local', { method:'POST', headers:{ apikey:k, Authorization:'Bearer '+accessToken } },true,true);
    },
  };
}
export type ApiAuth = ReturnType<typeof creerAuth>;
