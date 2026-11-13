/**
 * Visite guidée au premier lancement (parité Kotlin, lot 4, ligne A10) : deux écrans pour le client, deux pour le restaurateur, fidèlement
 * repris. Elle n'est proposée automatiquement qu'au premier lancement ; elle reste accessible depuis l'accueil (et l'espace restaurateur).
 * Aucune position ni permission n'est demandée par la visite.
 */
export interface DiapoVisite { titre: string; texte: string }

export const DIAPOS_CLIENT: readonly DiapoVisite[] = [
  { titre: 'Les restaurants de votre zone', texte: "Changez de zone en un geste depuis l'accueil. Aucune position n'est demandée sans votre accord." },
  { titre: 'Commandez, puis suivez', texte: 'Le restaurant confirme votre plat. Vous suivez la préparation et la livraison.' },
];

export const DIAPOS_RESTAURATEUR: readonly DiapoVisite[] = [
  { titre: 'Speedfood tient votre fiche avec vous', texte: "Vous donnez vos plats et vos horaires. L'équipe les met en ligne et les garde à jour." },
  { titre: 'Des plats toujours à jour', texte: 'Chaque jour, confirmez en un geste ce qui est disponible : les clients voient un menu fiable.' },
];

/** Clé locale : la visite a déjà été vue sur cet appareil (valeur non secrète). */
export const CLE_VISITE_VUE = 'speedfood.visite.vue.v1';

/** La visite automatique ne se propose qu'une fois : jamais vue = on la propose. */
export function doitProposerVisite(vue: boolean): boolean { return !vue; }

/** Étape suivante : avance d'une page, ou termine sur la dernière (jamais hors bornes). */
export function etapeSuivante(page: number, total: number): { page: number; terminee: boolean } {
  const derniere = Math.max(0, total - 1);
  const actuelle = Math.min(Math.max(0, page), derniere);
  return actuelle >= derniere ? { page: derniere, terminee: true } : { page: actuelle + 1, terminee: false };
}
