import type { StatutCommande } from "./statuts";

export type ModeRetrait = "retrait" | "livraison";

/**
 * Coordonnées client saisies à la commande. Aucun compte requis (ADR-005).
 * L'adresse n'est obligatoire que si mode === "livraison" (TDR.md §5).
 */
export interface ClientCommande {
  nom: string;
  telephone: string;
  adresse: string | null;
}

/**
 * Ligne de commande — instantané figé au moment de l'envoi (ADR-006).
 * Le nom et le prix sont copiés depuis MenuItem à l'instant T et ne changent plus
 * même si le plat est modifié ou supprimé ensuite. Ne jamais recalculer une ligne
 * historique à partir du menu courant.
 */
export interface LigneCommande {
  menuItemId: string;
  nom: string;
  prix: number;
  quantite: number;
}

export interface Commande {
  id: string;
  /** Référence courte lisible affichée au client (ex. "SF-4KVB9"), distincte de l'identifiant interne. */
  reference: string;
  /** Jeton opaque et non devinable servant de clé d'accès au suivi. Jamais un identifiant séquentiel. */
  jetonSuivi: string;
  restaurantId: string;
  client: ClientCommande;
  mode: ModeRetrait;
  lignes: LigneCommande[];
  /** Recalculé côté serveur à partir des lignes — ne jamais faire confiance à un total envoyé par le navigateur. */
  sousTotal: number;
  fraisLivraisonEstime: number;
  statut: StatutCommande;
  creeLe: string;
  misAJourLe: string;
}

/** Entrée d'audit d'une transition de statut — TDR.md §6 : chaque transition est historisée. */
export interface EvenementStatutCommande {
  commandeId: string;
  statutPrecedent: StatutCommande | null;
  statutSuivant: StatutCommande;
  acteur: string;
  horodatage: string;
}
