import {
  array,
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
import type { $ZodIssue } from "zod/v4/core";
import { estLienBanniereSur } from "../auth/redirection";
import { analyserTexteRiche, type Bloc as BlocTexte } from "../cms/texte-riche";

/**
 * Registre des blocs des pages du Studio (palier 3) et validation des documents de page. Module PUR (aucun import serveur,
 * aucun import de Puck) : partagé par le serveur (écriture ET lecture), le rendu public et, plus tard, l'éditeur.
 *
 * Une page à blocs est un document JSON au format de Puck (`{ content: [{ type, props }], root: { props } }`) écrit par
 * l'équipe : il n'est JAMAIS rendu sans être validé ici. Schémas stricts (aucune propriété en trop), longueurs bornées,
 * énumérations fermées, liens filtrés par `estLienBanniereSur`, aucun HTML (les textes sont rendus en nœuds React).
 * Un document invalide n'est jamais rendu en partie : la page entière est refusée.
 */

export const MAX_BLOCS_PAGE = 200;
/** Taille maximale du document sérialisé (même borne que les contraintes de la base : 200 Ko). */
export const MAX_OCTETS_PAGE = 204_800;
export const MAX_CARACTERES_PARAGRAPHE = 5_000;
/** Nombre maximal de messages d'erreur renvoyés (une entrée hostile en produirait des milliers). */
const MAX_ERREURS = 10;

// Le caractère NUL est refusé par Postgres dans un jsonb : on le refuse ici avec un message clair.
const sansNul = /^[^\u0000]*$/;
const texte = (max: number, min = 0) =>
  min > 0 ? string().check(maxLength(max), minLength(min), regex(sansNul)) : string().check(maxLength(max), regex(sansNul));

// Identifiant ajouté par l'éditeur (Puck) à chaque bloc : facultatif, court, caractères sûrs.
const identifiant = optional(string().check(maxLength(100), regex(/^[A-Za-z0-9_-]+$/)));

const propsTitre = strictObject({
  id: identifiant,
  texte: texte(200, 1),
  niveau: union([literal(2), literal(3), literal(4)]),
  alignement: enumeration(["gauche", "centre"]),
});

const propsParagraphe = strictObject({
  id: identifiant,
  texte: texte(MAX_CARACTERES_PARAGRAPHE),
});

const propsBouton = strictObject({
  id: identifiant,
  libelle: texte(60, 1),
  lien: string().check(maxLength(500), refine((valeur) => estLienBanniereSur(valeur))),
  style: enumeration(["principal", "secondaire"]),
});

const propsSeparateur = strictObject({
  id: identifiant,
  style: enumeration(["trait", "vide"]),
});

const propsEspace = strictObject({
  id: identifiant,
  hauteur: union([literal(8), literal(16), literal(32), literal(64), literal(96)]),
});

const SCHEMAS_PROPS = {
  Titre: propsTitre,
  Paragraphe: propsParagraphe,
  Bouton: propsBouton,
  Separateur: propsSeparateur,
  Espace: propsEspace,
} as const;

export type TypeBloc = keyof typeof SCHEMAS_PROPS;
export type PropsDe<T extends TypeBloc> = output<(typeof SCHEMAS_PROPS)[T]>;
export type BlocPage = { [T in TypeBloc]: { type: T; props: PropsDe<T> } }[TypeBloc];

export interface EntreeRegistre<T extends TypeBloc> {
  type: T;
  /** Nom affiché à l'équipe. */
  libelle: string;
  schemaProps: (typeof SCHEMAS_PROPS)[T];
  /** Propriétés d'un bloc nouvellement ajouté (valides pour `schemaProps`). */
  defauts: PropsDe<T>;
}

/** Les blocs disponibles, dans l'ordre de présentation à l'équipe. */
export const REGISTRE: { [T in TypeBloc]: EntreeRegistre<T> }[TypeBloc][] = [
  { type: "Titre", libelle: "Titre", schemaProps: propsTitre, defauts: { texte: "Un titre", niveau: 2, alignement: "gauche" } },
  { type: "Paragraphe", libelle: "Paragraphe", schemaProps: propsParagraphe, defauts: { texte: "Un paragraphe de texte." } },
  { type: "Bouton", libelle: "Bouton", schemaProps: propsBouton, defauts: { libelle: "Voir les restaurants", lien: "/restaurants", style: "principal" } },
  { type: "Separateur", libelle: "Séparateur", schemaProps: propsSeparateur, defauts: { style: "trait" } },
  { type: "Espace", libelle: "Espace", schemaProps: propsEspace, defauts: { hauteur: 32 } },
];

const PAR_TYPE = new Map<string, EntreeRegistre<TypeBloc>>(REGISTRE.map((e) => [e.type, e as EntreeRegistre<TypeBloc>]));

function schemaBlocDe<T extends TypeBloc>(type: T, props: (typeof SCHEMAS_PROPS)[T]) {
  return strictObject({ type: literal(type), props });
}

const schemaBloc = discriminatedUnion("type", [
  schemaBlocDe("Titre", propsTitre),
  schemaBlocDe("Paragraphe", propsParagraphe),
  schemaBlocDe("Bouton", propsBouton),
  schemaBlocDe("Separateur", propsSeparateur),
  schemaBlocDe("Espace", propsEspace),
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
  const champ = typeof cle === "string" && nomsConnus.includes(cle) ? `la propriété « ${cle} »` : "une propriété";
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
      return `${champ} contient des caractères non autorisés`;
    case "custom":
      return `${champ} n'est pas un lien autorisé (chemin du site ou adresse https://)`;
    default:
      return `${champ} est invalide`;
  }
}

/**
 * Valide un document de page. Contrôles dans l'ordre (du moins coûteux au plus coûteux) : objet simple, taille sérialisée,
 * nombre de blocs, puis chaque bloc contre le schéma de son type. Messages en français, numérotés par bloc (à partir de 1).
 */
export function validerPage(json: unknown): ResultatValidation {
  if (!estObjetSimple(json)) return { ok: false, erreurs: ["Le document de la page n'est pas un objet."] };
  const taille = tailleOctets(json);
  if (taille === null) return { ok: false, erreurs: ["Le document de la page est illisible."] };
  if (taille > MAX_OCTETS_PAGE) return { ok: false, erreurs: ["La page est trop volumineuse (200 Ko au maximum)."] };

  const erreurs: string[] = [];
  const cles = Object.keys(json);
  if (cles.some((c) => c !== "content" && c !== "root")) erreurs.push("Le document de la page contient une propriété non autorisée.");

  const contenu = json.content;
  if (!Array.isArray(contenu)) {
    erreurs.push("La liste des blocs est absente.");
  } else if (contenu.length > MAX_BLOCS_PAGE) {
    erreurs.push(`La page contient trop de blocs (${MAX_BLOCS_PAGE} au maximum).`);
  } else {
    contenu.forEach((element, i) => {
      if (erreurs.length > MAX_ERREURS) return;
      const numero = i + 1;
      if (!estObjetSimple(element) || typeof element.type !== "string") {
        erreurs.push(`Bloc ${numero} : bloc illisible.`);
        return;
      }
      const entree = PAR_TYPE.get(element.type);
      if (!entree || !Object.prototype.hasOwnProperty.call(SCHEMAS_PROPS, element.type)) {
        erreurs.push(`Bloc ${numero} : type de bloc inconnu.`);
        return;
      }
      if (Object.keys(element).some((c) => c !== "type" && c !== "props")) {
        erreurs.push(`Bloc ${numero} (${entree.libelle}) : propriété non autorisée.`);
        return;
      }
      const resultat = entree.schemaProps.safeParse(element.props);
      if (!resultat.success) {
        if (!estObjetSimple(element.props)) {
          erreurs.push(`Bloc ${numero} (${entree.libelle}) : propriétés absentes.`);
          return;
        }
        const noms = Object.keys(entree.schemaProps.shape);
        const vus = new Set<string>();
        for (const issue of resultat.error.issues) {
          const message = `Bloc ${numero} (${entree.libelle}) : ${decrireProbleme(issue, noms, element.props)}.`;
          if (!vus.has(message)) {
            vus.add(message);
            erreurs.push(message);
          }
        }
      }
    });
  }

  const racine = schemaRacine.safeParse(json.root);
  if (!racine.success) erreurs.push("Les réglages de la page sont invalides (titre de 200 caractères au maximum).");

  if (erreurs.length > 0) {
    const affichees = erreurs.slice(0, MAX_ERREURS);
    if (erreurs.length > MAX_ERREURS) affichees.push("D'autres erreurs ne sont pas affichées.");
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

export function compterBlocs(page: PageBlocs): number {
  return page.content.length;
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
