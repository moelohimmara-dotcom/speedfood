// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Une commande est « à traiter » quand le restaurant doit réagir : elle est `en_attente` ET aucune proposition de prix ne attend la
 * réponse du client (dans ce cas elle est « en attente de confirmation du client » : le ballon et le carillon ne doivent pas
 * relancer le restaurateur). Même règle que la section « À traiter » de la page Commandes (`calculerEtatDerive`).
 */
export interface PropositionMin {
  statut: string;
  expire_le: string | null;
}

export function propositionActiveMin(propositions: PropositionMin[] | null | undefined, maintenant: Date = new Date()): boolean {
  return (propositions ?? []).some((p) => p.statut === "en_attente" && (p.expire_le === null || new Date(p.expire_le) > maintenant));
}

export interface CommandeATraiterMin {
  id: string;
  cree_le: string;
  order_proposals?: PropositionMin[] | null;
}

/** Garde les commandes réellement à traiter (sans proposition active), de la plus récente à la plus ancienne. */
export function commandesATraiter<T extends CommandeATraiterMin>(commandesEnAttente: T[], maintenant: Date = new Date()): T[] {
  return commandesEnAttente.filter((c) => !propositionActiveMin(c.order_proposals, maintenant));
}

export const HISTORIQUE_PAS = 20;
export const HISTORIQUE_MAX = 500;

/**
 * Nombre de commandes de l'historique à afficher : `?historique=` de l'adresse, ramené à un multiple du pas, entre un pas et le maximum.
 * Une valeur absente, illisible ou négative donne un pas. Jamais d'exception : l'adresse vient du navigateur.
 */
export function limiteHistorique(brute: string | string[] | undefined): number {
  const texte = Array.isArray(brute) ? brute[0] : brute;
  const n = Number.parseInt(texte ?? "", 10);
  if (!Number.isFinite(n) || n < HISTORIQUE_PAS) return HISTORIQUE_PAS;
  return Math.min(Math.ceil(n / HISTORIQUE_PAS) * HISTORIQUE_PAS, HISTORIQUE_MAX);
}
