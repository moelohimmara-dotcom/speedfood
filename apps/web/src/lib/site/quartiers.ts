/** Identifiant d'URL d'un quartier : sans accent, en minuscules, séparé par des tirets (« Kaloum » -> « kaloum »). */
export function slugQuartier(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
