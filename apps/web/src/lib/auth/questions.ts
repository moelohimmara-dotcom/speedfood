/**
 * Questions de sécurité facultatives : logique pure (aucun accès à la base ni au serveur), donc testable.
 *
 * Rappel de ce que c'est : une barrière contrôlée par l'application, en plus du mot de passe. Ce n'est PAS une
 * double authentification Supabase (pas de session renforcée) : elle ne protège pas l'API de données appelée
 * directement. Voir `supabase/migrations/20261017150000_questions_securite.sql`.
 */

export interface QuestionSecurite {
  cle: string;
  libelle: string;
}

/** Liste fermée : pas de question libre (trop souvent triviale). Les clés sont stockées, jamais les libellés. */
export const QUESTIONS_SECURITE: readonly QuestionSecurite[] = [
  { cle: "ville_naissance_mere", libelle: "Dans quelle ville est née votre mère ?" },
  { cle: "premier_ecole", libelle: "Comment s'appelait votre première école ?" },
  { cle: "premier_employeur", libelle: "Quel était le nom de votre premier employeur ?" },
  { cle: "surnom_enfance", libelle: "Quel était votre surnom d'enfance ?" },
  { cle: "plat_enfance", libelle: "Quel plat de votre enfance vous rappelle le plus la maison ?" },
  { cle: "premier_telephone", libelle: "Quelle était la marque de votre tout premier téléphone ?" },
  { cle: "quartier_enfance", libelle: "Dans quel quartier avez-vous grandi ?" },
  { cle: "meilleur_ami_enfance", libelle: "Quel est le prénom de votre meilleur ami d'enfance ?" },
  { cle: "premier_voyage", libelle: "Quelle est la première ville où vous avez voyagé loin de chez vous ?" },
  { cle: "professeur_marquant", libelle: "Quel est le nom du professeur qui vous a le plus marqué ?" },
];

export const NOMBRE_CODES_SECOURS = 8;
export const ESSAIS_MAX = 5;
export const BLOCAGE_MINUTES = 15;
export const VALIDITE_SESSION_HEURES = 12;
export const ITERATIONS_PBKDF2 = 100_000; // plafond de Cloudflare Workers pour PBKDF2
export const LONGUEUR_REPONSE_MIN = 3;
export const LONGUEUR_REPONSE_MAX = 80;

export function estCleQuestionValide(cle: string): boolean {
  return QUESTIONS_SECURITE.some((q) => q.cle === cle);
}

export function libelleQuestion(cle: string): string {
  return QUESTIONS_SECURITE.find((q) => q.cle === cle)?.libelle ?? "Question de sécurité";
}

/** Casse, accents, espaces multiples et ponctuation de bord ignorés : « Conakry », « conakry  » et « Cônakry. » valent pareil. */
export function normaliserReponse(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Contrôle d'une réponse saisie à l'activation. `null` si elle convient, sinon le message à afficher. */
export function erreurReponse(brut: string): string | null {
  const n = normaliserReponse(brut);
  if (n.length < LONGUEUR_REPONSE_MIN) {
    return `Chaque réponse doit contenir au moins ${LONGUEUR_REPONSE_MIN} caractères.`;
  }
  if (brut.length > LONGUEUR_REPONSE_MAX) {
    return `Chaque réponse doit faire ${LONGUEUR_REPONSE_MAX} caractères au plus.`;
  }
  return null;
}

function versHex(octets: Uint8Array): string {
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

function depuisHex(hex: string): Uint8Array {
  const sortie = new Uint8Array(hex.length / 2);
  for (let i = 0; i < sortie.length; i++) sortie[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return sortie;
}

export function genererSel(): string {
  return versHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Une seule empreinte pour les deux réponses (un seul calcul coûteux par vérification). */
export async function empreinteReponses(reponse1: string, reponse2: string, selHex: string, iterations: number = ITERATIONS_PBKDF2): Promise<string> {
  const matiere = new TextEncoder().encode(`${normaliserReponse(reponse1)}\u0000${normaliserReponse(reponse2)}`);
  const cle = await crypto.subtle.importKey("raw", matiere, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: depuisHex(selHex) as BufferSource, iterations }, cle, 256);
  return versHex(new Uint8Array(bits));
}

/** Comparaison en temps constant de deux chaînes hexadécimales. */
export function memeEmpreinte(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Alphabet sans caractères ambigus (0/O, 1/I/L) : les codes se recopient à la main.
const ALPHABET_CODES = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Code de secours au format XXXXX-XXXXX (10 caractères, environ 49 bits). */
export function genererCodeSecours(): string {
  const octets = crypto.getRandomValues(new Uint8Array(10));
  const lettres = Array.from(octets, (o) => ALPHABET_CODES[o % ALPHABET_CODES.length]);
  return `${lettres.slice(0, 5).join("")}-${lettres.slice(5).join("")}`;
}

export function genererCodesSecours(n: number = NOMBRE_CODES_SECOURS): string[] {
  const codes = new Set<string>();
  while (codes.size < n) codes.add(genererCodeSecours());
  return [...codes];
}

/** Majuscules, sans espaces ni tirets : `abcde-fghjk` et `ABCDE FGHJK` valent le même code. */
export function normaliserCode(brut: string): string {
  return brut.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function empreinteCode(brut: string): Promise<string> {
  const condensat = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`speedfood-secours:${normaliserCode(brut)}`));
  return versHex(new Uint8Array(condensat));
}

/** Le code saisi a-t-il la forme d'un code de secours ? (évite un calcul inutile sur une saisie absurde) */
export function ressembleACodeSecours(brut: string): boolean {
  return /^[A-Z2-9]{10}$/.test(normaliserCode(brut)) && !/[IOL01]/.test(normaliserCode(brut));
}

/** Prochain état du compteur d'essais après une erreur. */
export function apresEchec(essaisActuels: number, maintenant: Date): { essais: number; bloqueJusqu: Date | null } {
  const essais = essaisActuels + 1;
  if (essais >= ESSAIS_MAX) {
    return { essais: 0, bloqueJusqu: new Date(maintenant.getTime() + BLOCAGE_MINUTES * 60_000) };
  }
  return { essais, bloqueJusqu: null };
}

/** Minutes restantes avant la fin d'un blocage (0 si non bloqué), arrondies au-dessus. */
export function minutesDeBlocage(bloqueJusqu: string | Date | null, maintenant: Date): number {
  if (!bloqueJusqu) return 0;
  const fin = new Date(bloqueJusqu).getTime();
  const reste = fin - maintenant.getTime();
  return reste > 0 ? Math.ceil(reste / 60_000) : 0;
}
