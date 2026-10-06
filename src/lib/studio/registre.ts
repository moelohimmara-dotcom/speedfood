import {
  array,
  boolean,
  discriminatedUnion,
  enum as enumeration,
  literal,
  maxLength,
  minLength,
  optional,
  refine,
  regex,
  strictObject,
  string,
  union,
  type output,
} from "zod/mini";
import type { $ZodIssue, $ZodType } from "zod/v4/core";
import { estLienBanniereSur } from "../auth/redirection";
import { analyserTexteRiche, type Bloc as BlocTexte } from "../cms/texte-riche";
import { schemaReglages } from "./reglages";

/**
 * Registre des blocs des pages du Studio (palier 3) et validation des documents de page. Module PUR (aucun import serveur,
 * aucun import de Puck) : partagé par le serveur (écriture ET lecture), le rendu public et l'éditeur visuel.
 *
 * Une page à blocs est un document JSON au format de Puck (`{ content: [{ type, props }], root: { props } }`) écrit par
 * l'équipe : il n'est JAMAIS rendu sans être validé ici. Schémas stricts (aucune propriété en trop), longueurs bornées,
 * énumérations fermées, liens filtrés par `estLienBanniereSur`, images limitées au stockage Speedfood, aucun HTML (les
 * textes sont rendus en nœuds React). Un document invalide n'est jamais rendu en partie : la page entière est refusée.
 *
 * Contenu imbriqué : le seul bloc qui en porte est « Colonnes » (2 ou 3 colonnes, chacune une liste de blocs SIMPLES).
 * Profondeur maximale 2 (page, colonnes, bloc) : les colonnes ne s'imbriquent pas, les blocs dynamiques n'y entrent pas.
 */

export const MAX_BLOCS_PAGE = 200;
/** Taille maximale du document sérialisé (même borne que les contraintes de la base : 200 Ko). */
export const MAX_OCTETS_PAGE = 204_800;
export const MAX_CARACTERES_PARAGRAPHE = 5_000;
export const MAX_CARACTERES_REPONSE = 2_000;
export const MAX_QUESTIONS_FAQ = 20;
/** Nombre maximal de messages d'erreur renvoyés (une entrée hostile en produirait des milliers). */
const MAX_ERREURS = 10;

// Le caractère NUL est refusé par Postgres dans un jsonb : on le refuse ici avec un message clair.
const sansNul = /^[^\u0000]*$/;
const texte = (max: number, min = 0) =>
  min > 0 ? string().check(maxLength(max), minLength(min), regex(sansNul)) : string().check(maxLength(max), regex(sansNul));

// Identifiant ajouté par l'éditeur (Puck) à chaque bloc : facultatif, court, caractères sûrs.
const identifiant = optional(string().check(maxLength(100), regex(/^[A-Za-z0-9_-]+$/)));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = string().check(regex(UUID));

const lien = string().check(maxLength(500), refine((valeur) => estLienBanniereSur(valeur)));

// --- Images du stockage Speedfood ------------------------------------------------------------------------------------

/** Chemin des images téléversées depuis l'éditeur (dossier `studio/` du bucket public `medias`). */
export const PREFIXE_IMAGES_STUDIO = "/storage/v1/object/public/medias/studio/";
const NOM_IMAGE_STUDIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

/**
 * Vrai si `valeur` est l'adresse d'une image du stockage de Speedfood : MÊME origine que `NEXT_PUBLIC_SUPABASE_URL`, chemin
 * `/storage/v1/object/public/medias/studio/<uuid>.<jpg|png|webp>` et RIEN d'autre (ni paramètre, ni ancre, ni identifiants
 * dans l'adresse, ni autre dossier). Comparaison de texte exacte : aucune analyse d'URL qui pourrait être trompée.
 * Sans origine connue (variable absente), tout est refusé.
 */
export function estUrlImageStudio(valeur: unknown, origineStockage: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (typeof valeur !== "string" || valeur.length > 300 || !origineStockage) return false;
  let origine: string;
  try {
    origine = new URL(origineStockage).origin;
  } catch {
    return false;
  }
  const debut = `${origine}${PREFIXE_IMAGES_STUDIO}`;
  return valeur.startsWith(debut) && NOM_IMAGE_STUDIO.test(valeur.slice(debut.length));
}

// --- Blocs simples (autorisés aussi dans une colonne) ----------------------------------------------------------------

const reglages = optional(schemaReglages);

const propsTitre = strictObject({
  id: identifiant,
  texte: texte(200, 1),
  niveau: union([literal(2), literal(3), literal(4)]),
  alignement: enumeration(["gauche", "centre"]),
  reglages,
});

