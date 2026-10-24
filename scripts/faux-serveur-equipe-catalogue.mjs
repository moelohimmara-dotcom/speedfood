// Routes factices L8 : aucune base réelle, données uniquement en mémoire.
export const espace = "equipe";
const restaurants = [{ id: "demo-source", nom: "Chez Démo Source" }, { id: "demo-destination", nom: "Chez Démo Destination" }];
const plats = [{ id: "plat-demo-1", restaurantId: "demo-source", nom: "Poulet rôti", prix: 25000 }, { id: "plat-demo-2", restaurantId: "demo-source", nom: "Riz sauce arachide", prix: 18000 }];
export const routes = {
  "/catalogue/menus": async () => ({ ok: true, restaurants, plats, csv: "nom;description;prix;prix_promo\nPoulet rôti;Essai;25000;20000\nSans prix;;" }),
  "/catalogue/menus/apercu": async ({ body = {} } = {}) => ({ ok: true, operation: body.operation ?? "import", lignes: 2, rejetees: 1, empreinte: "demo-l8" }),
  "/catalogue/menus/appliquer": async ({ body = {} } = {}) => ({ ok: true, message: `${body.operation ?? "import"} appliqué en mode démonstration`, audit: true }),
};
