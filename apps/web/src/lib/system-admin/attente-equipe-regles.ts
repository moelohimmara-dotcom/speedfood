import { lireForme, lireStatut, type FormePartenariat, type StatutPartenariat } from "@/lib/site/partenariat";

/**
 * Règles pures de l'espace équipe « Partenariats » et « Liste d'attente » (application) : ce que l'équipe peut faire sans risque et ce qui reste
 * sur le site. Module sans base ni serveur, donc testable seul (voir `scripts/tests/attente-equipe.test.mts`).
 *
 * Les contacts des deux sections sont des données personnelles : la base les rend illisibles à tout navigateur, et chaque lecture ou écriture
 * passe par le serveur avec la permission `attente.gerer` et une trace dans l'audit (sans y écrire les coordonnées).
 */

/** Statuts d'une demande de partenariat, dans l'ordre du parcours. */
export const STATUTS_PARTENARIAT_EQUIPE = ["nouvelle", "en_cours", "traitee", "classee"] as const;

export const LIBELLES_STATUTS_PARTENARIAT: Record<StatutPartenariat, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  traitee: "Traitée",
  classee: "Classée",
};

export function libelleStatutPartenariat(code: string): string {
  return LIBELLES_STATUTS_PARTENARIAT[code as StatutPartenariat] ?? code.replace("_", " ");
}

export function libelleFormePartenariat(code: string): string {
  const formes: Record<FormePartenariat, string> = {
    investir: "Investir",
    soutenir: "Soutenir la communauté",
    moyens: "Apporter des moyens",
    contribuer: "Contribuer",
  };
  return formes[code as FormePartenariat] ?? code.replace("_", " ");
}

/** Statuts proposés pour une demande : tous sauf l'actuel. Une demande « traitée » ou « classée » peut encore changer de statut. */
export function statutsProposesPartenariat(statut: string): StatutPartenariat[] {
  return STATUTS_PARTENARIAT_EQUIPE.filter((s) => s !== statut) as StatutPartenariat[];
}

/** Une demande « nouvelle » n'a pas encore été lue : elle passe avant les autres dans la file de travail. */
export function aTraiterPartenariat(statut: string): boolean {
  return statut === "nouvelle";
}

/** Le statut est-il acceptable côté serveur ? (revalidation, la base a aussi sa contrainte CHECK) */
export function statutPartenariatValide(brut: unknown): StatutPartenariat | null {
  return lireStatut(brut);
}

/** La forme de la demande est-elle acceptable ? */
export function formePartenariatValide(brut: unknown): FormePartenariat | null {
  return lireForme(brut);
}

/** Niveaux de zone de la liste d'attente, du plus large au plus fin. */
export type NiveauAttenteEquipe = "region" | "prefecture" | "commune" | "quartier";

export const LIBELLES_NIVEAU_ATTENTE: Record<NiveauAttenteEquipe, string> = {
  region: "Région",
  prefecture: "Préfecture",
  commune: "Commune",
  quartier: "Quartier",
};

export function libelleNiveauAttente(niveau: string): string {
  return LIBELLES_NIVEAU_ATTENTE[niveau as NiveauAttenteEquipe] ?? niveau;
}

/** Le niveau est-il l'un des quatre acceptés ? (sert à choisir la colonne de la base ; un niveau inconnu est refusé) */
export function niveauAttenteValide(brut: unknown): NiveauAttenteEquipe | null {
  return brut === "region" || brut === "prefecture" || brut === "commune" || brut === "quartier" ? brut : null;
}

/** Combien de personnes de la zone n'ont pas encore été prévenues : c'est la seule action possible sur la zone (les marquer). */
export function nonPrevenues(personnes: number, prevenues: number): number {
  return Math.max(0, personnes - prevenues);
}

/** La zone peut-elle encore être marquée comme prévenue ? (le site désactive le bouton dans ce cas) */
export function zoneAMarquerPrevenue(personnes: number, prevenues: number): boolean {
  return nonPrevenues(personnes, prevenues) > 0;
}

/**
 * Ce que l'équipe peut faire depuis l'application, et ce qui reste sur le site.
 * - La suppression d'une demande de partenariat et la suppression de contacts (zone ou inscription) sont **irréversibles** : elles restent sur le site.
 * - L'export CSV d'une zone sort des coordonnées personnelles : il reste sur le site, où l'export est tracé et téléchargé.
 */
export interface ActionsEquipeAttente {
  /** Voir les demandes, contacter la personne, changer le statut : dans l'application. */
  lireEtSuivrePartenariats: boolean;
  /** Marquer une zone de la liste d'attente comme prévenue : dans l'application (écriture tracée, sans contact). */
  marquerZonePrevenue: boolean;
  /** Supprimer une demande de partenariat : sur le site seulement (irréversible). */
  suppressionPartenariatSurLeSiteSeulement: boolean;
  /** Supprimer les contacts d'une zone ou une inscription : sur le site seulement (irréversible, données personnelles). */
  suppressionContactsSurLeSiteSeulement: boolean;
  /** Exporter les contacts d'une zone : sur le site seulement (sort des données personnelles). */
  exportContactsSurLeSiteSeulement: boolean;
}

export const ACTIONS_EQUIPE_ATTENTE: ActionsEquipeAttente = {
  lireEtSuivrePartenariats: true,
  marquerZonePrevenue: true,
  suppressionPartenariatSurLeSiteSeulement: true,
  suppressionContactsSurLeSiteSeulement: true,
  exportContactsSurLeSiteSeulement: true,
};
