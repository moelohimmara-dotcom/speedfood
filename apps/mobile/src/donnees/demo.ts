export interface Restaurant {
  id: string; nom: string; zone: string; cuisine: string; description: string;
  illustration: 'bol' | 'grillade' | 'jus'; demonstration: true;
}
export interface Plat {
  id: string; restaurantId: string; nom: string; description: string;
  prixGnf: number; disponible: boolean; illustration: Restaurant['illustration'];
}
// Catalogue entièrement fictif, embarqué : aucun restaurant ni prix de production.
export const restaurants: Restaurant[] = [
  { id: 'marmite-demo', nom: 'La Marmite', zone: 'Kipé', cuisine: 'Cuisine guinéenne', description: 'Les saveurs qui rassemblent. Riz, sauces et bons petits plats.', illustration: 'bol', demonstration: true },
  { id: 'braise-demo', nom: 'Le Coin des Grillades', zone: 'Nongo', cuisine: 'Grillades', description: 'Une braise douce, des épices et une envie de partager.', illustration: 'grillade', demonstration: true },
  { id: 'saveurs-demo', nom: 'Atelier Saveurs', zone: 'Kipé', cuisine: 'Boissons et douceurs', description: 'Des pauses fruitées et de petites douceurs à découvrir.', illustration: 'jus', demonstration: true },
];
export const plats: Plat[] = [
  { id: 'riz-demo', restaurantId: 'marmite-demo', nom: 'Riz sauce arachide', description: 'Riz, sauce onctueuse et légumes. Illustration de démonstration.', prixGnf: 35000, disponible: true, illustration: 'bol' },
  { id: 'poulet-demo', restaurantId: 'marmite-demo', nom: 'Poulet aux épices', description: 'Poulet, riz et légumes de saison. Illustration de démonstration.', prixGnf: 55000, disponible: true, illustration: 'grillade' },
  { id: 'poisson-demo', restaurantId: 'marmite-demo', nom: 'Poisson du jour', description: 'Indisponible dans ce scénario de démonstration.', prixGnf: 65000, disponible: false, illustration: 'grillade' },
  { id: 'brochettes-demo', restaurantId: 'braise-demo', nom: 'Brochettes de poulet', description: 'Brochettes, oignons et accompagnement. Illustration de démonstration.', prixGnf: 45000, disponible: true, illustration: 'grillade' },
  { id: 'bissap-demo', restaurantId: 'saveurs-demo', nom: 'Bissap maison', description: 'Une pause à l’hibiscus. Illustration de démonstration.', prixGnf: 15000, disponible: true, illustration: 'jus' },
];
