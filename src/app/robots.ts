import type { MetadataRoute } from "next";
import { origineDuSite } from "@/lib/partage/origine";

/**
 * Les pages publiques (catalogue, fiches, à propos) sont indexables ; tout ce qui est personnel ou
 * opérationnel (consoles, comptes, panier, commande, suivi par jeton) est écarté des moteurs de recherche.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origine = await origineDuSite();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/restaurant", "/system", "/compte", "/connexion", "/inscription", "/panier", "/commande", "/suivi", "/auth"],
      },
    ],
    sitemap: `${origine}/sitemap.xml`,
  };
}
