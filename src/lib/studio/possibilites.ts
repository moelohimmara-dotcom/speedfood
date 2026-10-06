import { MINIMUMS_STUDIO, explicationPalier, type Palier } from "../system-admin/paliers";

/**
 * Ce que l'éditeur de pages à blocs permet à la personne connectée (palier 3, tâche 7). Module PUR, calculé côté SERVEUR
 * à partir du palier effectif sur `contenu:pages` et du statut de la page, puis passé à l'éditeur pour adapter
 * l'interface. Ce n'est qu'un confort : chaque action serveur revérifie le palier (tâche 6) et la base aussi.
 *
 * Mêmes règles que les actions : enregistrer le brouillon d'une page hors ligne ≥ 1, d'une page en ligne ≥ 2 ; publier
 * et remettre une version dans le brouillon ≥ 2.
 */
export interface PossibilitesEditeur {
  peutEnregistrer: boolean;
  peutPublier: boolean;
  peutRestaurer: boolean;
  /** Explications en français des actions indisponibles (`null` si l'action est permise). */
  explications: { enregistrer: string | null; publier: string | null; restaurer: string | null };
}

export function calculerPossibilites(palier: Palier, statut: string): PossibilitesEditeur {
  const enLigne = statut === "publie";
  const minimumEnregistrer = enLigne ? MINIMUMS_STUDIO.publier : MINIMUMS_STUDIO.brouillon;
  const peutEnregistrer = palier >= minimumEnregistrer;
  const peutPublier = palier >= MINIMUMS_STUDIO.publier;
  const peutRestaurer = palier >= MINIMUMS_STUDIO.publier;
  let enregistrer: string | null = null;
  if (!peutEnregistrer) {
    enregistrer = enLigne
      ? `Cette page est en ligne : la modifier change le site. ${explicationPalier(palier, minimumEnregistrer)} L'éditeur est en lecture seule.`
      : `${explicationPalier(palier, minimumEnregistrer)} L'éditeur est en lecture seule.`;
  }
  return {
    peutEnregistrer,
    peutPublier,
    peutRestaurer,
    explications: {
      enregistrer,
      publier: peutPublier ? null : explicationPalier(palier, MINIMUMS_STUDIO.publier),
      restaurer: peutRestaurer ? null : explicationPalier(palier, MINIMUMS_STUDIO.publier),
    },
  };
}

/** Permissions de Puck : tout est fermé en lecture seule (glisser, modifier, ajouter, supprimer, dupliquer). */
export function permissionsEditeur(possibilites: Pick<PossibilitesEditeur, "peutEnregistrer">) {
  const ouvert = possibilites.peutEnregistrer;
  return { drag: ouvert, edit: ouvert, insert: ouvert, delete: ouvert, duplicate: ouvert };
}

/** Texte et ton de la pastille de statut de la page (la pastille « Modifications non enregistrées » s'y ajoute). */
export function libelleStatut(statut: string, version: number): { texte: string; ton: "neutre" | "succes" } {
  if (statut === "publie") return { texte: version > 0 ? `Publiée, version ${version}` : "Publiée", ton: "succes" };
  return { texte: "Brouillon", ton: "neutre" };
}

export const LIBELLE_NON_ENREGISTRE = "Modifications non enregistrées";
