import { MAX_BLOCS_PAGE, NOMS_COLONNES, compterBlocsContenu, entreeRegistre, estTypeAccueil, estTypeSimple } from "./registre";
import { libelleBloc } from "./editeur-donnees";

/**
 * Panneau « Blocs de la page » de l'éditeur (palier 3) : alternative au glisser-déposer de Puck, qui ne se fait qu'à la
 * souris. Module PUR : chaque opération demandée au clavier est traduite en actions de Puck (les MÊMES données que
 * l'aperçu : rien n'est dupliqué), avec le message à annoncer (`aria-live`) et la ligne à focaliser ensuite, pour que le
 * focus ne soit jamais perdu. Les bornes (premier, dernier, page pleine) sont refusées avec un message clair.
 *
 * Tâche 8 : les blocs DANS une colonne se manipulent de la même façon que ceux de la page. Chaque colonne est une « zone » de
 * Puck de nom `<identifiant du bloc Colonnes>:colonneN`. Déplacer un bloc d'une zone à l'autre reste réservé à la souris
 * (limite documentée : le panneau déplace dans la liste où se trouve le bloc).
 */

/** Zone racine de Puck (`root:default-zone`). */
export const ZONE_RACINE = "root:default-zone";

/** Un bloc tel que Puck le garde dans ses données (les colonnes sont des listes dans les propriétés). */
export interface BlocContenu {
  type: string;
  props: Record<string, unknown>;
}

/** Sous-ensemble des actions de Puck utilisées ici (même forme que `PuckAction`). */
export type ActionPanneau =
  | { type: "reorder"; sourceIndex: number; destinationIndex: number; destinationZone: string }
  | { type: "duplicate"; sourceIndex: number; sourceZone: string }
  | { type: "remove"; index: number; zone: string }
  | { type: "insert"; componentType: string; destinationIndex: number; destinationZone: string };

export type OperationPanneau =
  | { type: "monter"; index: number; zone?: string }
  | { type: "descendre"; index: number; zone?: string }
  | { type: "dupliquer"; index: number; zone?: string }
  | { type: "supprimer"; index: number; zone?: string }
  /** `apres` : index du bloc après lequel ajouter, ou `null` pour ajouter en fin de liste. */
  | { type: "ajouter"; typeBloc: string; apres: number | null; zone?: string };

/** Position d'un bloc : la liste (zone) où il se trouve et son rang dans cette liste. */
export interface CibleBloc {
  zone: string;
  index: number;
}

export type PlanOperation =
  | {
      ok: true;
      action: ActionPanneau;
      /** Message pour la zone `aria-live="polite"`. */
      annonce: string;
      /** Bloc à focaliser et à sélectionner ensuite ; `null` : la page est vide, le focus va au bouton « Ajouter un bloc ». */
      cible: CibleBloc | null;
    }
  | { ok: false; annonce: string };

export function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

function horsBornes(index: number, total: number) {
  return !Number.isInteger(index) || index < 0 || index >= total;
}

/** Nom de la zone d'une colonne d'un bloc Colonnes. */
export function zoneColonne(idBloc: string, colonne: number): string {
  return `${idBloc}:colonne${colonne}`;
}

interface ListeZone {
  blocs: readonly BlocContenu[];
  /** Numéro de la colonne (1 à 3), ou `null` pour la page. */
  colonne: number | null;
  /** Index, dans la page, du bloc Colonnes qui porte la zone. */
  parent: number | null;
  /** Nombre de colonnes affichées du bloc Colonnes (la zone n'est pas affichée au-delà). */
  nombre: number;
}

function listeDeZone(contenu: readonly BlocContenu[], zone: string): ListeZone | null {
  if (zone === ZONE_RACINE) return { blocs: contenu, colonne: null, parent: null, nombre: 3 };
  const [id, nom] = zone.split(":");
  const rang = (NOMS_COLONNES as readonly string[]).indexOf(nom ?? "");
  if (rang < 0 || !id) return null;
  const parent = contenu.findIndex((b) => b.type === "Colonnes" && b.props.id === id);
  if (parent < 0) return null;
  const liste = contenu[parent].props[NOMS_COLONNES[rang]];
  if (!Array.isArray(liste)) return null;
  const nombre = typeof contenu[parent].props.nombre === "number" ? (contenu[parent].props.nombre as number) : 3;
  return { blocs: liste as BlocContenu[], colonne: rang + 1, parent, nombre };
}

const dansLaColonne = (z: ListeZone) => (z.colonne === null ? "" : ` dans la colonne ${z.colonne}`);

