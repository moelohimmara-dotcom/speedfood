import "server-only";
import { construireMessageFcm, creerAssertionJwt, interpreterReponseFcm, lireCompteServiceFcm, URL_JETON_GOOGLE, type CompteServiceFcm, type IssueFcm, type TypeNotification } from "./fcm";

/**
 * Envoi réseau des notifications poussées natives. Réservé au serveur : le compte de service (secret `FCM_SERVICE_ACCOUNT`) ne sort jamais du Worker et n'est
 * jamais journalisé. Meilleur effort : aucune fonction de ce fichier ne lève d'exception.
 */

export function compteServiceConfigure(): CompteServiceFcm | null {
  return lireCompteServiceFcm(process.env.FCM_SERVICE_ACCOUNT);
}

// Jeton d'accès gardé en mémoire de l'instance du Worker (une heure moins une marge) : évite un aller-retour vers Google à chaque notification.
let cache: { jeton: string; expireLe: number; compte: string } | null = null;

async function jetonAcces(compte: CompteServiceFcm): Promise<string | null> {
  const maintenant = Math.floor(Date.now() / 1000);
  if (cache && cache.compte === compte.clientEmail && cache.expireLe - 120 > maintenant) return cache.jeton;
  try {
    const assertion = await creerAssertionJwt(compte, maintenant);
    const reponse = await fetch(URL_JETON_GOOGLE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(8000),
    });
    if (!reponse.ok) return null;
    const corps = (await reponse.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof corps.access_token !== "string") return null;
    cache = { jeton: corps.access_token, expireLe: maintenant + (typeof corps.expires_in === "number" ? corps.expires_in : 3000), compte: compte.clientEmail };
    return corps.access_token;
  } catch {
    return null;
  }
}

/** Envoie une notification à un appareil. `validerSeulement` : contrôle le message et les identifiants sans rien envoyer (essai sans effet sur un téléphone). */
export async function envoyerFcm(jetonAppareil: string, type: TypeNotification, validerSeulement = false): Promise<IssueFcm> {
  const compte = compteServiceConfigure();
  if (!compte) return "echec";
  const acces = await jetonAcces(compte);
  if (!acces) return "echec";
  try {
    const reponse = await fetch(`https://fcm.googleapis.com/v1/projects/${compte.projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${acces}`, "Content-Type": "application/json" },
      body: JSON.stringify(construireMessageFcm(jetonAppareil, type, validerSeulement)),
      signal: AbortSignal.timeout(8000),
    });
    let corps: unknown = null;
    try {
      corps = await reponse.json();
    } catch {
      corps = null;
    }
    return interpreterReponseFcm(reponse.status, corps);
  } catch {
    return "echec";
  }
}