const propsParagraphe = strictObject({
  id: identifiant,
  texte: texte(MAX_CARACTERES_PARAGRAPHE),
  reglages,
});

const propsCitation = strictObject({
  id: identifiant,
  texte: texte(400, 1),
  auteur: optional(texte(100)),
  reglages,
});

const propsImage = strictObject({
  id: identifiant,
  src: string().check(refine((valeur) => estUrlImageStudio(valeur))),
  alt: texte(200),
  decorative: optional(boolean()),
  legende: optional(texte(200)),
  ratio: enumeration(["auto", "carre", "16-9", "4-3"]),
  ajustement: enumeration(["couvrir", "contenir"]),
  reglages,
}).check(
  // Un texte alternatif est OBLIGATOIRE, sauf pour une image purement décorative (alt vide rendu au lecteur d'écran).
  refine((p) => p.decorative === true || p.alt.trim().length > 0, { path: ["alt"] })
);

const propsBouton = strictObject({
  id: identifiant,
  libelle: texte(60, 1),
  lien,
  style: enumeration(["principal", "secondaire"]),
  reglages,
});

const propsSeparateur = strictObject({
  id: identifiant,
  style: enumeration(["trait", "vide"]),
  reglages,
});

const propsEspace = strictObject({
  id: identifiant,
  hauteur: union([literal(8), literal(16), literal(32), literal(64), literal(96)]),
  reglages,
});

// --- Blocs de page seulement -----------------------------------------------------------------------------------------

const propsAppelAction = strictObject({
  id: identifiant,
  titre: texte(120, 1),
  texte: optional(texte(300)),
  bouton: strictObject({
    libelle: texte(60, 1),
    lien,
    style: enumeration(["principal", "secondaire"]),
  }),
  reglages,
});

const propsFaq = strictObject({
  id: identifiant,
  titre: optional(texte(120)),
  questions: array(
    strictObject({
      question: texte(200, 1),
      reponse: texte(MAX_CARACTERES_REPONSE, 1),
    })
  ).check(minLength(1), maxLength(MAX_QUESTIONS_FAQ)),
  reglages,
});

const propsCarteRestaurant = strictObject({
  id: identifiant,
  restaurantId: uuid,
  reglages,
});

const propsListeRestaurants = strictObject({
  id: identifiant,
  titre: optional(texte(120)),
  filtre: enumeration(["tous", "ouverts"]),
  quartierId: optional(uuid),
  categorieId: optional(uuid),
  nombre: union([literal(3), literal(6), literal(9), literal(12)]),
  reglages,
});

/** Blocs qui peuvent se trouver DANS une colonne. */
const SCHEMAS_SIMPLES = {
  Titre: propsTitre,
  Paragraphe: propsParagraphe,
  Citation: propsCitation,
  Image: propsImage,
  Bouton: propsBouton,
  Separateur: propsSeparateur,
  Espace: propsEspace,
} as const;

function schemaBlocDe<T extends string, P extends $ZodType>(type: T, props: P) {
  return strictObject({ type: literal(type), props });
}

const schemaBlocSimple = discriminatedUnion("type", [
  schemaBlocDe("Titre", propsTitre),
  schemaBlocDe("Paragraphe", propsParagraphe),
  schemaBlocDe("Citation", propsCitation),
  schemaBlocDe("Image", propsImage),
  schemaBlocDe("Bouton", propsBouton),
  schemaBlocDe("Separateur", propsSeparateur),
  schemaBlocDe("Espace", propsEspace),
]);

export const NOMS_COLONNES = ["colonne1", "colonne2", "colonne3"] as const;
const contenuColonne = optional(array(schemaBlocSimple).check(maxLength(MAX_BLOCS_PAGE)));

const champsCadreColonnes = {
  id: identifiant,
  nombre: union([literal(2), literal(3)]),
  ecart: union([literal(8), literal(16), literal(32)]),
  reglages,
};
/** Colonnes sans leur contenu : validé à part, bloc par bloc (messages précis). */
const schemaCadreColonnes = strictObject(champsCadreColonnes);
const propsColonnes = strictObject({
  ...champsCadreColonnes,
  colonne1: contenuColonne,
  colonne2: contenuColonne,
  colonne3: contenuColonne,
});

const SCHEMAS_PROPS = {
  Titre: propsTitre,
  Paragraphe: propsParagraphe,
  Citation: propsCitation,
  Image: propsImage,
  Colonnes: propsColonnes,
  Separateur: propsSeparateur,
  Espace: propsEspace,
  Bouton: propsBouton,
  AppelAction: propsAppelAction,
  FAQ: propsFaq,
  CarteRestaurant: propsCarteRestaurant,
  ListeRestaurants: propsListeRestaurants,
} as const;

