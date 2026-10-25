// Faux serveur client — découverte : restaurants d'essai répartis dans plusieurs quartiers (pour jouer le choix de zone et les sections de l'accueil).
// Remplace la lecture publique `/rest/v1/restaurants` (sinon relayée vers la vraie base, qui ne compte qu'un restaurant). Données factices uniquement.
export const espace = "client";
const maintenant = new Date().toISOString();
const R = (n, nom, quartier, categorie, ouvert, somme, total) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  nom,
  horaires: "Tous les jours : 9h00–22h00",
  ouvert,
  accepte_commandes: ouvert,
  statut_mis_a_jour_le: maintenant,
  photo_url: null,
  logo_url: null,
  couleur_accent: null,
  code_court: null,
  avis_somme: somme,
  avis_total: total,
  quartier: { nom: quartier },
  categorie: { nom: categorie },
});
const RESTAURANTS = [
  R(1, "Chez Awa", "Kipé", "Grillades", true, 46, 10),
  R(2, "Le Fouta", "Kipé", "Cuisine guinéenne", true, 38, 9),
  R(3, "Maquis du Port", "Kaloum", "Poissons", false, 0, 0),
  R(4, "Boulangerie Soleil", "Kaloum", "Pâtisserie", true, 22, 5),
  R(5, "Chez Mariama", "Matam", "Cuisine guinéenne", true, 43, 10),
  R(6, "Pizza Conakry", "Kipé", "Pizzas", true, 30, 8),
];
// Menus d'essai : Chez Awa a des plats frais, périmés et épuisés ; Le Fouta n'a que des plats périmés ; les autres restaurants n'ont pas de menu (état vide).
const il_y_a = (heures) => new Date(Date.now() - heures * 3600_000).toISOString();
const P = (n, restaurant, nom, prix, confirmeIlYA, disponible = true, promo = null) => ({
  id: `00000000-0000-4000-9000-0000000000${n}`,
  restaurant_id: `00000000-0000-4000-8000-00000000000${restaurant}`,
  nom,
  description: "",
  prix,
  prix_promo: promo,
  disponible,
  disponibilite_confirmee_le: confirmeIlYA == null ? null : il_y_a(confirmeIlYA),
  photo_url: null,
  section_id: null,
  archive_le: null,
  menu_item_options: [],
});
const PLATS = [
  P(11, 1, "Poulet braisé", 40000, 0.2),
  P(12, 1, "Riz sauce feuille", 25000, 0.2, true, 20000),
  P(13, 1, "Brochettes de bœuf", 30000, 50),
  P(14, 1, "Jus de bissap", 8000, 0.2, false),
  P(21, 2, "Riz gras", 28000, 72),
  P(22, 2, "Sauce arachide", 26000, null),
];
export const routes = {
  "rest/restaurants": async () => RESTAURANTS,
  "rest/menu_sections": async () => [],
  "rest/menu_items": async ({ url }) => {
    const id = (url.searchParams.get("restaurant_id") ?? "").replace("eq.", "");
    return PLATS.filter((p) => p.restaurant_id === id);
  },
};
