import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application installable (lot B). Couleurs = tokens de DESIGN-SYSTEM.md (fond crème, rouge foncé).
 * Les icônes sont générées par `scripts/generer-icones.mjs`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identité stable de l'application installée : sans `id`, le navigateur la déduit de `start_url` et une future modification de celle-ci
    // ferait passer l'application pour une autre (nouvelle installation, ancienne orpheline).
    id: "/",
    name: "Speedfood",
    short_name: "Speedfood",
    description: "Découvrez et commandez chez vos restaurants préférés à Conakry.",
    lang: "fr",
    dir: "ltr",
    categories: ["food", "shopping"],
    // Pas de `orientation` : la console restaurateur sert aussi sur tablette posée au comptoir, dans le sens que le restaurateur choisit.
    prefer_related_applications: false,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff6ed",
    theme_color: "#b82a20",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Commandes à traiter", short_name: "Commandes", url: "/restaurant/commandes" },
      { name: "Restaurants", short_name: "Restaurants", url: "/restaurants" },
    ],
  };
}
