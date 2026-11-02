/** Clé UNIQUE du jeton d'isolat de l'alerte interne (ADR-021), sans aucune dépendance : importée par l'entrée RPC (`worker-jetons.js`) et par la route. Une clé recopiée à la main perdrait l'alerte en silence. */
export const CLE_JETON_ALERTE = Symbol.for("speedfood.alerte-interne");
