import { MAX_BLOCS_PAGE, entreeRegistre } from "./registre";
import { libelleBloc } from "./editeur-donnees";

/**
 * Panneau « Blocs de la page » de l'éditeur (palier 3, tâche 7) : alternative au glisser-déposer de Puck, qui ne se fait
 * qu'à la souris. Module PUR : chaque opération demandée au clavier est traduite en actions de Puck (les MÊMES données
 * que l'aperçu : rien n'est dupliqué), avec le message à annoncer (`aria-live`) et la ligne à focaliser ensuite, pour
 * que le focus ne soit jamais perdu. Les bornes (premier, dernier, page pleine) sont refusées avec un message clair.
 */

/** Zone racine de Puck (`root:default-zone`) : les pages du Studio n'ont pas de zones imbriquées. */
export const ZONE_RACINE = "root:default-zone";

/** Sous-ensemble des actions de Puck utilisées ici (même forme que `PuckAction`). */
export type ActionPanneau =
  | { type: "reorder"; sourceIndex: number; destinationIndex: number; destinationZone: string }
  | { type: "duplicate"; sourceIndex: number; sourceZone: string }
  | { type: "remove"; index: number; zone: string }
  | { type: "insert"; componentType: string; destinationIndex: number; destinationZone: string };

export type OperationPanneau =
  | { type: "monter"; index: number }
  | { type: "descendre"; index: number }
  | { type: "dupliquer"; index: number }
  | { type: "supprimer"; index: number }
  /** `apres` : index du bloc après lequel ajouter, ou `null` pour ajouter en fin de page. */
  | { type: "ajouter"; typeBloc: string; apres: number | null };

export type PlanOperation =
  | {
      ok: true;
      action: ActionPanneau;
      /** Message pour la zone `aria-live="polite"`. */
      annonce: string;
      /** Ligne à focaliser et à sélectionner ensuite ; `null` : la page est vide, le focus va au bouton « Ajouter un bloc ». */
      cible: number | null;
    }
  | { ok: false; annonce: string };

export function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

function horsBornes(index: number, total: number) {
  return !Number.isInteger(index) || index < 0 || index >= total;
}

/** Traduit une opération du panneau en action de Puck. `types` : type de chaque bloc de la page, dans l'ordre. */
export function planifierOperation(operation: OperationPanneau, types: readonly string[]): PlanOperation {
  const total = types.length;
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
        action: { type: "reorder", sourceIndex: index, destinationIndex: destination, destinationZone: ZONE_RACINE },
        annonce: `Bloc déplacé en position ${destination + 1} sur ${total}.`,
        cible: destination,
      };
    }
    case "dupliquer": {
      const { index } = operation;
      if (horsBornes(index, total)) return { ok: false, annonce: "Ce bloc n'existe plus." };
      if (total >= MAX_BLOCS_PAGE) return { ok: false, annonce: `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.` };
      return {
        ok: true,
        action: { type: "duplicate", sourceIndex: index, sourceZone: ZONE_RACINE },
        annonce: `Bloc ${libelleBloc(types[index])} dupliqué : la copie est en position ${index + 2} sur ${total + 1}.`,
        cible: index + 1,
      };
    }
    case "supprimer": {
      const { index } = operation;
      if (horsBornes(index, total)) return { ok: false, annonce: "Ce bloc n'existe plus." };
      const reste = total - 1;
      return {
        ok: true,
        action: { type: "remove", index, zone: ZONE_RACINE },
        annonce: `Bloc ${index + 1}, ${libelleBloc(types[index])}, supprimé. La page compte maintenant ${pluriel(reste, "bloc")}.`,
        cible: reste === 0 ? null : Math.min(index, reste - 1),
      };
    }
    case "ajouter": {
      const entree = entreeRegistre(operation.typeBloc);
      if (!entree) return { ok: false, annonce: "Ce type de bloc n'existe pas." };
      if (total >= MAX_BLOCS_PAGE) return { ok: false, annonce: `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.` };
      const apres = operation.apres;
      const position = apres === null || horsBornes(apres, total) ? total : apres + 1;
      return {
        ok: true,
        action: { type: "insert", componentType: entree.type, destinationIndex: position, destinationZone: ZONE_RACINE },
        annonce: `Bloc ${entree.libelle} ajouté en position ${position + 1} sur ${total + 1}.`,
        cible: position,
      };
    }
  }
}

/** Noms accessibles explicites des boutons d'une ligne (ex. « Monter le bloc 3, Titre »). */
export function nomsActions(index: number, type: string) {
  const bloc = `le bloc ${index + 1}, ${libelleBloc(type)}`;
  return {
    monter: `Monter ${bloc}`,
    descendre: `Descendre ${bloc}`,
    dupliquer: `Dupliquer ${bloc}`,
    supprimer: `Supprimer ${bloc}`,
  };
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
      return couper(texte(props.texte)) || "(vide)";
    case "Bouton":
      return couper(`${texte(props.libelle) || "(sans texte)"} → ${texte(props.lien) || "(sans lien)"}`);
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