/** Traduit une opération du panneau en action de Puck. `contenu` : les blocs de la page, colonnes comprises. */
export function planifierOperation(operation: OperationPanneau, contenu: readonly BlocContenu[]): PlanOperation {
  const zone = operation.zone ?? ZONE_RACINE;
  const liste = listeDeZone(contenu, zone);
  if (!liste) return { ok: false, annonce: "Ce bloc n'existe plus." };
  const blocs = liste.blocs;
  const total = blocs.length;
  const totalPage = compterBlocsContenu(contenu);
  const cibleDe = (index: number): CibleBloc => ({ zone, index });
  switch (operation.type) {
    case "monter":
    case "descendre": {
      const { index } = operation;
      if (horsBornes(index, total)) return { ok: false, annonce: "Ce bloc n'existe plus." };
      const destination = operation.type === "monter" ? index - 1 : index + 1;
      if (destination < 0) return { ok: false, annonce: "Ce bloc est déjà en première position." };
      if (destination >= total) return { ok: false, annonce: "Ce bloc est déjà en dernière position." };
      return {
        ok: true,
        action: { type: "reorder", sourceIndex: index, destinationIndex: destination, destinationZone: zone },
        annonce: `Bloc déplacé en position ${destination + 1} sur ${total}${dansLaColonne(liste)}.`,
        cible: cibleDe(destination),
      };
    }
    case "dupliquer": {
      const { index } = operation;
      if (horsBornes(index, total)) return { ok: false, annonce: "Ce bloc n'existe plus." };
      if (estTypeAccueil(blocs[index].type)) return { ok: false, annonce: `${libelleBloc(blocs[index].type)} ne peut figurer qu'une seule fois dans la page : elle n'est pas dupliquée.` };
      const copie = compterBlocsContenu([blocs[index]]);
      if (totalPage + copie > MAX_BLOCS_PAGE) return { ok: false, annonce: `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.` };
      return {
        ok: true,
        action: { type: "duplicate", sourceIndex: index, sourceZone: zone },
        annonce: `Bloc ${libelleBloc(blocs[index].type)} dupliqué : la copie est en position ${index + 2} sur ${total + 1}${dansLaColonne(liste)}.`,
        cible: cibleDe(index + 1),
      };
    }
    case "supprimer": {
      const { index } = operation;
      if (horsBornes(index, total)) return { ok: false, annonce: "Ce bloc n'existe plus." };
      const reste = total - 1;
      const contenait = blocs[index].type === "Colonnes" ? compterBlocsContenu([blocs[index]]) - 1 : 0;
      const avec = contenait > 0 ? ` (avec les ${pluriel(contenait, "bloc")} de ses colonnes)` : "";
      let cible: CibleBloc | null;
      if (reste > 0) cible = cibleDe(Math.min(index, reste - 1));
      else cible = liste.parent === null ? null : { zone: ZONE_RACINE, index: liste.parent };
      return {
        ok: true,
        action: { type: "remove", index, zone },
        annonce:
          liste.colonne === null
            ? `Bloc ${index + 1}, ${libelleBloc(blocs[index].type)}, supprimé${avec}. La page compte maintenant ${pluriel(compterBlocsContenu(contenu) - 1 - contenait, "bloc")}.`
            : `Bloc ${index + 1}, ${libelleBloc(blocs[index].type)}, supprimé de la colonne ${liste.colonne}. Cette colonne compte maintenant ${pluriel(reste, "bloc")}.`,
        cible,
      };
    }
    case "ajouter": {
      const entree = entreeRegistre(operation.typeBloc);
      if (!entree) return { ok: false, annonce: "Ce type de bloc n'existe pas." };
      if (totalPage + 1 > MAX_BLOCS_PAGE) return { ok: false, annonce: `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.` };
      if (estTypeAccueil(entree.type) && contenu.some((b) => b.type === entree.type)) {
        return { ok: false, annonce: `${entree.libelle} figure déjà dans la page (une seule fois par page).` };
      }
      if (liste.colonne !== null) {
        if (!estTypeSimple(entree.type)) return { ok: false, annonce: `Le bloc ${entree.libelle} ne peut pas être placé dans une colonne.` };
        if (liste.colonne > liste.nombre) return { ok: false, annonce: `La colonne ${liste.colonne} n'est pas affichée : choisissez 3 colonnes pour l'utiliser.` };
      }
      const apres = operation.apres;
      const position = apres === null || horsBornes(apres, total) ? total : apres + 1;
      return {
        ok: true,
        action: { type: "insert", componentType: entree.type, destinationIndex: position, destinationZone: zone },
        annonce: `Bloc ${entree.libelle} ajouté en position ${position + 1} sur ${total + 1}${dansLaColonne(liste)}.`,
        cible: cibleDe(position),
      };
    }
  }
}

/** Situation d'un bloc imbriqué, pour nommer ses boutons. */
export interface SituationBloc {
  /** Index du bloc Colonnes dans la page. */
  parent: number;
  colonne: number;
}

