/**
 * Contrats liés au menu (TDR.md §5, ADR-006 : prix en entier GNF, pas de flottant).
 */

export interface MenuItem {
  id: string;
  restaurantId: string;
  nom: string;
  description: string;
  /** Montant en GNF, entier, jamais de virgule flottante (ADR-006). */
  prix: number;
  disponible: boolean;
  /** Suppression logique : un plat référencé par une commande passée ne peut pas être supprimé physiquement. */
  archiveLe: string | null;
}
