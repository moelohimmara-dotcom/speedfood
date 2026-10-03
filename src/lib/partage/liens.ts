/**
 * Liens de partage (SPEC-PILOTE section 3.5), SANS dépendance (testable seul).
 *
 * Règles de produit :
 * - « Partager sur WhatsApp » ouvre WhatsApp avec un texte prérempli ; la personne choisit le
 *   destinataire et envoie elle-même. Speedfood n'envoie rien, ne prétend jamais avoir envoyé
 *   un message et ne connaît aucun numéro (lien \`wa.me\` sans numéro).
 * - Le message cite Speedfood et mène à la page Speedfood ; il n'annonce ni commande, ni prix
 *   confirmé, ni disponibilité garantie.
 * - Un lien de partage ne contient jamais de donnée personnelle : seulement l'identifiant public
 *   d'un restaurant ou d'un plat.
 */

const URL_WHATSAPP = "https://wa.me/";

/** Chemin public d'un restaurant, avec ancre vers un plat si fourni. */
export function cheminRestaurant(restaurantId: string, platId?: string): string {
  return `/restaurants/${restaurantId}${platId ? `#plat-${platId}` : ""}`;
}

/** Lien WhatsApp avec texte prérempli (aucun destinataire : la personne le choisit). */
export function lienWhatsApp(texte: string): string {
  return `${URL_WHATSAPP}?text=${encodeURIComponent(texte)}`;
}

/** Texte d'invitation pour un restaurant. */
export function texteRestaurant(nomRestaurant: string, url: string): string {
  return `Découvre ${nomRestaurant} sur Speedfood : ${url}`;
}

/** Texte d'invitation pour un plat (ne promet pas qu'il est disponible). */
export function textePlat(nomPlat: string, nomRestaurant: string, url: string): string {
  return `${nomPlat} chez ${nomRestaurant}, à voir sur Speedfood : ${url}`;
}

/** Adresse absolue à partir de l'origine du site (sans barre finale) et d'un chemin. */
export function urlAbsolue(origine: string, chemin: string): string {
  return `${origine.replace(/\/+$/, "")}${chemin}`;
}
