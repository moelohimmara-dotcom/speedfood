// Données de démonstration — fictives, à remplacer par les vraies données du marché de lancement.
// Aucune de ces valeurs ne doit être copiée telle quelle en production (cf. README).

const SEED_RESTAURANTS = [
  {
    id: "r1",
    nom: "Chez Mama Kadiatou",
    categorie: "Riz & sauces",
    quartier: "Kaloum",
    couleur: "#D9362B",
    emoji: "🍛",
    note: 4.7,
    tempsPreparation: "20–30 min",
    ouvert: true,
    horaires: "Lun–Sam, 11h30 – 21h00",
    consignes: "Appeler avant retrait après 20h.",
    menu: [
      { id: "i1", nom: "Riz gras au poisson", description: "Riz gras, poisson braisé, légumes de saison", prix: 35000, disponible: true },
      { id: "i2", nom: "Sauce feuille + riz blanc", description: "Sauce feuille traditionnelle, portion généreuse", prix: 28000, disponible: true },
      { id: "i3", nom: "Poulet yassa", description: "Poulet mariné, oignons, riz blanc", prix: 40000, disponible: false },
    ],
  },
  {
    id: "r2",
    nom: "Grill Dixinn",
    categorie: "Grillades",
    quartier: "Dixinn",
    couleur: "#FF7A1A",
    emoji: "🔥",
    note: 4.5,
    tempsPreparation: "25–35 min",
    ouvert: true,
    horaires: "Tous les jours, 12h00 – 23h00",
    consignes: "Livraison uniquement dans un rayon de 3 km.",
    menu: [
      { id: "i4", nom: "Brochettes de bœuf (x5)", description: "Servies avec attiéké et piment", prix: 45000, disponible: true },
      { id: "i5", nom: "Poisson braisé entier", description: "Bar braisé, oignons, tomates fraîches", prix: 55000, disponible: true },
      { id: "i6", nom: "Frites maison", description: "Portion à partager", prix: 15000, disponible: true },
    ],
  },
  {
    id: "r3",
    nom: "Speedy Snack",
    categorie: "Fast-food",
    quartier: "Ratoma",
    couleur: "#FFC247",
    emoji: "🍔",
    note: 4.2,
    tempsPreparation: "15–20 min",
    ouvert: false,
    horaires: "Lun–Dim, 10h00 – 22h00",
    consignes: "Fermé exceptionnellement aujourd'hui.",
    menu: [
      { id: "i7", nom: "Burger Speedy", description: "Bœuf, cheddar, sauce maison", prix: 30000, disponible: true },
      { id: "i8", nom: "Sandwich poulet pané", description: "Salade, tomate, mayonnaise", prix: 25000, disponible: true },
    ],
  },
  {
    id: "r4",
    nom: "Café Matam",
    categorie: "Petit-déjeuner",
    quartier: "Matam",
    couleur: "#2B211D",
    emoji: "☕",
    note: 4.8,
    tempsPreparation: "10–15 min",
    ouvert: true,
    horaires: "Tous les jours, 6h30 – 11h00",
    consignes: "Retrait uniquement, pas de livraison le matin.",
    menu: [
      { id: "i9", nom: "Café touba + beignets", description: "3 beignets frais, café épicé", prix: 12000, disponible: true },
      { id: "i10", nom: "Omelette + pain", description: "Omelette 2 œufs, pain frais, thé", prix: 18000, disponible: true },
    ],
  },
];

const CATEGORIES = ["Riz & sauces", "Grillades", "Fast-food", "Petit-déjeuner"];
const QUARTIERS = ["Kaloum", "Dixinn", "Ratoma", "Matam"];

// Couleur pleine et icône SVG (trait arrondi, grille 24x24) associées à chaque catégorie.
// Aplat assumé plutôt qu'un dégradé décoratif — remplace aussi les émojis (interdits comme repère d'interface par le brief).
const CATEGORY_STYLE = {
  "Riz & sauces": {
    couleur: "var(--couleur-riz)",
    icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16c0 4.42-3.58 8-8 8s-8-3.58-8-8Z"/><path d="M12 12V5M9 7l1.5-2M15 7l-1.5-2"/></svg>',
  },
  "Grillades": {
    couleur: "var(--couleur-grill)",
    icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3c1.5 2 2 3.5 1 5-.7 1-1 1.8-1 2.5A2.5 2.5 0 0 0 14.5 13c1.4 0 2.2-.9 2.5-1.8.8 1.2 1 2.6.6 4A5.5 5.5 0 0 1 6.6 14c-.5-2 .2-3.4 1.2-4.6C9.2 7.7 9 5.3 12 3Z"/></svg>',
  },
  "Fast-food": {
    couleur: "var(--couleur-fast)",
    icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 10a8 8 0 0 1 16 0Z"/><path d="M3.5 10h17M4 14h16M5 18h14"/></svg>',
  },
  "Petit-déjeuner": {
    couleur: "var(--couleur-cafe)",
    icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 4c0 1-1 1-1 2M12 4c0 1-1 1-1 2"/></svg>',
  },
};

