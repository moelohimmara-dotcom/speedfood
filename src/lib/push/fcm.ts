// Notifications poussées des applications natives (Firebase Cloud Messaging, API HTTP v1). Partie pure : testable seule (npm run test:unit).
// L'envoi réseau est dans `fcm-envoi.ts`. Aucune donnée de client ne voyage dans une notification : un texte générique par type d'événement.

/** Compte de service Firebase (le fichier JSON de la clé privée), lu dans le secret `FCM_SERVICE_ACCOUNT` du Worker. */
export interface CompteServiceFcm {
  projectId: string;
  clientEmail: string;
  clePrivee: string;
}

/** Lit le secret ; `null` si absent ou illisible (aucun envoi, jamais d'erreur : la fonction n'est simplement pas configurée). */
export function lireCompteServiceFcm(brut: string | undefined): CompteServiceFcm | null {
  if (!brut) return null;
  try {
    const j = JSON.parse(brut) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (typeof j.project_id !== "string" || typeof j.client_email !== "string" || typeof j.private_key !== "string") return null;
    if (!/^[a-z][a-z0-9-]{4,60}$/.test(j.project_id) || !j.client_email.endsWith(".gserviceaccount.com") || !j.private_key.includes("BEGIN PRIVATE KEY")) return null;
    return { projectId: j.project_id, clientEmail: j.client_email, clePrivee: j.private_key };
  } catch {
    return null;
  }
}

/** Type d'événement notifié : détermine le texte, le canal Android (créé par l'application) et la durée de validité. */
export type TypeNotification = "commande_nouvelle" | "course_offre" | "commande_acceptee" | "commande_prete" | "commande_terminee" | "commande_refusee" | "commande_annulee" | "essai" | "mise_a_jour" | "equipe_commande";

export interface ContenuNotification {
  titre: string;
  texte: string;
  /** Canal Android : doit exister dans l'application (voir `SpeedfoodApp`). */
  canal: "alerte_commande" | "offre_course" | "suivi_commande" | "mise_a_jour";
  /** Durée de validité en secondes : au-delà, la notification n'a plus de sens et n'est plus livrée. */
  validiteSecondes: number;
}

const CONTENUS: Record<TypeNotification, ContenuNotification> = {
  commande_nouvelle: { titre: "Nouvelle commande", texte: "Une commande attend votre réponse. Ouvrez Speedfood.", canal: "alerte_commande", validiteSecondes: 1800 },
  course_offre: { titre: "Nouvelle course", texte: "Une course vous est proposée. Répondez vite.", canal: "offre_course", validiteSecondes: 60 },
  commande_acceptee: { titre: "Commande acceptée", texte: "Le restaurant prépare votre commande.", canal: "suivi_commande", validiteSecondes: 3600 },
  commande_prete: { titre: "Commande prête", texte: "Votre commande est prête.", canal: "suivi_commande", validiteSecondes: 3600 },
  commande_terminee: { titre: "Commande terminée", texte: "Merci d'avoir commandé avec Speedfood.", canal: "suivi_commande", validiteSecondes: 3600 },
  commande_refusee: { titre: "Commande refusée", texte: "Le restaurant n'a pas pu accepter votre commande.", canal: "suivi_commande", validiteSecondes: 3600 },
  commande_annulee: { titre: "Commande annulée", texte: "Votre commande a été annulée.", canal: "suivi_commande", validiteSecondes: 3600 },
  mise_a_jour: { titre: "Mise à jour disponible", texte: "Une nouvelle version de Speedfood est disponible. Ouvrez l'application pour la télécharger.", canal: "mise_a_jour", validiteSecondes: 604800 },
  equipe_commande: { titre: "Commande à confirmer", texte: "Un établissement tenu par Speedfood a une commande à confirmer. Ouvrez le poste de répartition.", canal: "alerte_commande", validiteSecondes: 1800 },
  essai: { titre: "Essai Speedfood", texte: "Les notifications fonctionnent sur cet appareil.", canal: "suivi_commande", validiteSecondes: 300 },
};

export function contenuPourType(type: TypeNotification): ContenuNotification {
  return CONTENUS[type];
}

/** Corps de l'envoi d'un message à un appareil (API HTTP v1). `validerSeulement` : vérifie le message et l'authentification sans rien envoyer. */
export function construireMessageFcm(jetonAppareil: string, type: TypeNotification, validerSeulement = false): { validate_only?: boolean; message: Record<string, unknown> } {
  const c = contenuPourType(type);
  return {
    ...(validerSeulement ? { validate_only: true } : {}),
    message: {
      token: jetonAppareil,
      notification: { title: c.titre, body: c.texte },
      data: { type },
      android: {
        priority: "HIGH",
        ttl: `${c.validiteSecondes}s`,
        notification: { channel_id: c.canal, sound: "default" },
      },
    },
  };
}

export type IssueFcm = "ok" | "expire" | "echec";

/**
 * Lecture de la réponse de l'API : un jeton inconnu ou périmé (404, UNREGISTERED, jeton invalide) est à supprimer ; une erreur d'authentification, de quota ou
 * du service est transitoire (on garde l'appareil et on réessaiera). Ne lit jamais le contenu du message.
 */
export function interpreterReponseFcm(statut: number, corps: unknown): IssueFcm {
  if (statut >= 200 && statut < 300) return "ok";
  const erreur = (corps as { error?: { status?: unknown; details?: Array<{ errorCode?: unknown }> } } | null)?.error;
  const codes = [erreur?.status, ...(erreur?.details ?? []).map((d) => d.errorCode)];
  if (statut === 404 || codes.includes("UNREGISTERED") || codes.includes("NOT_FOUND")) return "expire";
  // « INVALID_ARGUMENT » vise le jeton de l'appareil quand notre message est correct (construit par `construireMessageFcm`).
  if (statut === 400 && codes.includes("INVALID_ARGUMENT")) return "expire";
  return "echec";
}

/** PEM « PRIVATE KEY » (PKCS#8) vers ses octets. */
export function pemVersOctets(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function base64Url(donnees: Uint8Array | string): string {
  const octets = typeof donnees === "string" ? new TextEncoder().encode(donnees) : donnees;
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export const PORTEE_FCM = "https://www.googleapis.com/auth/firebase.messaging";
export const URL_JETON_GOOGLE = "https://oauth2.googleapis.com/token";

/** Assertion JWT (RS256) échangée contre un jeton d'accès Google : valable une heure, portée limitée à l'envoi de messages. */
export async function creerAssertionJwt(compte: CompteServiceFcm, maintenantSecondes: number, crypto: Crypto = globalThis.crypto): Promise<string> {
  const entete = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = base64Url(
    JSON.stringify({ iss: compte.clientEmail, scope: PORTEE_FCM, aud: URL_JETON_GOOGLE, iat: maintenantSecondes, exp: maintenantSecondes + 3600 })
  );
  const cle = await crypto.subtle.importKey("pkcs8", pemVersOctets(compte.clePrivee) as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle, new TextEncoder().encode(`${entete}.${charge}`)));
  return `${entete}.${charge}.${base64Url(signature)}`;
}

/** Jeton d'appareil bien formé (identifiant d'installation Firebase) : borne la taille et les caractères avant tout enregistrement. */
export function jetonAppareilValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.length >= 20 && valeur.length <= 4096 && /^[A-Za-z0-9_:\-.]+$/.test(valeur);
}
