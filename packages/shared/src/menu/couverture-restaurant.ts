import { normaliserNom } from "./types-plats";

/**
 * Photo de couverture d'une carte de restaurant : on montre UN plat du restaurant, jamais une boisson, un alcool, un dessert, une entrée ou un accompagnement
 * (constaté le 26/11/2026 : en prenant « le premier plat avec photo », la carte d'un burger montrait du cognac). Fonction pure, sans réseau ni base.
 *
 * Règle : parmi les plats AVEC photo, on écarte ceux d'une section de boissons, d'alcools, de desserts, d'entrées ou d'accompagnements, et ceux dont le nom est une boisson ;
 * on garde le plus cher (un plat principal ou un plateau coûte plus qu'un en-cas), à prix égal le plus petit identifiant. Aucun plat admissible : pas de couverture
 * (la carte garde son logo ou son initiale) plutôt qu'une mauvaise image.
 */
export interface PlatCouverture {
  restaurantId: string;
  id: string;
  nom: string;
  prix: number;
  photoUrl: string;
  /** Nom de la section du menu, `null` quand le plat n'en a pas. */
  section: string | null;
}

const SECTION_A_ECARTER = /\b(boissons?|jus|sodas?|eaux?|mocktails?|cocktails?|vins?|bieres?|spiritueux|digestifs?|alcools?|desserts?|patisseries?|entrees?|accompagnements?|en cas|supplements?|pains?)\b/;
const NOM_A_ECARTER = /^(boisson|jus|eau|eaux|soda|vin|biere|cafe|the|lait|smoothie|mocktail|cocktail|limonade|mojito|margarita|pina colada|cognac|whisky|rhum|vodka|gin|tequila|champagne|cidre|liqueur|punch|dessert|gateau|glace|patisserie|supplement)\b|\b(energisante|isotonique|sans alcool)\b/;

/** Vrai quand ce plat ne doit pas servir de vitrine à son restaurant. */
export function ecarterPourCouverture(plat: Pick<PlatCouverture, "nom" | "section">): boolean {
  if (plat.section && SECTION_A_ECARTER.test(normaliserNom(plat.section))) return true;
  return NOM_A_ECARTER.test(normaliserNom(plat.nom));
}

/** Identifiant du restaurant → adresse de la photo choisie. Les restaurants sans plat admissible n'y figurent pas. */
export function choisirCouvertures(plats: readonly PlatCouverture[]): Map<string, string> {
  const choisis = new Map<string, PlatCouverture>();
  for (const p of plats) {
    if (!p.photoUrl || ecarterPourCouverture(p)) continue;
    const actuel = choisis.get(p.restaurantId);
    if (!actuel || p.prix > actuel.prix || (p.prix === actuel.prix && p.id < actuel.id)) choisis.set(p.restaurantId, p);
  }
  return new Map([...choisis].map(([restaurantId, p]) => [restaurantId, p.photoUrl]));
}
