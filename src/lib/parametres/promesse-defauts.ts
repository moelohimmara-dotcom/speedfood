/**
 * Textes de promesse de l'accueil (lot G), par défaut. Rédigés selon les principes d'Ogilvy (bénéfice précis, faits) et de
 * Bencivenga (une promesse crédible porte sa preuve) : chaque plat affiche réellement l'heure de sa confirmation.
 * Modifiables depuis `/system/parametres` ; un champ vide revient à ces valeurs.
 */
export interface Promesse {
  /** Petit titre au-dessus de l'accroche de l'accueil. */
  signature: string;
  /** Sous-titre de l'accueil, qui explique le fonctionnement. */
  sousTitre: string;
  /** Description des aperçus de partage (WhatsApp, réseaux) et des moteurs de recherche. */
  partage: string;
}

export const PROMESSE_PAR_DEFAUT: Promesse = {
  signature: "Mangez près de chez vous, à Conakry",
  sousTitre: "Fini d'appeler cinq restaurants pour savoir s'il reste du plat. Voyez ce qui est disponible, commandez en quelques gestes, suivez votre commande en direct et réglez directement au restaurant.",
  partage:
    "Trouvez à manger près de chez vous, à Conakry : chaque plat affiche l'heure de confirmation du restaurant. Commande suivie en direct, règlement au restaurant.",
};

/** Remplace chaque texte absent ou vide par sa valeur par défaut. */
export function fusionnerPromesse(saisie: { [cle in keyof Promesse]?: string | null }): Promesse {
  const choisir = (valeur: string | null | undefined, defaut: string) => (valeur && valeur.trim() ? valeur.trim() : defaut);
  return {
    signature: choisir(saisie.signature, PROMESSE_PAR_DEFAUT.signature),
    sousTitre: choisir(saisie.sousTitre, PROMESSE_PAR_DEFAUT.sousTitre),
    partage: choisir(saisie.partage, PROMESSE_PAR_DEFAUT.partage),
  };
}
