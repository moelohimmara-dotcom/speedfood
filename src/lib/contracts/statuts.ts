/**
 * Statuts de commande — source unique de vérité (TDR.md §6, ADR-005).
 *
 * Transitions autorisées : en_attente -> acceptee | refusee
 *                          acceptee   -> prete
 *                          prete      -> terminee
 *                          (n'importe quel état non terminal) -> annulee, selon règles d'annulation à définir au bloc 7.
 *
 * Toute transition doit être validée et historisée côté serveur (jamais côté client).
 */
export const STATUTS_COMMANDE = [
  "en_attente",
  "acceptee",
  "refusee",
  "prete",
  "terminee",
  "annulee",
] as const;

export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

const TRANSITIONS_AUTORISEES: Record<StatutCommande, readonly StatutCommande[]> = {
  en_attente: ["acceptee", "refusee", "annulee"],
  acceptee: ["prete", "annulee"],
  prete: ["terminee"],
  refusee: [],
  terminee: [],
  annulee: [],
};

/** Vérifie qu'une transition de statut est permise. À utiliser côté serveur avant toute écriture. */
export function transitionAutorisee(depuis: StatutCommande, vers: StatutCommande): boolean {
  return TRANSITIONS_AUTORISEES[depuis].includes(vers);
}

export const STATUTS_ACTIFS: readonly StatutCommande[] = ["en_attente", "acceptee", "prete"];
export const STATUTS_TERMINAUX: readonly StatutCommande[] = ["terminee", "refusee", "annulee"];