export type TypeBloc = keyof typeof SCHEMAS_PROPS;
export type TypeBlocSimple = keyof typeof SCHEMAS_SIMPLES;
export type PropsDe<T extends TypeBloc> = output<(typeof SCHEMAS_PROPS)[T]>;
export type BlocPage = { [T in TypeBloc]: { type: T; props: PropsDe<T> } }[TypeBloc];
export type BlocSimple = output<typeof schemaBlocSimple>;

/** Types de blocs autorisés dans une colonne (jamais « Colonnes » ni un bloc dynamique). */
export const TYPES_SIMPLES = Object.keys(SCHEMAS_SIMPLES) as TypeBlocSimple[];

/** Blocs dont les données sont lues à l'affichage (restaurants) : jamais dans une colonne. */
export const TYPES_DYNAMIQUES = ["CarteRestaurant", "ListeRestaurants"] as const;

/** Familles de blocs, dans l'ordre de présentation dans l'éditeur. */
export const CATEGORIES_BLOCS = [
  { code: "texte", libelle: "Texte" },
  { code: "medias", libelle: "Médias" },
  { code: "miseEnPage", libelle: "Mise en page" },
  { code: "contenu", libelle: "Contenu" },
  { code: "restaurants", libelle: "Restaurants" },
] as const;
export type CategorieBloc = (typeof CATEGORIES_BLOCS)[number]["code"];

/**
 * Champ de saisie d'une propriété, décrit pour l'éditeur sans dépendre de Puck : l'éditeur traduit ces descriptions en
 * champs Puck. `choix` : valeurs fermées, identiques à l'énumération du schéma (vérifié par test). `optionnel` : la valeur
 * vide « » est retirée à l'enregistrement.
 */
export type OptionChamp = { valeur: string | number; libelle: string };
export type ChampBloc =
  | { genre: "texte"; libelle: string; max: number; aide?: string; optionnel?: boolean }
  | { genre: "texteLong"; libelle: string; max: number; aide?: string; optionnel?: boolean }
  | { genre: "choix"; libelle: string; options: readonly OptionChamp[]; aide?: string; optionnel?: boolean }
  | { genre: "case"; libelle: string; aide?: string }
  | { genre: "reglages"; libelle: string }
  | { genre: "image"; libelle: string }
  | { genre: "restaurant"; libelle: string }
  | { genre: "taxonomie"; libelle: string; source: "quartiers" | "categories"; aide?: string }
  | { genre: "groupe"; libelle: string; champs: Record<string, ChampBloc> }
  | { genre: "liste"; libelle: string; max: number; resume: string; champs: Record<string, ChampBloc> }
  | { genre: "colonne"; libelle: string; autorise: readonly TypeBlocSimple[] };

export interface EntreeRegistre<T extends TypeBloc> {
  type: T;
  /** Nom affiché à l'équipe. */
  libelle: string;
  categorie: CategorieBloc;
  schemaProps: (typeof SCHEMAS_PROPS)[T];
  /** Champs de l'éditeur, un par propriété (sauf l'identifiant technique `id`), dans l'ordre d'affichage. */
  champs: { [K in Exclude<keyof PropsDe<T>, "id">]-?: ChampBloc };
  /** Propriétés d'un bloc nouvellement ajouté. Valides pour `schemaProps`, sauf si `incomplet` (à compléter d'abord). */
  defauts: PropsDe<T>;
  /** Vrai si le bloc ajouté n'est pas encore enregistrable (image ou restaurant à choisir). */
  incomplet?: boolean;
}

const CHAMP_REGLAGES: ChampBloc = { genre: "reglages", libelle: "Réglages" };

const OPTIONS_STYLE_BOUTON: readonly OptionChamp[] = [
  { valeur: "principal", libelle: "Principal (rouge)" },
  { valeur: "secondaire", libelle: "Secondaire (contour)" },
];

const AUTORISES_COLONNE: readonly TypeBlocSimple[] = TYPES_SIMPLES;

