/**
 * Notification push web : identification VAPID (RFC 8292) et règles d'envoi. Fonctions sans effet de bord,
 * fondées sur WebCrypto (disponible sur Cloudflare Workers comme sur Node), donc testables sans navigateur.
 *
 * Choix de conception : la notification est envoyée SANS charge utile. Le Service Worker affiche toujours le même
 * texte générique (« Nouvelle commande ») : aucun nom, téléphone, adresse ni montant ne transite par les services
 * de push (Google, Mozilla, Apple), et il n'y a rien à chiffrer (pas besoin du chiffrement RFC 8291).
 */

export interface ClesVapid {
  /** Clé publique, point non compressé (65 octets) en base64url : celle que le navigateur reçoit. */
  clePublique: string;
  /** Clé privée, scalaire (32 octets) en base64url. SECRET : jamais dans le dépôt, jamais dans un journal. */
  clePrivee: string;
  /** Contact de l'expéditeur (`mailto:` ou `https:`), exigé par les services de push. */
  sujet: string;
}

const encodeur = new TextEncoder();

export function versBase64Url(octets: Uint8Array | ArrayBuffer): string {
  const bytes = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let binaire = "";
  for (const b of bytes) {
    binaire += String.fromCharCode(b);
  }
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function depuisBase64Url(texte: string): Uint8Array<ArrayBuffer> {
  const standard = texte.replace(/-/g, "+").replace(/_/g, "/");
  const rempli = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  const binaire = atob(rempli);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

/** Contact valide : `mailto:adresse` ou `https://…` (jamais une valeur vide ou arbitraire). */
export function sujetVapidValide(sujet: string): boolean {
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sujet) || /^https:\/\/[^\s/]+/.test(sujet);
}

/**
 * Services de push autorisés. Le point d'accès est fourni par le navigateur du restaurateur puis lu par le serveur :
 * sans liste blanche, un abonnement forgé ferait envoyer des requêtes à n'importe quelle adresse (SSRF).
 */
const HOTES_PUSH_EXACTS = new Set(["fcm.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com"]);
const SUFFIXES_PUSH = [".push.apple.com", ".push.services.mozilla.com", ".notify.windows.com"];

export function estPointAccesPushAutorise(endpoint: string): boolean {
  if (endpoint.length < 20 || endpoint.length > 1000) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // Un vrai point d'accès a toujours un chemin ou une requête avec un identifiant d'abonnement.
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname.length + url.search.length < 8) {
    return false;
  }
  const hote = url.hostname.toLowerCase();
  return HOTES_PUSH_EXACTS.has(hote) || SUFFIXES_PUSH.some((suffixe) => hote.endsWith(suffixe));
}

async function importerClePrivee(cles: ClesVapid): Promise<CryptoKey> {
  const publique = depuisBase64Url(cles.clePublique);
  if (publique.length !== 65 || publique[0] !== 4) {
    throw new Error("Clé publique VAPID invalide.");
  }
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: versBase64Url(publique.slice(1, 33)),
    y: versBase64Url(publique.slice(33, 65)),
    d: cles.clePrivee,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/**
 * Jeton JWT ES256 prouvant que l'expéditeur est le propriétaire de la clé VAPID. `aud` est l'origine du service de
 * push visé ; la validité est limitée (12 h par défaut, le maximum toléré est de 24 h).
 */
export async function creerJetonVapid(
  endpoint: string,
  cles: ClesVapid,
  maintenantMs: number = Date.now(),
  dureeSecondes: number = 12 * 3600
): Promise<string> {
  if (!sujetVapidValide(cles.sujet)) {
    throw new Error("Contact VAPID invalide.");
  }
  const audience = new URL(endpoint).origin;
  const entete = versBase64Url(encodeur.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const revendications = versBase64Url(
    encodeur.encode(JSON.stringify({ aud: audience, exp: Math.floor(maintenantMs / 1000) + dureeSecondes, sub: cles.sujet }))
  );
  const aSigner = `${entete}.${revendications}`;
  const cle = await importerClePrivee(cles);
  // WebCrypto renvoie la signature ECDSA au format brut r‖s (64 octets), exactement ce qu'exige JWS ES256.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, encodeur.encode(aSigner));
  return `${aSigner}.${versBase64Url(signature)}`;
}

/** En-tête `Authorization` d'une requête de push (schéma `vapid` accepté par Google, Mozilla et Apple). */
export function enteteAutorisationVapid(jeton: string, clePublique: string): string {
  return `vapid t=${jeton}, k=${clePublique}`;
}

/** Que faire d'une réponse d'un service de push : succès, abonnement expiré (à supprimer) ou échec passager. */
export function interpreterReponsePush(statut: number): "ok" | "expire" | "echec" {
  if (statut >= 200 && statut < 300) {
    return "ok";
  }
  if (statut === 404 || statut === 410) {
    return "expire";
  }
  return "echec";
}

/** Un abonnement est supprimé après autant d'échecs consécutifs (service injoignable, appareil disparu). */
export const ECHECS_AVANT_SUPPRESSION = 5;
