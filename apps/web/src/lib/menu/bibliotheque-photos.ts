import type { PhotoBibliotheque } from "./photos";

/**
 * Bibliothèque des photos de démonstration, par type de plat (clé commune avec `typeDePlat`).
 * Chaque entrée correspond à un fichier contrôlé (voir scripts/controle-photos.mjs et docs/REGLES-MENUS-ET-PHOTOS.md, section 6) :
 * `ia` = image générée (à signaler « image illustrative »), `banque` = photo libre de droits (crédit selon la licence).
 * Une entrée n'est ajoutée qu'après contrôle visuel : en cas de doute, on ne l'ajoute pas (donc aucune photo pour ce plat).
 */
export interface PhotoDeBibliotheque extends PhotoBibliotheque {
  /** Fichier d'origine, relatif au dossier des images de démonstration. */
  fichier: string;
}

const ia = (type: string, fichier = type): PhotoDeBibliotheque => ({ id: `ia-${fichier}`, type, source: "ia", fichier: `lot3/${fichier}.png` });

export const BIBLIOTHEQUE_PHOTOS: readonly PhotoDeBibliotheque[] = [
  // Formules, menus et plateaux (plusieurs éléments)
  ia("formule-grillade"),
  ia("formule-partage-africain"),
  ia("formule-mezze"),
  ia("formule-doner"),
  ia("formule-pates"),
  ia("formule-indien"),
  ia("formule-chinois"),
  ia("formule-sushi"),
  ia("formule-mexicain"),
  ia("formule-grec"),
  ia("formule-marocain"),
  ia("formule-thai"),
  ia("formule-creole"),
  ia("formule-roumain"),
  ia("formule-burger"),
  ia("formule-petitdej"),
  ia("formule-dejeuner"),
  ia("formule-gouter"),
  // Plats
  ia("tajine"),
  ia("riz-poisson"),
  ia("salade-crudites"),
  ia("houmous"),
  ia("kafta"),
  ia("grillade-mixte"),
  ia("baklava"),
  ia("butter-chicken"),
  ia("biryani"),
  ia("salade-tomate-oignon"),
  ia("salade-avocat"),
  ia("salade-concombre"),
  ia("salade-chou"),
  ia("salade-cesar"),
  ia("salade-grecque"),
  ia("falafel"),
  ia("pates-pastry-triangles"),
  ia("poulet-brochette"),
  ia("manakish"),
  ia("pain-plat"),
  ia("lahmacun"),
  ia("pide"),
  ia("iskender"),
];