/** Les blocs disponibles, dans l'ordre de présentation à l'équipe. Source unique : rendu, validation ET éditeur. */
export const REGISTRE: { [T in TypeBloc]: EntreeRegistre<T> }[TypeBloc][] = [
  {
    type: "Titre",
    libelle: "Titre",
    categorie: "texte",
    schemaProps: propsTitre,
    champs: {
      texte: { genre: "texte", libelle: "Texte du titre", max: 200 },
      niveau: {
        genre: "choix",
        libelle: "Importance",
        options: [
          { valeur: 2, libelle: "Titre de partie" },
          { valeur: 3, libelle: "Sous-titre" },
          { valeur: 4, libelle: "Petit titre" },
        ],
      },
      alignement: {
        genre: "choix",
        libelle: "Alignement du titre",
        options: [
          { valeur: "gauche", libelle: "À gauche" },
          { valeur: "centre", libelle: "Centré" },
        ],
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { texte: "Un titre", niveau: 2, alignement: "gauche" },
  },
  {
    type: "Paragraphe",
    libelle: "Paragraphe",
    categorie: "texte",
    schemaProps: propsParagraphe,
    champs: {
      texte: {
        genre: "texteLong",
        libelle: "Texte",
        max: MAX_CARACTERES_PARAGRAPHE,
        aide: "Gras : **mot**. Lien : [texte](/adresse). Liste : une ligne qui commence par « - ».",
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { texte: "Un paragraphe de texte." },
  },
  {
    type: "Citation",
    libelle: "Citation",
    categorie: "texte",
    schemaProps: propsCitation,
    champs: {
      texte: { genre: "texteLong", libelle: "Citation", max: 400 },
      auteur: { genre: "texte", libelle: "Auteur (facultatif)", max: 100, optionnel: true },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { texte: "Une phrase à mettre en valeur." },
  },
  {
    type: "Image",
    libelle: "Image",
    categorie: "medias",
    schemaProps: propsImage,
    champs: {
      src: { genre: "image", libelle: "Image" },
      alt: {
        genre: "texte",
        libelle: "Description de l'image (pour les personnes qui ne la voient pas)",
        max: 200,
        aide: "Décrivez ce que montre l'image. Obligatoire, sauf si l'image est purement décorative.",
      },
      decorative: { genre: "case", libelle: "Image décorative (sans description)", aide: "À cocher seulement si l'image n'apporte aucune information." },
      legende: { genre: "texte", libelle: "Légende (facultative)", max: 200, optionnel: true },
      ratio: {
        genre: "choix",
        libelle: "Proportions",
        options: [
          { valeur: "auto", libelle: "Automatiques (celles de l'image)" },
          { valeur: "carre", libelle: "Carré" },
          { valeur: "16-9", libelle: "Large (16/9)" },
          { valeur: "4-3", libelle: "Photo (4/3)" },
        ],
      },
      ajustement: {
        genre: "choix",
        libelle: "Cadrage",
        aide: "« Couvrir » remplit le cadre en rognant l'image ; « Contenir » montre toute l'image.",
        options: [
          { valeur: "couvrir", libelle: "Couvrir le cadre" },
          { valeur: "contenir", libelle: "Montrer toute l'image" },
        ],
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { src: "", alt: "", decorative: false, legende: "", ratio: "16-9", ajustement: "couvrir" },
    incomplet: true,
  },
  {
    type: "Colonnes",
    libelle: "Colonnes",
    categorie: "miseEnPage",
    schemaProps: propsColonnes,
    champs: {
      nombre: {
        genre: "choix",
        libelle: "Nombre de colonnes",
        options: [
          { valeur: 2, libelle: "2 colonnes" },
          { valeur: 3, libelle: "3 colonnes" },
        ],
      },
      ecart: {
        genre: "choix",
        libelle: "Espace entre les colonnes",
        options: [
          { valeur: 8, libelle: "Petit (8 px)" },
          { valeur: 16, libelle: "Moyen (16 px)" },
          { valeur: 32, libelle: "Grand (32 px)" },
        ],
      },
      colonne1: { genre: "colonne", libelle: "Colonne 1", autorise: AUTORISES_COLONNE },
      colonne2: { genre: "colonne", libelle: "Colonne 2", autorise: AUTORISES_COLONNE },
      colonne3: { genre: "colonne", libelle: "Colonne 3", autorise: AUTORISES_COLONNE },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { nombre: 2, ecart: 16, colonne1: [], colonne2: [], colonne3: [] },
  },
  {
    type: "Separateur",
    libelle: "Séparateur",
    categorie: "miseEnPage",
    schemaProps: propsSeparateur,
    champs: {
      style: {
        genre: "choix",
        libelle: "Apparence",
        options: [
          { valeur: "trait", libelle: "Trait" },
          { valeur: "vide", libelle: "Espace vide" },
        ],
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { style: "trait" },
  },
  {
    type: "Espace",
    libelle: "Espace",
    categorie: "miseEnPage",
    schemaProps: propsEspace,
    champs: {
      hauteur: {
        genre: "choix",
        libelle: "Hauteur",
        options: [
          { valeur: 8, libelle: "Très petite (8 px)" },
          { valeur: 16, libelle: "Petite (16 px)" },
          { valeur: 32, libelle: "Moyenne (32 px)" },
          { valeur: 64, libelle: "Grande (64 px)" },
          { valeur: 96, libelle: "Très grande (96 px)" },
        ],
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { hauteur: 32 },
  },
  {
    type: "Bouton",
    libelle: "Bouton",
    categorie: "contenu",
    schemaProps: propsBouton,
    champs: {
      libelle: { genre: "texte", libelle: "Texte du bouton", max: 60 },
      lien: { genre: "texte", libelle: "Lien (chemin du site comme /restaurants, ou adresse https://)", max: 500 },
      style: { genre: "choix", libelle: "Style", options: OPTIONS_STYLE_BOUTON },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { libelle: "Voir les restaurants", lien: "/restaurants", style: "principal" },
  },
  {
    type: "AppelAction",
    libelle: "Appel à l'action",
    categorie: "contenu",
    schemaProps: propsAppelAction,
    champs: {
      titre: { genre: "texte", libelle: "Titre du bandeau", max: 120 },
      texte: { genre: "texteLong", libelle: "Texte (facultatif)", max: 300, optionnel: true },
      bouton: {
        genre: "groupe",
        libelle: "Bouton",
        champs: {
          libelle: { genre: "texte", libelle: "Texte du bouton", max: 60 },
          lien: { genre: "texte", libelle: "Lien (chemin du site comme /restaurants, ou adresse https://)", max: 500 },
          style: { genre: "choix", libelle: "Style du bouton", options: OPTIONS_STYLE_BOUTON },
        },
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: {
      titre: "Prêt à commander ?",
      texte: "Choisissez un restaurant et recevez votre repas.",
      bouton: { libelle: "Voir les restaurants", lien: "/restaurants", style: "principal" },
      reglages: { fond: "mangue", alignement: "centre" },
    },
  },
  {
    type: "FAQ",
    libelle: "Questions fréquentes",
    categorie: "contenu",
    schemaProps: propsFaq,
    champs: {
      titre: { genre: "texte", libelle: "Titre (facultatif)", max: 120, optionnel: true },
      questions: {
        genre: "liste",
        libelle: "Questions et réponses",
        max: MAX_QUESTIONS_FAQ,
        resume: "question",
        champs: {
          question: { genre: "texte", libelle: "Question", max: 200 },
          reponse: {
            genre: "texteLong",
            libelle: "Réponse",
            max: MAX_CARACTERES_REPONSE,
            aide: "Gras : **mot**. Lien : [texte](/adresse). Liste : une ligne qui commence par « - ».",
          },
        },
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: {
      titre: "Questions fréquentes",
      questions: [
        { question: "Une première question ?", reponse: "La réponse à la première question." },
        { question: "Une deuxième question ?", reponse: "La réponse à la deuxième question." },
      ],
    },
  },
  {
    type: "CarteRestaurant",
    libelle: "Carte de restaurant",
    categorie: "restaurants",
    schemaProps: propsCarteRestaurant,
    champs: {
      restaurantId: { genre: "restaurant", libelle: "Restaurant" },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { restaurantId: "" },
    incomplet: true,
  },
  {
    type: "ListeRestaurants",
    libelle: "Liste de restaurants",
    categorie: "restaurants",
    schemaProps: propsListeRestaurants,
    champs: {
      titre: { genre: "texte", libelle: "Titre (facultatif)", max: 120, optionnel: true },
      filtre: {
        genre: "choix",
        libelle: "Restaurants à montrer",
        options: [
          { valeur: "tous", libelle: "Tous (ceux qui sont ouverts d'abord)" },
          { valeur: "ouverts", libelle: "Seulement ceux qui prennent des commandes" },
        ],
      },
      quartierId: { genre: "taxonomie", libelle: "Quartier (facultatif)", source: "quartiers" },
      categorieId: { genre: "taxonomie", libelle: "Famille de cuisine (facultatif)", source: "categories" },
      nombre: {
        genre: "choix",
        libelle: "Nombre de restaurants",
        options: [
          { valeur: 3, libelle: "3" },
          { valeur: 6, libelle: "6" },
          { valeur: 9, libelle: "9" },
          { valeur: 12, libelle: "12" },
        ],
      },
      reglages: CHAMP_REGLAGES,
    },
    defauts: { titre: "Les restaurants du moment", filtre: "tous", nombre: 3 },
  },
];

/** Entrée du registre d'un type, ou `undefined` pour un type inconnu (jamais d'accès par prototype). */
export function entreeRegistre(type: string): EntreeRegistre<TypeBloc> | undefined {
  return Object.prototype.hasOwnProperty.call(SCHEMAS_PROPS, type) ? PAR_TYPE.get(type) : undefined;
}

const PAR_TYPE = new Map<string, EntreeRegistre<TypeBloc>>(REGISTRE.map((e) => [e.type, e as EntreeRegistre<TypeBloc>]));

/** Vrai si `type` est un bloc simple (autorisé dans une colonne). */
export function estTypeSimple(type: string): type is TypeBlocSimple {
  return Object.prototype.hasOwnProperty.call(SCHEMAS_SIMPLES, type);
}

const schemaBloc = discriminatedUnion("type", [
  schemaBlocDe("Titre", propsTitre),
  schemaBlocDe("Paragraphe", propsParagraphe),
  schemaBlocDe("Citation", propsCitation),
  schemaBlocDe("Image", propsImage),
  schemaBlocDe("Colonnes", propsColonnes),
  schemaBlocDe("Separateur", propsSeparateur),
  schemaBlocDe("Espace", propsEspace),
  schemaBlocDe("Bouton", propsBouton),
  schemaBlocDe("AppelAction", propsAppelAction),
  schemaBlocDe("FAQ", propsFaq),
  schemaBlocDe("CarteRestaurant", propsCarteRestaurant),
  schemaBlocDe("ListeRestaurants", propsListeRestaurants),
]);

const schemaRacine = strictObject({
  props: strictObject({ titre: optional(texte(200)) }),
});

/** Schéma complet d'une page (pour l'éditeur et les tests) ; `validerPage` l'applique bloc par bloc pour ses messages. */
export const schemaPage = strictObject({
  content: array(schemaBloc).check(maxLength(MAX_BLOCS_PAGE)),
  root: schemaRacine,
});

export type PageBlocs = output<typeof schemaPage>;

export type ResultatValidation = { ok: true; page: PageBlocs } | { ok: false; erreurs: string[] };

function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return false;
  const proto = Object.getPrototypeOf(valeur);
  return proto === Object.prototype || proto === null;
}

/** Taille en octets UTF-8 du document sérialisé, ou `null` s'il ne se sérialise pas (cycle, profondeur extrême). */
function tailleOctets(valeur: unknown): number | null {
  try {
    const json = JSON.stringify(valeur);
    return typeof json === "string" ? new TextEncoder().encode(json).length : null;
  } catch {
    return null;
  }
}

/** Message lisible d'un problème de validation, SANS jamais reprendre une valeur saisie (ni une clé inconnue). */
function decrireProbleme(issue: $ZodIssue, nomsConnus: readonly string[], props: Record<string, unknown>): string {
  const cle = issue.path[0];
  let champ = typeof cle === "string" && nomsConnus.includes(cle) ? `la propriété « ${cle} »` : "une propriété";
  if (typeof cle === "string" && nomsConnus.includes(cle) && typeof issue.path[1] === "number") champ += ` (élément ${issue.path[1] + 1})`;
  switch (issue.code) {
    case "unrecognized_keys":
      return "propriété non autorisée";
    case "too_big":
      return `${champ} est trop longue ou trop grande${typeof issue.maximum === "number" ? ` (maximum ${issue.maximum})` : ""}`;
    case "too_small":
      return `${champ} est vide ou trop courte`;
    case "invalid_type":
      return typeof cle === "string" && !Object.prototype.hasOwnProperty.call(props, cle) ? `${champ} est manquante` : `${champ} n'a pas le bon type`;
    case "invalid_value":
    case "invalid_union":
      return `${champ} a une valeur non autorisée`;
    case "invalid_format":
      return cle === "restaurantId" || cle === "quartierId" || cle === "categorieId" || cle === "ancre" || cle === "reglages"
        ? `${champ} n'a pas un format valide`
        : `${champ} contient des caractères non autorisés`;
    case "custom":
      if (cle === "src") return "l'image n'est pas choisie ou n'est pas une image du stockage de Speedfood (téléversez-la depuis l'éditeur)";
      if (cle === "alt") return "la description de l'image est obligatoire (ou cochez « image décorative »)";
      if (cle === "reglages") return "la propriété « reglages » contient une ancre réservée par le site";
      if (issue.path.includes("lien")) return `${champ} n'est pas un lien autorisé (chemin du site ou adresse https://)`;
      return `${champ} n'est pas valide`;
    default:
      return `${champ} est invalide`;
  }
}

interface SchemaGenerique {
  safeParse(valeur: unknown): { success: true; data: Record<string, unknown> } | { success: false; error: { issues: $ZodIssue[] } };
  shape: Record<string, unknown>;
}

interface Contexte {
  erreurs: string[];
  total: number;
  /** Ancres vues -> libellé du bloc qui les porte. */
  ancres: Map<string, string>;
  stop: boolean;
}

function signaler(ctx: Contexte, message: string) {
  ctx.erreurs.push(message);
  if (ctx.erreurs.length > MAX_ERREURS) ctx.stop = true;
}

function signalerProblemes(ctx: Contexte, chemin: string, libelle: string, schema: SchemaGenerique, resultat: { error: { issues: $ZodIssue[] } }, props: Record<string, unknown>) {
  const noms = Object.keys(schema.shape);
  const vus = new Set<string>();
  for (const issue of resultat.error.issues) {
    const message = `${chemin} (${libelle}) : ${decrireProbleme(issue, noms, props)}.`;
    if (!vus.has(message)) {
      vus.add(message);
      signaler(ctx, message);
    }
  }
}

/** Retient l'ancre d'un bloc validé ; deux blocs ne peuvent pas partager la même ancre. */
function retenirAncre(ctx: Contexte, chemin: string, donnees: Record<string, unknown>) {
  const reglagesValides = donnees.reglages;
  const ancre = estObjetSimple(reglagesValides) ? reglagesValides.ancre : undefined;
  if (typeof ancre !== "string") return;
  const premier = ctx.ancres.get(ancre);
  if (premier === undefined) ctx.ancres.set(ancre, chemin);
  else signaler(ctx, `${chemin} : cette ancre est déjà utilisée par ${premier.charAt(0).toLowerCase()}${premier.slice(1)} (une ancre est unique dans la page).`);
}

/**
 * Valide un bloc (et, pour « Colonnes », son contenu). `chemin` : « Bloc 3 » ou « Bloc 3, colonne 2, bloc 1 ». `profondeur` :
 * 0 pour un bloc de la page, 1 pour un bloc dans une colonne. Les blocs sont comptés (colonnes comprises) et on s'arrête dès
 * que la limite ou le plafond d'erreurs est dépassé : le travail reste borné pour une entrée hostile.
 */
function validerBloc(element: unknown, chemin: string, profondeur: number, ctx: Contexte): void {
  if (ctx.stop) return;
  ctx.total += 1;
  if (ctx.total > MAX_BLOCS_PAGE) {
    signaler(ctx, `La page contient trop de blocs (${MAX_BLOCS_PAGE} au maximum, blocs des colonnes compris).`);
    ctx.stop = true;
    return;
  }
  if (!estObjetSimple(element) || typeof element.type !== "string") {
    signaler(ctx, `${chemin} : bloc illisible.`);
    return;
  }
  const entree = PAR_TYPE.get(element.type);
  if (!entree || !Object.prototype.hasOwnProperty.call(SCHEMAS_PROPS, element.type)) {
    signaler(ctx, `${chemin} : type de bloc inconnu.`);
    return;
  }
  if (Object.keys(element).some((c) => c !== "type" && c !== "props")) {
    signaler(ctx, `${chemin} (${entree.libelle}) : propriété non autorisée.`);
    return;
  }
  if (profondeur >= 1 && !estTypeSimple(entree.type)) {
    signaler(
      ctx,
      entree.type === "Colonnes"
        ? `${chemin} (${entree.libelle}) : les colonnes ne peuvent pas être placées l'une dans l'autre.`
        : `${chemin} (${entree.libelle}) : ce bloc ne peut pas être placé dans une colonne.`
    );
    return;
  }

  const props = element.props;
  if (entree.type === "Colonnes") {
    if (!estObjetSimple(props)) {
      signaler(ctx, `${chemin} (${entree.libelle}) : propriétés absentes.`);
      return;
    }
    const cadre: Record<string, unknown> = {};
    for (const cle of Object.keys(props)) if (!(NOMS_COLONNES as readonly string[]).includes(cle)) cadre[cle] = props[cle];
    const schema = schemaCadreColonnes as unknown as SchemaGenerique;
    const resultat = schema.safeParse(cadre);
    if (!resultat.success) signalerProblemes(ctx, chemin, entree.libelle, schema, resultat, props);
    else retenirAncre(ctx, chemin, resultat.data);
    const nombre = resultat.success && typeof resultat.data.nombre === "number" ? resultat.data.nombre : 3;
    NOMS_COLONNES.forEach((nom, k) => {
      const colonne = props[nom];
      if (colonne === undefined || ctx.stop) return;
      if (!Array.isArray(colonne)) {
        signaler(ctx, `${chemin} (${entree.libelle}) : la colonne ${k + 1} n'est pas une liste de blocs.`);
        return;
      }
      if (colonne.length > MAX_BLOCS_PAGE) {
        signaler(ctx, `La page contient trop de blocs (${MAX_BLOCS_PAGE} au maximum, blocs des colonnes compris).`);
        ctx.stop = true;
        return;
      }
      if (k + 1 > nombre && colonne.length > 0) {
        signaler(ctx, `${chemin} (${entree.libelle}) : la colonne ${k + 1} contient des blocs mais la mise en page n'a que ${nombre} colonnes : videz cette colonne ou choisissez 3 colonnes.`);
      }
      colonne.forEach((enfant, j) => validerBloc(enfant, `${chemin}, colonne ${k + 1}, bloc ${j + 1}`, profondeur + 1, ctx));
    });
    return;
  }

  const schema = entree.schemaProps as unknown as SchemaGenerique;
  const resultat = schema.safeParse(props);
  if (!resultat.success) {
    if (!estObjetSimple(props)) {
      signaler(ctx, `${chemin} (${entree.libelle}) : propriétés absentes.`);
      return;
    }
    signalerProblemes(ctx, chemin, entree.libelle, schema, resultat, props);
    return;
  }
  retenirAncre(ctx, chemin, resultat.data);
}

/**
 * Valide un document de page. Contrôles dans l'ordre (du moins coûteux au plus coûteux) : objet simple, taille sérialisée,
 * nombre de blocs, puis chaque bloc contre le schéma de son type (récursivement pour les colonnes), unicité des ancres.
 * Messages en français, numérotés par bloc (à partir de 1).
 */
export function validerPage(json: unknown): ResultatValidation {
  if (!estObjetSimple(json)) return { ok: false, erreurs: ["Le document de la page n'est pas un objet."] };
  const taille = tailleOctets(json);
  if (taille === null) return { ok: false, erreurs: ["Le document de la page est illisible."] };
  if (taille > MAX_OCTETS_PAGE) return { ok: false, erreurs: ["La page est trop volumineuse (200 Ko au maximum)."] };

  const ctx: Contexte = { erreurs: [], total: 0, ancres: new Map(), stop: false };
  const cles = Object.keys(json);
  if (cles.some((c) => c !== "content" && c !== "root")) signaler(ctx, "Le document de la page contient une propriété non autorisée.");

  const contenu = json.content;
  if (!Array.isArray(contenu)) {
    signaler(ctx, "La liste des blocs est absente.");
  } else if (contenu.length > MAX_BLOCS_PAGE) {
    signaler(ctx, `La page contient trop de blocs (${MAX_BLOCS_PAGE} au maximum).`);
  } else {
    contenu.forEach((element, i) => validerBloc(element, `Bloc ${i + 1}`, 0, ctx));
  }

  const racine = schemaRacine.safeParse(json.root);
  if (!racine.success) ctx.erreurs.push("Les réglages de la page sont invalides (titre de 200 caractères au maximum).");

  if (ctx.erreurs.length > 0) {
    const affichees = ctx.erreurs.slice(0, MAX_ERREURS);
    if (ctx.erreurs.length > MAX_ERREURS) affichees.push("D'autres erreurs ne sont pas affichées.");
    return { ok: false, erreurs: affichees };
  }

  // Double garantie : le schéma complet doit accepter ce que la validation bloc par bloc a accepté.
  const complet = schemaPage.safeParse(json);
  if (!complet.success) return { ok: false, erreurs: ["Le document de la page est invalide."] };
  return { ok: true, page: complet.data };
}

/** Document d'une page sans aucun bloc (création d'une page à blocs). */
export function pageVide(): PageBlocs {
  return { content: [], root: { props: {} } };
}

/** Nombre de blocs d'une liste, blocs des colonnes compris (tolérant : sert aussi à l'éditeur, sur des données non validées). */
export function compterBlocsContenu(contenu: readonly { type?: unknown; props?: unknown }[]): number {
  let total = 0;
  for (const bloc of contenu) {
    total += 1;
    if (bloc && bloc.type === "Colonnes" && estObjetSimple(bloc.props)) {
      for (const nom of NOMS_COLONNES) {
        const colonne = bloc.props[nom];
        if (Array.isArray(colonne)) total += colonne.length;
      }
    }
  }
  return total;
}

export function compterBlocs(page: PageBlocs): number {
  return compterBlocsContenu(page.content);
}

/**
 * Texte d'un bloc Paragraphe -> blocs de texte riche, sous-ensemble de `texte-riche.ts` : gras, liens, listes, sauts de
 * ligne. Pas de titre dans un paragraphe : une ligne `# x` reste du texte (le bloc Titre sert à cela).
 */
export function analyserParagraphe(texteParagraphe: string): BlocTexte[] {
  return analyserTexteRiche(texteParagraphe.slice(0, MAX_CARACTERES_PARAGRAPHE)).map((bloc) =>
    bloc.type === "titre"
      ? { type: "paragraphe", segments: [{ type: "texte", valeur: `${"#".repeat(bloc.niveau)} ` }, ...bloc.segments] }
      : bloc
  );
}
