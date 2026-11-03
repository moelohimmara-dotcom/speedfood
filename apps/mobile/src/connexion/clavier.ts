/**
 * Logique pure du clavier pour les écrans à formulaire (lot D3b). Aucune dépendance à React Native : testable seule.
 *
 * Problème observé sur l'émulateur Android 14 : l'écran est dans un `Modal` et l'application est en « edge-to-edge » (`edgeToEdgeEnabled=true`, fenêtre principale en `adjustResize`) ;
 * la fenêtre du Modal n'est pas redimensionnée par le clavier et `KeyboardAvoidingView` sans comportement ne fait rien sur Android. Le clavier recouvrait donc le bas du formulaire.
 * Remède : une marge basse égale à la hauteur du clavier dans le contenu défilant (les champs ET les boutons « Continuer » et « Fermer » restent atteignables en défilant) et un défilement
 * vers le champ actif. Si une version d'Android redimensionne quand même la fenêtre, la marge n'est qu'un espace en plus : jamais un champ caché.
 */

/** Espace ajouté sous la dernière ligne, en plus du clavier : laisse voir les boutons sous le dernier champ. */
export const MARGE_SOUS_CLAVIER = 32;
/** Distance entre le haut de l'écran défilant et le haut du champ actif après défilement. */
export const DECALAGE_CHAMP_HAUT = 96;
/** Hauteur maximale crédible d'un clavier (dp) ; au-delà, la valeur est ignorée. */
const HAUTEUR_CLAVIER_MAX = 1200;

/** Marge basse à ajouter au contenu défilant. 0 hors Android (iOS : `KeyboardAvoidingView` en `padding`), clavier fermé, ou valeur illisible. */
export function margeBasseClavier(hauteurClavier: unknown, plateforme: string): number {
  if (plateforme !== 'android') return 0;
  if (typeof hauteurClavier !== 'number' || !Number.isFinite(hauteurClavier) || hauteurClavier <= 0 || hauteurClavier > HAUTEUR_CLAVIER_MAX) return 0;
  return Math.ceil(hauteurClavier) + MARGE_SOUS_CLAVIER;
}

/** Position de défilement qui amène le haut du champ (mesuré dans le contenu) près du haut de l'écran. Jamais négative, jamais NaN. */
export function cibleDefilement(champY: unknown, decalageHaut: number = DECALAGE_CHAMP_HAUT): number {
  if (typeof champY !== 'number' || !Number.isFinite(champY)) return 0;
  return Math.max(0, Math.round(champY - decalageHaut));
}
