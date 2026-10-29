import "server-only";
import { createHmac, randomInt } from "node:crypto";

/**
 * Génération des identifiants de commande (bloc 7).
 *
 * - `reference` : courte, lisible, affichée publiquement (ex. `SF-4KVB9`).
 * - `jeton_suivi` : opaque, non devinable, seule clé d'accès à `/suivi/[jeton]`.
 *   Il est dérivé de façon DÉTERMINISTE de la clé d'idempotence fournie par le
 *   navigateur : deux soumissions d'une même commande (retry réseau, double
 *   clic) produisent donc le même jeton, et la contrainte UNIQUE sur
 *   `orders.jeton_suivi` sert de garde-fou d'idempotence (aucune table
 *   d'idempotence supplémentaire n'est possible — schéma gelé).
 *
 * Le jeton ne doit JAMAIS être journalisé (TDR.md §7, ADR-005) : aucun de ces
 * modules n'écrit dans la console, et aucune erreur renvoyée ne le contient.
 */

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour la référence lisible.
const ALPHABET_REFERENCE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LONGUEUR_REFERENCE = 5;

/** Référence publique courte, ex. `SF-4KVB9`. Aléatoire : elle ne doit rien révéler. */
export function genererReference(): string {
  let suffixe = "";
  for (let i = 0; i < LONGUEUR_REFERENCE; i += 1) {
    suffixe += ALPHABET_REFERENCE[randomInt(ALPHABET_REFERENCE.length)];
  }
  return `SF-${suffixe}`;
}

/**
 * Jeton de suivi déterministe : HMAC-SHA256(cle secrète serveur, clé
 * d'idempotence). La clé secrète est `COMMANDE_JETON_SECRET` si elle est
 * définie, sinon `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement, jamais dans le
 * bundle navigateur).
 */
export function genererJetonSuivi(cleIdempotence: string): string {
  const secret = process.env.COMMANDE_JETON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "COMMANDE_JETON_SECRET ou SUPABASE_SERVICE_ROLE_KEY doit être définie pour générer les jetons de suivi."
    );
  }
  return createHmac("sha256", secret)
    .update(`speedfood-jeton-suivi-v1:${cleIdempotence}`)
    .digest("base64url")
    .slice(0, 40);
}

const REGEX_JETON = /^[A-Za-z0-9_-]{40}$/;

/** Contrôle de forme du jeton reçu dans l'URL, avant tout accès à la base. */
export function estJetonValide(jeton: unknown): jeton is string {
  return typeof jeton === "string" && REGEX_JETON.test(jeton);
}
