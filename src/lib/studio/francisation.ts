import { entreeRegistre } from "./registre";

/**
 * Francisation de l'éditeur visuel (Puck 0.23, palier 3, tâche 7). Module PUR.
 *
 * Puck expose un dictionnaire (`dictionary`) qui couvre chacune des chaînes écrites en dur dans son interface (liste lue
 * dans `defaultDictionary`, `dist/index-*.d.mts` du paquet). On les traduit TOUTES, même celles que l'éditeur n'affiche
 * pas aujourd'hui (texte riche, champs externes) : une évolution de nos blocs ne fera pas réapparaître d'anglais.
 * Le test `editeur.test.mts` vérifie qu'aucune clé de Puck n'est oubliée et qu'aucune traduction n'est anglaise.
 */
export const DICTIONNAIRE_PUCK = {
  "header-publish": "Publier",
  "header-undo": "Annuler (Ctrl+Z)",
  "header-redo": "Rétablir (Ctrl+Maj+Z)",
  "header-toggle-leftsidebar": "Afficher ou masquer le panneau de gauche",
  "header-toggle-rightsidebar": "Afficher ou masquer le panneau de droite",
  "header-toggle-menubar": "Afficher ou masquer le menu",
  "action-selectparent": "Sélectionner le bloc parent",
  "action-duplicate": "Dupliquer",
  "action-delete": "Supprimer",
  "label-page": "Réglages de la page",
  "label-component": "Bloc",
  "outline-empty": "Aucun bloc",
  "outline-item-collapse": "Replier",
  "outline-item-expand": "Déplier",
  "outline-header-title": "Plan de la page",
  "outline-header-collapseall": "Tout replier",
  "outline-item-duplicate": "Dupliquer",
  "outline-item-delete": "Supprimer",
  "drawer-category-collapse": "Replier la famille {title}",
  "drawer-category-expand": "Déplier la famille {title}",
  "drawer-category-other": "Autres blocs",
  "canvas-noconfig": "Bloc inconnu : {type}. Supprimez-le depuis « Blocs de la page ».",
  "field-readonly": "Lecture seule",
  "field-arrayitem-summary": "Élément n° {index}",
  "field-arrayitem-duplicate": "Dupliquer",
  "field-arrayitem-delete": "Supprimer",
  "field-external-selectdata": "Choisir une donnée",
  "field-external-search": "Rechercher",
  "field-external-togglefilters": "Afficher ou masquer les filtres",
  "field-external-item": "Élément",
  "field-external-result-singular": "{count} résultat",
  "field-external-result-plural": "{count} résultats",
  "field-richtext-bold": "Gras",
  "field-richtext-italic": "Italique",
  "field-richtext-underline": "Souligné",
  "field-richtext-strikethrough": "Barré",
  "field-richtext-blockquote": "Citation",
  "field-richtext-code-inline": "Code dans le texte",
  "field-richtext-code-block": "Bloc de code",
  "field-richtext-list-bullet": "Liste à puces",
  "field-richtext-list-ordered": "Liste numérotée",
  "field-richtext-horizontalrule": "Trait horizontal",
  "field-richtext-align-left": "Aligner à gauche",
  "field-richtext-align-center": "Centrer",
  "field-richtext-align-right": "Aligner à droite",
  "field-richtext-align-justify": "Justifier",
  "field-richtext-select": "Choisir",
  "field-richtext-headingselect-1": "Titre 1",
  "field-richtext-headingselect-2": "Titre 2",
  "field-richtext-headingselect-3": "Titre 3",
  "field-richtext-headingselect-4": "Titre 4",
  "field-richtext-headingselect-5": "Titre 5",
  "field-richtext-headingselect-6": "Titre 6",
  "field-richtext-alignselect-left": "À gauche",
  "field-richtext-alignselect-center": "Centré",
  "field-richtext-alignselect-right": "À droite",
  "field-richtext-alignselect-justify": "Justifié",
  "field-richtext-listselect-bullet": "Liste à puces",
  "field-richtext-listselect-ordered": "Liste numérotée",
  "viewport-zoom-in": "Agrandir l'aperçu",
  "viewport-zoom-out": "Réduire l'aperçu",
  "viewport-zoom-auto": "{zoom} % (automatique)",
  "viewport-toggle-menu": "Afficher ou masquer les tailles d'écran",
  "viewport-switch": "Aperçu sur {label}",
  "viewport-switch-default": "Changer la taille de l'aperçu",
  "plugin-blocks": "Blocs",
  "plugin-outline": "Plan de la page",
  "plugin-fields": "Réglages",
  "plugin-components": "Blocs à ajouter",
  "layout-maximize": "Agrandir",
  "layout-minimize": "Réduire",
  "loader-loading": "Chargement",
} as const;

/** Tailles de l'aperçu (sélecteur de l'éditeur). */
export const TAILLES_APERCU = [
  { code: "mobile", libelle: "Mobile", largeur: 390 },
  { code: "tablette", libelle: "Tablette", largeur: 768 },
  { code: "bureau", libelle: "Bureau", largeur: 1280 },
] as const;

