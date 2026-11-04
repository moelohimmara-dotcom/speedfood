/**
 * Contrat de `POST /api/v1/restaurant/livraison/action` de l'application native (lot D5 : le restaurant qui livre lui-même fait avancer SA livraison) et du bloc `livraison`
 * des commandes de `GET /api/v1/restaurant/commandes`.
 * Pur : aucun import du site, de Next, de Supabase ni de Node ; l'API et l'application le chargent tel quel.
 *
 * Trois actions seulement : « partir » (la livraison passe à « en route vers le client »), « livree » (avec le code à 4 chiffres que le client donne à la porte) et « annuler ».
 * Le restaurant n'est JAMAIS un champ : il vient de l'appartenance du compte. L'identifiant de la livraison n'est pas une autorisation : le serveur vérifie qu'elle est à ce restaurant.
 * Le code de remise n'est jamais lu, renvoyé ni journalisé par ce contrat : l'application l'envoie, le serveur le compare (avec son plafond d'essais), et il ne figure dans aucune réponse.
 */

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CHEMIN_LIVRAISON_APP = "/api/v1/restaurant/livraison/action";

export const ACTIONS_LIVRAISON_APP = ["partir", "livree", "annuler"] as const;
export type ActionLivraisonApp = (typeof ACTIONS_LIVRAISON_APP)[number];

/** Liste blanche : toute autre valeur (variante de casse, « echec », « recuperee », valeur inconnue) est refusée avant le service. */
export function lireActionLivraisonApp(valeur: unknown): ActionLivraisonApp | null {
  return typeof valeur === "string" && (ACTIONS_LIVRAISON_APP as readonly string[]).includes(valeur) ? (valeur as ActionLivraisonApp) : null;
}

/** Statuts d'une livraison : ceux du site (`lib/livraison/statuts.ts`), recopiés ici parce que ce fichier est pur ; un test de l'API compare les deux listes. */
export const STATUTS_LIVRAISON_APP = ["a_assigner", "offre_envoyee", "assignee", "vers_restaurant", "recuperee", "vers_client", "livree", "echec", "annulee"] as const;
export type StatutLivraisonApp = (typeof STATUTS_LIVRAISON_APP)[number];
export const MODES_LIVRAISON_APP = ["propre", "speedfood"] as const;
export type ModeLivraisonApp = (typeof MODES_LIVRAISON_APP)[number];

/** Livraison terminée (rien ne peut plus la faire avancer). */
export function livraisonTerminee(statut: StatutLivraisonApp): boolean {
  return statut === "livree" || statut === "echec" || statut === "annulee";
}

/**
 * Statuts depuis lesquels le restaurant peut annuler sa livraison (transitions du site : `annulee` n'existe que tant que la course n'est pas partie). Une fois « récupérée » ou « en route »,
 * seul l'échec ou la remise est possible : l'application ne propose alors pas d'annulation.
 */
export function livraisonAnnulable(statut: StatutLivraisonApp): boolean {
  return statut === "a_assigner" || statut === "offre_envoyee" || statut === "assignee" || statut === "vers_restaurant";
}

/**
 * Bloc minimal d'une commande en livraison : identifiant, statut et mode. Jamais le code de remise, jamais le livreur (nom, téléphone, position), jamais les coordonnées,
 * jamais une livraison d'un autre restaurant.
 */
export interface LivraisonRestaurateurApi {
  id: string;
  statut: StatutLivraisonApp;
  mode: ModeLivraisonApp;
}

/** Lecture stricte d'une ligne de livraison : valeur inconnue ou mal formée = `null` (la ligne est écartée et comptée, jamais toute la liste). Seuls trois champs sont retenus. */
export function lireLivraisonApi(brut: unknown): LivraisonRestaurateurApi | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const { id, statut, mode } = brut as { id?: unknown; statut?: unknown; mode?: unknown };
  if (typeof id !== "string" || !REGEX_UUID.test(id)) return null;
  if (typeof statut !== "string" || !(STATUTS_LIVRAISON_APP as readonly string[]).includes(statut)) return null;
  if (typeof mode !== "string" || !(MODES_LIVRAISON_APP as readonly string[]).includes(mode)) return null;
  return { id, statut: statut as StatutLivraisonApp, mode: mode as ModeLivraisonApp };
}

export const LONGUEUR_CODE_LIVRAISON = 4;
export const MESSAGE_CODE_LIVRAISON = "Le code doit avoir exactement 4 chiffres.";

/** Le code de remise : une chaîne d'exactement 4 chiffres (ni espace, ni signe, ni lettre, ni nombre). Sinon `null`. */
export function lireCodeLivraisonApp(valeur: unknown): string | null {
  return typeof valeur === "string" && /^[0-9]{4}$/.test(valeur) ? valeur : null;
}

export type LectureDemandeLivraison =
  | { ok: true; livraisonId: string; action: ActionLivraisonApp; code?: string }
  | { ok: false; message: string };

/**
 * Lit le corps. Ordre des refus (tous avant le service) : action hors liste blanche, livraison qui n'est pas un UUID, puis, pour « livree » seulement, code qui n'a pas la forme de 4 chiffres.
 * Pour « partir » et « annuler », un éventuel `code` est ignoré et n'est jamais transmis. Les autres clés, dont `restaurantId`, ne sont jamais lues. Aucun message ne reprend le code reçu.
 */
export function lireDemandeLivraisonApp(corps: unknown): LectureDemandeLivraison {
  const o = typeof corps === "object" && corps !== null && !Array.isArray(corps) ? (corps as { livraisonId?: unknown; action?: unknown; code?: unknown }) : {};
  const action = lireActionLivraisonApp(o.action);
  if (action === null) return { ok: false, message: "Action invalide." };
  if (typeof o.livraisonId !== "string" || !REGEX_UUID.test(o.livraisonId)) return { ok: false, message: "Livraison invalide." };
  if (action !== "livree") return { ok: true, livraisonId: o.livraisonId, action };
  const code = lireCodeLivraisonApp(o.code);
  if (code === null) return { ok: false, message: MESSAGE_CODE_LIVRAISON };
  return { ok: true, livraisonId: o.livraisonId, action, code };
}
