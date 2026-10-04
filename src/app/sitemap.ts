import type { MetadataRoute } from "next";
import { creerClientPublic } from "@/lib/db/public";
import { origineDuSite } from "@/lib/partage/origine";

/**
 * Plan du site : pages publiques fixes + une entrée par restaurant publié. La base ne renvoie déjà
 * que les restaurants publiés et non suspendus (RLS) : un restaurant caché n'apparaît jamais ici.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origine = await origineDuSite();
  const { data } = await creerClientPublic().from("restaurants").select("id, mis_a_jour_le").limit(1000);
  return [
    { url: `${origine}/restaurants`, changeFrequency: "daily", priority: 1 },
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
