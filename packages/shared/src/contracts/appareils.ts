/**
 * Contrat de `POST /api/v1/appareils` (enregistrer l'appareil du compte connecté pour les notifications) et de `POST /api/v1/appareils/retirer` (le retirer à la déconnexion), lot E1.
 * Pur : aucun import du site, de Next, de Supabase ni de Node ; l'API et l'application le chargent tel quel.
 *
 * Le compte vient TOUJOURS du jeton porteur : aucun champ du corps ne désigne un compte (un `utilisateurId` envoyé est ignoré). Le jeton d'appareil n'est jamais renvoyé, ni dans une réponse,
 * ni dans une erreur.
 */

export const CHEMIN_APPAREILS_APP = "/api/v1/appareils";
export const CHEMIN_APPAREILS_RETRAIT_APP = "/api/v1/appareils/retirer";

/** Liste blanche des plateformes. */
export const PLATEFORMES_APPAREIL = ["android", "ios"] as const;
export type PlateformeAppareil = (typeof PLATEFORMES_APPAREIL)[number];

export const MESSAGE_APPAREIL_INVALIDE = "Appareil invalide.";
export const VERSION_APP_LONGUEUR_MAX = 40;

/** Jeton d'appareil bien formé (identifiant d'installation Firebase) : 20 à 4096 caractères parmi `A-Z a-z 0-9 _ : - .`. Même règle que `jetonAppareilValide` du site (un test de l'API compare les deux). */
export function jetonAppareilValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.length >= 20 && valeur.length <= 4096 && /^[A-Za-z0-9_:\-.]+$/.test(valeur);
}

export function lirePlateformeAppareil(valeur: unknown): PlateformeAppareil | null {
  return typeof valeur === "string" && (PLATEFORMES_APPAREIL as readonly string[]).includes(valeur) ? (valeur as PlateformeAppareil) : null;
}

/** Version de l'application : une chaîne d'au plus 40 caractères, sinon `null` (jamais un refus : champ facultatif). */
export function lireVersionApp(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.length <= VERSION_APP_LONGUEUR_MAX ? valeur : null;
}

export interface DemandeAppareil {
  jeton: string;
  plateforme: PlateformeAppareil;
  versionApp?: string;
}
export interface DemandeRetraitAppareil {
  jeton: string;
}
export interface ReponseAppareil {
  ok: true;
}

export type LectureDemandeAppareil = { ok: true; jeton: string; plateforme: PlateformeAppareil; versionApp: string | null } | { ok: false; message: string };
export type LectureDemandeRetrait = { ok: true; jeton: string } | { ok: false; message: string };

const objet = (corps: unknown): { jeton?: unknown; plateforme?: unknown; versionApp?: unknown } =>
  typeof corps === "object" && corps !== null && !Array.isArray(corps) ? (corps as { jeton?: unknown; plateforme?: unknown; versionApp?: unknown }) : {};

/** Lit le corps d'un enregistrement. Seuls `jeton`, `plateforme` et `versionApp` sont lus ; toute autre clé (dont `utilisateurId`) est ignorée. Aucun message ne reprend le jeton reçu. */
export function lireDemandeAppareil(corps: unknown): LectureDemandeAppareil {
  const o = objet(corps);
  const plateforme = lirePlateformeAppareil(o.plateforme);
  if (!jetonAppareilValide(o.jeton) || plateforme === null) return { ok: false, message: MESSAGE_APPAREIL_INVALIDE };
  return { ok: true, jeton: o.jeton, plateforme, versionApp: lireVersionApp(o.versionApp) };
}

export function lireDemandeRetrait(corps: unknown): LectureDemandeRetrait {
  const o = objet(corps);
  if (!jetonAppareilValide(o.jeton)) return { ok: false, message: MESSAGE_APPAREIL_INVALIDE };
  return { ok: true, jeton: o.jeton };
}