/** Titre de l'iframe d'aperçu de Puck (Puck n'en met pas : posé par l'éditeur). */
export const TITRE_APERCU = "Aperçu de la page";

/**
 * Chaînes anglaises connues de l'interface de Puck (dictionnaire par défaut, tailles d'écran, champ racine par défaut).
 * Recherchées comme MOTS entiers, sans tenir compte de la casse. Les mots qui existent aussi en français (« Page », « Large »…)
 * n'y sont pas : ils ne prouvent rien.
 */
export const CHAINES_ANGLAISES = [
  "Publish",
  "undo",
  "redo",
  "Toggle",
  "sidebar",
  "Select parent",
  "Duplicate",
  "Delete",
  "Component",
  "No items",
  "Collapse",
  "Expand",
  "Outline",
  "Other",
  "No configuration",
  "Read-only",
  "Item #",
  "Select data",
  "Search",
  "filters",
  "External item",
  "result",
  "results",
  "Bold",
  "Italic",
  "Underline",
  "Strikethrough",
  "Blockquote",
  "Inline code",
  "Code block",
  "Bullet list",
  "Ordered list",
  "Horizontal rule",
  "Align left",
  "Align center",
  "Align right",
  "Justify",
  "Heading",
  "Zoom",
  "viewport",
  "Switch to",
  "Blocks",
  "Fields",
  "Components",
  "maximize",
  "minimize",
  "loading",
  "Small",
  "Medium",
  "Full-width",
  "title",
] as const;

function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MOTIFS = CHAINES_ANGLAISES.map((chaine) => ({
  chaine,
  // Bornes de mot « à la main » : \b ignore les lettres accentuées.
  motif: new RegExp(`(^|[^\\p{L}\\p{N}_])${echapper(chaine)}(?=$|[^\\p{L}\\p{N}_])`, "iu"),
}));

/** Chaînes anglaises connues présentes dans des textes (texte visible, `aria-label`, `title`, `alt`…), sans doublon. */
export function trouverChainesAnglaises(textes: readonly string[]): string[] {
  const trouvees = new Set<string>();
  for (const texte of textes) {
    for (const { chaine, motif } of MOTIFS) {
      if (motif.test(texte)) trouvees.add(chaine);
    }
  }
  return [...trouvees];
}

// --- Glisser-déposer (dnd-kit, utilisé par Puck sans option de traduction) ------------------------------------------------
// dnd-kit pose sur chaque élément déplaçable `aria-roledescription="draggable"`, une consigne cachée (lue par les lecteurs
// d'écran via aria-describedby) qui décrit un déplacement au clavier que Puck N'offre PAS, et des annonces en anglais.
// L'éditeur les remplace dans la page et dans l'iframe (voir Habillage.tsx) par les textes ci-dessous.

export const ROLE_GLISSER = "bloc déplaçable à la souris";

export const CONSIGNE_GLISSER =
  "Déplacement à la souris seulement. Au clavier, utilisez le panneau « Blocs de la page » : boutons Monter, Descendre, Dupliquer et Supprimer.";

/** Libellé d'un bloc à partir d'un identifiant de Puck (`Titre-<uuid>`), ou « bloc » s'il n'est pas reconnu. */
export function libelleDepuisIdentifiant(identifiant: string): string {
  const type = /^([A-Za-z]+)-/.exec(identifiant)?.[1] ?? "";
  const entree = entreeRegistre(type);
  return entree ? `bloc ${entree.libelle}` : "bloc";
}

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

const ANNONCES: [RegExp, (bloc: string) => string][] = [
  [/^Picked up draggable item (\S+?)\.?$/, (b) => `${majuscule(b)} saisi.`],
  [/^Draggable item (\S+) was moved over droppable target .+$/, (b) => `${majuscule(b)} au-dessus d'une zone de dépôt.`],
  [/^Draggable item (\S+) is no longer over a droppable target\.?$/, (b) => `${majuscule(b)} hors de toute zone de dépôt.`],
  [/^Dragging was cancelled\. Draggable item (\S+?) was dropped\.?$/, (b) => `Déplacement annulé : ${b} relâché.`],
  [/^Draggable item (\S+) was dropped over droppable target .+$/, (b) => `${majuscule(b)} déposé.`],
  [/^Draggable item (\S+?) was dropped\.?$/, (b) => `${majuscule(b)} relâché.`],
];

/** Annonce de dnd-kit -> français. Une annonce anglaise inconnue devient vide (jamais d'anglais lu). Idempotente. */
export function traduireAnnonceGlisser(texte: string): string {
  for (const [motif, traduction] of ANNONCES) {
    const m = motif.exec(texte.trim());
    if (m) return traduction(libelleDepuisIdentifiant(m[1]));
  }
  return trouverChainesAnglaises([texte]).length > 0 || /\b(item|draggable|droppable|dropped|target)\b/i.test(texte) ? "" : texte;
}