function categoryStyle(categorie) {
  return CATEGORY_STYLE[categorie] || { couleur: "var(--rouge)", icon: "" };
}

// Icônes d'interface partagées (statuts, bannières, états vides, navigation).
const UI_ICONS = {
  recherche: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  retour: '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  info: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
  vide: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  horloge: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
  paquet: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  croix: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  etoile: '<svg class="icon" viewBox="0 0 24 24"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z"/></svg>',
  minuteur: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  panier: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16l-1.5 12.5A2 2 0 0 1 16.5 20h-9a2 2 0 0 1-2-1.8L4 6Z"/><path d="M4 6l-1-3M9 10v5M15 10v5M8 6a4 4 0 0 1 8 0"/></svg>',
  maison: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
  boutique: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 10v9h16v-9M3 10l2-6h14l2 6M3 10h18M9 19v-5h6v5"/></svg>',
  coeurVide: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20s-7-4.35-9.5-8.8C.9 8.1 2.3 4.8 5.6 4.2c1.9-.35 3.7.5 4.7 2 .3.45.8 1.05 1.7 1.05.9 0 1.4-.6 1.7-1.05 1-1.5 2.8-2.35 4.7-2C21.7 4.8 23.1 8.1 21.5 11.2 19 15.65 12 20 12 20Z"/></svg>',
  coeurPlein: '<svg class="icon" viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><path d="M12 20s-7-4.35-9.5-8.8C.9 8.1 2.3 4.8 5.6 4.2c1.9-.35 3.7.5 4.7 2 .3.45.8 1.05 1.7 1.05.9 0 1.4-.6 1.7-1.05 1-1.5 2.8-2.35 4.7-2C21.7 4.8 23.1 8.1 21.5 11.2 19 15.65 12 20 12 20Z"/></svg>',
  historique: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M8 3l-3 2M16 3l3 2"/></svg>',
};

const FRAIS_LIVRAISON_ESTIME = 10000; // à confirmer par le restaurant, affiché comme non garanti

// À incrémenter à chaque changement de forme des données de démo (nouveaux champs, etc.)
// pour forcer un re-seed chez les personnes qui ont déjà ouvert une version précédente.
const SEED_VERSION = "2";

function seedIfNeeded() {
  const versionActuelle = localStorage.getItem("sf_seed_version");

  if (versionActuelle !== SEED_VERSION) {
    localStorage.setItem("sf_restaurants", JSON.stringify(SEED_RESTAURANTS));
    localStorage.setItem("sf_seed_version", SEED_VERSION);
  }
  if (!localStorage.getItem("sf_orders")) {
    localStorage.setItem("sf_orders", JSON.stringify([]));
  }
  if (!localStorage.getItem("sf_cart")) {
    localStorage.setItem("sf_cart", JSON.stringify({ restaurantId: null, lignes: [] }));
  }
}

function getRestaurants() {
  return JSON.parse(localStorage.getItem("sf_restaurants") || "[]");
}

function saveRestaurants(list) {
  localStorage.setItem("sf_restaurants", JSON.stringify(list));
}

function getOrders() {
  return JSON.parse(localStorage.getItem("sf_orders") || "[]");
}

function saveOrders(list) {
  localStorage.setItem("sf_orders", JSON.stringify(list));
}

function getFavoris() {
  return JSON.parse(localStorage.getItem("sf_favoris") || "[]");
}

function estFavori(restaurantId) {
  return getFavoris().includes(restaurantId);
}

function toggleFavori(restaurantId) {
  const favoris = getFavoris();
  const idx = favoris.indexOf(restaurantId);
  if (idx === -1) favoris.push(restaurantId);
  else favoris.splice(idx, 1);
  localStorage.setItem("sf_favoris", JSON.stringify(favoris));
  return favoris.includes(restaurantId);
}

function getCart() {
  return JSON.parse(localStorage.getItem("sf_cart") || '{"restaurantId":null,"lignes":[]}');
}

function saveCart(cart) {
  localStorage.setItem("sf_cart", JSON.stringify(cart));
}

function formatGNF(n) {
  return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " GNF";
}

function genRef() {
  return "SF-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function genToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
