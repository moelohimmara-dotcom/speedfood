import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';
import { lireCommandes, lireSuivi } from './commandes.ts';
import { ADRESSE_MAX, ADRESSE_MIN, ErreurCommande, erreurReseau, lireEstimation, lireReponseCreation, refusServeur, type ResultatEstimation } from '../catalogue/commande-reelle.ts';
import { ErreurReglement, MODES_REGLEMENT, erreurReponseReglement, erreurReseauReglement, lireReponseDeclaration, refusDeclaration } from './reglement.ts';
import { lireReferencePaiement } from '../../../../packages/shared/src/paiement/regles.ts';
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
export function creerAuth(fetcher: typeof fetch = fetch, delaiCommandeMs = 20000) {
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
  return {
    creerCommande: postCommande,
    declarerPaiement: postDeclaration,
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
