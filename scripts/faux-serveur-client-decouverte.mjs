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
export const routes = {
  "rest/restaurants": async () => RESTAURANTS,
};
