import type { PhotoDeBibliotheque } from "./bibliotheque-photos";
import { creditObligatoire } from "./plan-photos-demo";

/**
 * Crédits des photos de la bibliothèque, pour la page publique `/credits-photos` (fonction pure, sans réseau ni base).
 * Les photos sous CC BY et CC BY-SA exigent le nom de l'auteur, la licence et un lien : elles sont toutes listées (même celles pas encore
 * rattachées à un plat, par prudence). Pexels, Pixabay, CC0 et domaine public n'exigent rien ; les images générées par IA sont signalées à part.
 */
export interface LigneCredit {
  photoId: string;
  /** Libellé lisible du plat représenté (« Rfissa », « Poulet yassa »). */
  plat: string;
  auteur: string;
  licence: string;
  /** Adresse de la licence (Creative Commons), `null` si inconnue. */
  urlLicence: string | null;
  /** Page d'origine de la photo (fiche Wikimedia Commons). */
  page: string | null;
}

export interface CreditsPhotos {
  obligatoires: LigneCredit[];
  /** Photos de banques libres de droits sans crédit obligatoire, comptées par source (« Pexels », « Pixabay », « Domaine public ou CC0 »). */
  libres: { source: string; nombre: number }[];
  /** Nombre d'images générées par IA (« images illustratives »). */
  imagesIa: number;
}

/** Les types de plat s'écrivent sans accents (« creme-caramel ») : on rend leur accent ou leur majuscule aux mots courants. */
const MOTS_AFFICHES: Readonly<Record<string, string>> = {
  creme: "crème",
  flambee: "flambée",
  nicoise: "niçoise",
  eclair: "éclair",
  the: "thé",
  gateau: "gâteau",
  kedjenou: "kédjenou",
  dg: "DG",
  pates: "pâtes",
  cafe: "café",
  boeuf: "bœuf",
  oeuf: "œuf",
  oeufs: "œufs",
  legumes: "légumes",
  epice: "épicé",
  grille: "grillé",
  braise: "braisé",
  sale: "salé",
};

/** « salade-chou » → « Salade chou », « poulet-dg » → « Poulet DG », « creme-caramel » → « Crème caramel » : libellé d'un type de plat. */
export function libelleDuType(type: string): string {
  const mots = type
    .split("-")
    .filter(Boolean)
    .map((m) => MOTS_AFFICHES[m] ?? m);
  const texte = mots.join(" ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Adresse officielle d'une licence Creative Commons (« CC BY-SA 4.0 », « CC BY 2.0 », « CC0 »), `null` pour toute autre licence. */
export function urlLicence(licence: string): string | null {
  const l = licence.trim();
  const cc = /^CC (BY|BY-SA) (\d\.\d)$/i.exec(l);
  if (cc) return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
  if (/^CC0/i.test(l)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  return null;
}

function sourceLibre(photo: PhotoDeBibliotheque): string {
  const licence = photo.licence ?? "";
  if (/^Pexels/i.test(licence)) return "Pexels";
  if (/^Pixabay/i.test(licence)) return "Pixabay";
  return "Domaine public ou CC0";
}

export function construireCredits(bibliotheque: readonly PhotoDeBibliotheque[]): CreditsPhotos {
  const obligatoires: LigneCredit[] = [];
  const libres = new Map<string, number>();
  let imagesIa = 0;
  for (const photo of bibliotheque) {
    if (photo.source === "ia") {
      imagesIa++;
      continue;
    }
    if (creditObligatoire(photo.licence)) {
      obligatoires.push({
        photoId: photo.id,
        plat: libelleDuType(photo.type),
        auteur: (photo.auteur ?? "").trim() || "Auteur non indiqué",
        licence: photo.licence as string,
        urlLicence: urlLicence(photo.licence as string),
        page: photo.page ?? null,
      });
    } else {
      const source = sourceLibre(photo);
      libres.set(source, (libres.get(source) ?? 0) + 1);
    }
  }
  obligatoires.sort((a, b) => a.auteur.localeCompare(b.auteur, "fr") || a.plat.localeCompare(b.plat, "fr") || a.photoId.localeCompare(b.photoId));
  return { obligatoires, libres: [...libres].map(([source, nombre]) => ({ source, nombre })).sort((a, b) => b.nombre - a.nombre), imagesIa };
}
