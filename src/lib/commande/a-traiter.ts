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
