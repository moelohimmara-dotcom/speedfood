/**
 * Adresse de livraison à Conakry, SANS dépendance (testable seul).
 *
 * Beaucoup de rues n'ont ni nom ni numéro : on se repère à un lieu connu (pharmacie, mosquée, carrefour, marché). Le formulaire demande donc un « repère »
 * et, facultativement, des « précisions » (portail, étage, nom sur la porte) ; ces deux champs sont COMPOSÉS en une seule ligne, car le serveur, la console du
 * restaurant et l'écran du livreur manipulent une adresse unique de 5 à 300 caractères (aucune colonne ajoutée). Quand le client a partagé sa position, le repère
 * devient facultatif : le point GPS situe déjà la livraison.
 */
export const REPERE_MIN = 3;
export const REPERE_MAX = 150;
export const PRECISIONS_MAX = 120;
/** Longueur maximale acceptée par le serveur pour l'adresse de livraison. */
export const ADRESSE_LIVRAISON_MAX = 300;
/** Texte envoyé quand le client a partagé sa position et n'a rien écrit d'autre. */
export const ADRESSE_POSITION_SEULE = "Position partagée sur la carte";
/** Dit au client, AVANT qu'il partage sa position, où elle va : elle part avec la commande (contrairement à la carte de suivi de l'appli, où elle reste sur le téléphone). */
export const TEXTE_PARTAGE_POSITION = "Votre position est envoyée à Speedfood, au restaurant et au livreur, pour cette commande seulement. Elle sert à vous trouver, pas à vous suivre.";
export const EXEMPLE_REPERE = "en face de la pharmacie, derrière la mosquée, près du carrefour";

export interface SaisieAdresse {
  repere: string;
  precisions: string;
  /** Vrai si une position a été partagée : le repère n'est plus obligatoire. */
  position: boolean;
}

export interface ErreursAdresse {
  repere?: string;
  precisions?: string;
}

export type ResultatAdresse = { adresse: string; erreurs: Record<string, never> } | { adresse: null; erreurs: ErreursAdresse };

/** Espaces multiples réduits, bords rognés, point final retiré (le point sert de séparateur entre les deux parties). */
export function nettoyerSaisie(texte: string): string {
  return String(texte ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
}

/**
 * Compose l'adresse envoyée au serveur, ou dit ce qui manque.
 * Au plus 9 + 150 + 2 + 13 + 120 = 294 caractères : toujours sous la limite de 300 du serveur.
 */
export function composerAdresse(saisie: SaisieAdresse): ResultatAdresse {
  const repere = nettoyerSaisie(saisie.repere);
  const precisions = nettoyerSaisie(saisie.precisions);
  const erreurs: ErreursAdresse = {};
  if (repere === "" && !saisie.position) {
    erreurs.repere = `Indiquez un repère connu près de chez vous (par exemple : ${EXEMPLE_REPERE}).`;
  } else if (repere !== "" && repere.length < REPERE_MIN) {
    erreurs.repere = `Le repère est trop court (${REPERE_MIN} caractères au moins).`;
  } else if (repere.length > REPERE_MAX) {
    erreurs.repere = `Le repère est trop long (${REPERE_MAX} caractères au plus).`;
  }
  if (precisions.length > PRECISIONS_MAX) erreurs.precisions = `Les précisions sont trop longues (${PRECISIONS_MAX} caractères au plus).`;
  if (erreurs.repere || erreurs.precisions) return { adresse: null, erreurs };

  const parties: string[] = [];
  if (repere !== "") parties.push(`Repère : ${repere}`);
  if (precisions !== "") parties.push(`Précisions : ${precisions}`);
  if (parties.length === 0) return { adresse: ADRESSE_POSITION_SEULE, erreurs: {} };
  return { adresse: parties.join(". "), erreurs: {} };
}
