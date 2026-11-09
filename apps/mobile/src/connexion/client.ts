import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';
import { lireCommandes, lireSuivi } from './commandes.ts';
import { ADRESSE_MAX, ADRESSE_MIN, ErreurCommande, erreurReseau, lireEstimation, lireReponseCreation, refusServeur, type ResultatEstimation } from '../catalogue/commande-reelle.ts';
import { ErreurReglement, MODES_REGLEMENT, erreurReponseReglement, erreurReseauReglement, lireReponseDeclaration, refusDeclaration } from './reglement.ts';
import { ACTIONS_DE_STATUT, ACTIONS_RESTAURATEUR, decisionPaiementDe, ErreurRestaurateur, erreurLocaleLivraison, erreurReponseLivraison, erreurReseauLivraison, refusLivraisonRestaurateur, erreurReponseRestaurateur, erreurReseauRestaurateur, lireListeRestaurateur, lireRaisonSecurite, lireReponseAction, lireRoles, refusRestaurateur, type ActionRestaurateur, type ListeRestaurateur, type RolesCompte, type ValeursPropositionRestaurateur } from './restaurateur.ts';
import { corpsDeAction, erreurLocalePhoto, erreurReponseService, erreurReseauPhoto, erreurReseauService, lireMenuRestaurateur, lireReglagesRestaurateur, refusService, type ActionService, type MenuRestaurateur, type ReglagesRestaurateur } from './serviceRestaurateur.ts';
import { CHEMIN_PHOTO_APP, PHOTO_TAILLE_MAX_OCTETS } from '../../../../packages/shared/src/contracts/restaurant-photo.ts';
import { lireValeursPropositionApp, type RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';
import { CHEMIN_LIVRAISON_APP, MESSAGE_CODE_LIVRAISON, lireActionLivraisonApp, lireDemandeLivraisonApp, type ActionLivraisonApp } from '../../../../packages/shared/src/contracts/restaurant-livraison.ts';
import { lireReferencePaiement } from '../../../../packages/shared/src/paiement/regles.ts';
import { ErreurLivreur, lireEnLigneLivreur, lireEtatLivreur, lireFicheLivreur, type EtatLivreur, type FicheLivreur } from './livreur.ts';
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
    const user = objet(v.user);
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || typeof v.expires_in !== 'number' || !Number.isSafeInteger(v.expires_in) || v.expires_in < 1 || v.expires_in > 86400) throw new ErreurConnexion('Réponse de connexion invalide.');
    return { accessToken:secret(v.access_token,16384), refreshToken:secret(v.refresh_token,1024), expiresAt:Math.floor(Date.now()/1000)+v.expires_in, userId:user.id };
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
  return {
    creerCommande: postCommande,
    declarerPaiement: postDeclaration,
    async ficheLivreur(accessToken: string): Promise<FicheLivreur | null> {
      const v = await requete(ORIGINE_CATALOGUE+'/api/v1/livreur/fiche', { method:'GET', headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json' } });
      try { return lireFicheLivreur(v); } catch { throw new ErreurConnexion('La fiche reçue est illisible. Réessayez dans un instant.'); }
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
      const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), delaiCommandeMs);
      let r: Response;
      try {
        r = await fetcher(ORIGINE_CATALOGUE+'/api/v1/livreur/en-ligne', { method:'POST', credentials:'omit', signal:controle.signal, headers:{ Authorization:'Bearer '+accessToken, Accept:'application/json', 'Content-Type':'application/json' }, body: JSON.stringify({ enLigne }) });
      } catch { clearTimeout(timer); throw new ErreurLivreur('incertain', 'Impossible de joindre Speedfood. Vérifiez votre connexion.'); }
      try {
        let corps: unknown = null;
        const json = (r.headers.get('content-type') ?? '').includes('application/json') && !(Number(r.headers.get('content-length')) > 262144);
        if (json) { try { const texte = await r.text(); if (texte.length <= 262144) corps = JSON.parse(texte); } catch { corps = null; } }
        else { try { await r.body?.cancel(); } catch { /* corps déjà fermé */ } }
        if (r.status === 401) throw new ErreurConnexion('Votre session a pris fin. Reconnectez-vous.', true);
        if (r.status === 400) throw new ErreurLivreur('refus', 'Changement refusé : votre état a peut-être changé. Actualisez votre état.');
        if (r.status === 429) throw new ErreurLivreur('refus', 'Trop de tentatives. Patientez un instant avant de réessayer.');
        if (!r.ok) throw new ErreurLivreur('incertain', 'Le service est indisponible. Votre disponibilité a peut-être changé : actualisez pour vérifier.');
        try { lireEnLigneLivreur(corps); } catch { throw new ErreurLivreur('incertain', 'La réponse de disponibilité est illisible. Actualisez votre état pour vérifier.'); }
      } finally { clearTimeout(timer); }
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