/** Noms accessibles explicites des boutons d'une ligne (ex. « Monter le bloc 3, Titre »). */
export function nomsActions(index: number, type: string, situation?: SituationBloc) {
  const bloc = situation
    ? `le bloc ${index + 1}, ${libelleBloc(type)}, de la colonne ${situation.colonne} du bloc ${situation.parent + 1}`
    : `le bloc ${index + 1}, ${libelleBloc(type)}`;
  return {
    monter: `Monter ${bloc}`,
    descendre: `Descendre ${bloc}`,
    dupliquer: `Dupliquer ${bloc}`,
    supprimer: `Supprimer ${bloc}`,
  };
}

/** Une ligne du panneau : un bloc, avec sa liste et, pour « Colonnes », ses colonnes. */
export interface LignePanneau {
  bloc: BlocContenu;
  zone: string;
  index: number;
  total: number;
  situation?: SituationBloc;
  colonnes?: { numero: number; zone: string; affichee: boolean; lignes: LignePanneau[] }[];
}

/** Plan à plat de la page pour le panneau : les blocs de la page, et sous chaque bloc Colonnes ses colonnes. */
export function construirePlan(contenu: readonly BlocContenu[]): LignePanneau[] {
  return contenu.map((bloc, index) => {
    const ligne: LignePanneau = { bloc, zone: ZONE_RACINE, index, total: contenu.length };
    if (bloc.type === "Colonnes" && typeof bloc.props.id === "string") {
      const nombre = typeof bloc.props.nombre === "number" ? bloc.props.nombre : 3;
      ligne.colonnes = NOMS_COLONNES.flatMap((nom, rang) => {
        const liste = bloc.props[nom];
        const blocs = Array.isArray(liste) ? (liste as BlocContenu[]) : [];
        // Une colonne au-delà du nombre choisi n'apparaît que si elle contient encore des blocs (à vider).
        if (rang + 1 > nombre && blocs.length === 0) return [];
        const zone = zoneColonne(bloc.props.id as string, rang + 1);
        return [
          {
            numero: rang + 1,
            zone,
            affichee: rang + 1 <= nombre,
            lignes: blocs.map((enfant, j) => ({ bloc: enfant, zone, index: j, total: blocs.length, situation: { parent: index, colonne: rang + 1 } })),
          },
        ];
      });
    }
    return ligne;
  });
}

const MAX_EXTRAIT = 60;

function couper(texte: string): string {
  const ligne = texte.replace(/\s+/g, " ").trim();
  return ligne.length > MAX_EXTRAIT ? `${ligne.slice(0, MAX_EXTRAIT - 1)}…` : ligne;
}

/** Extrait lisible d'un bloc pour la liste du panneau (texte brut, jamais de HTML). */
export function extraitBloc(type: string, props: Record<string, unknown>): string {
  const texte = (v: unknown) => (typeof v === "string" ? v : "");
  switch (type) {
    case "Titre":
    case "Paragraphe":
    case "Citation":
      return couper(texte(props.texte)) || "(vide)";
    case "Bouton":
      return couper(`${texte(props.libelle) || "(sans texte)"} → ${texte(props.lien) || "(sans lien)"}`);
    case "Image":
      return props.decorative === true ? "(image décorative)" : couper(texte(props.alt)) || "(à compléter)";
    case "Colonnes": {
      const nombre = typeof props.nombre === "number" ? props.nombre : 3;
      const telephone =
        props.telephone === "cote" ? " · côte à côte sur téléphone" : props.telephone === "inverser" ? " · ordre inversé sur téléphone" : "";
      return `${nombre} colonnes${telephone}`;
    }
    case "AppelAction":
      return couper(texte(props.titre)) || "(vide)";
    case "FAQ":
      return couper(texte(props.titre)) || pluriel(Array.isArray(props.questions) ? props.questions.length : 0, "question");
    case "CarteRestaurant":
      return texte(props.restaurantId) ? "Restaurant choisi" : "(restaurant à choisir)";
    case "ListeRestaurants":
      return couper(texte(props.titre)) || `${typeof props.nombre === "number" ? props.nombre : 3} restaurants`;
    case "AccueilAccroche":
    case "AccueilBandeau":
    case "AccueilRestaurants":
    case "AccueilQuartiers":
    case "AccueilEtapes":
    case "AccueilSuivi":
    case "AccueilPro":
      return "textes du site";
    case "Separateur":
    case "Espace": {
      const entree = entreeRegistre(type);
      const champ = entree ? (entree.champs as Record<string, { genre: string; options?: readonly { valeur: unknown; libelle: string }[] }>)[type === "Espace" ? "hauteur" : "style"] : undefined;
      const valeur = type === "Espace" ? props.hauteur : props.style;
      return champ?.options?.find((o) => o.valeur === valeur)?.libelle ?? "";
    }
    default:
      return "";
  }
}
