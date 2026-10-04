import type { MetadataRoute } from "next";
import { creerClientPublic } from "@/lib/db/public";
import { origineDuSite } from "@/lib/partage/origine";
import { slugQuartier } from "@/lib/site/quartiers";

/**
 * Plan du site : pages publiques fixes + une entrée par restaurant publié. La base ne renvoie déjà
 * que les restaurants publiés et non suspendus (RLS) : un restaurant caché n'apparaît jamais ici.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origine = await origineDuSite();
  const { data } = await creerClientPublic().from("restaurants").select("id, mis_a_jour_le, neighborhoods(nom)").limit(1000);
  const quartiers = [...new Set((data ?? []).map((r) => r.neighborhoods?.nom).filter((n): n is string => !!n))];
  return [
    { url: `${origine}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origine}/restaurants`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origine}/comment-ca-marche`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origine}/quartiers`, changeFrequency: "weekly", priority: 0.6 },
    ...quartiers.map((nom) => ({ url: `${origine}/quartiers/${slugQuartier(nom)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${origine}/aide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origine}/devenir-partenaire`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origine}/a-propos`, changeFrequency: "monthly", priority: 0.4 },
    ...(data ?? []).map((restaurant) => ({
      url: `${origine}/restaurants/${restaurant.id}`,
      lastModified: restaurant.mis_a_jour_le,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
