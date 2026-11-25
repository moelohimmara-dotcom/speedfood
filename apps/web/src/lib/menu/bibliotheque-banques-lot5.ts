import type { PhotoDeBibliotheque } from "./bibliotheque-photos";

/**
 * Photos de Wikimedia Commons (licences CC0, domaine public, CC BY, CC BY-SA), lot 5 : plats locaux, suite du lot 4.
 * Les photos sous CC BY ou CC BY-SA exigent un crédit (auteur, licence, lien) sur la page de crédits publique.
 * Fichier produit à partir du manifeste de images-banques/wikimedia-lot5.
 */
export const BIBLIOTHEQUE_BANQUES_LOT5: readonly PhotoDeBibliotheque[] = [
  { id: "wk5-001", type: "soupe-haricots-fume", source: "banque", fichier: "wikimedia-lot5/soupe-haricots-fume-001.jpg", licence: "CC0", auteur: "Korinna", page: "https://commons.wikimedia.org/wiki/File:Ciorba_de_fasole_cu_afumatora_IMG_20260707_163453.jpg" },
  { id: "wk5-002", type: "soupe-haricots-fume", source: "banque", fichier: "wikimedia-lot5/soupe-haricots-fume-002.jpg", licence: "CC0", auteur: "Korinna", page: "https://commons.wikimedia.org/wiki/File:Ciorba_de_fasole_cu_afumatora_IMG_20260707_163457.jpg" },
  { id: "wk5-003", type: "creme-semoule", source: "banque", fichier: "wikimedia-lot5/creme-semoule-003.jpg", licence: "CC BY-SA 3.0", auteur: "Alice Wiegand", page: "https://commons.wikimedia.org/wiki/File:Griessbrei.jpg" },
  { id: "wk5-004", type: "chips-plantain", source: "banque", fichier: "wikimedia-lot5/chips-plantain-004.jpg", licence: "CC BY-SA 4.0", auteur: "Adoscam", page: "https://commons.wikimedia.org/wiki/File:Chips_de_bananes_plantain_dans_des_feuilles_de_bananes.jpg" },
  { id: "wk5-005", type: "salade-boeuf", source: "banque", fichier: "wikimedia-lot5/salade-boeuf-005.jpg", licence: "CC BY-SA 4.0", auteur: "Sacha47", page: "https://commons.wikimedia.org/wiki/File:Salata_de_boeuf2.png" },
];
