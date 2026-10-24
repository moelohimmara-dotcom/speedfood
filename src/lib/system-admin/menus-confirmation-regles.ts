/**
 * Règles pures du lot L5 — rappel de confirmation du menu avant le service.
 *
 * Module sans base ni serveur : il ne fait que calculer la fraîcheur d'un menu,
 * classer les établissements à reconfirmer et dire s'il est utile de relancer.
 * Testé seul (scripts/tests/menus-confirmation.test.mts).
 *
 * VALEURS PAR DÉFAUT DE CE LOT — regroupées ici, un seul endroit à changer :
 * - `SEUIL_FRAICHEUR_HEURES_DEFAUT` : au-delà, une confirmation n'est plus fraîche et le plat passe « à reconfirmer ».
 *   Même valeur que le paramètre global `disponibilite_fraicheur_heures` (6 h) : le service lit le paramètre
 *   s'il existe, cette constante reste le repli documenté.
 * - `HEURE_SERVICE_DEBUT_DEFAUT` : heure de début du service de midi (11 h, heure de Conakry).
 * - `HEURE_RAPPEL_AVANT_SERVICE_DEFAUT` : la fenêtre de rappel s'ouvre ce nombre d'heures avant le service (9 h).
 * - `DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT` : au-delà, un rappel envoyé n'est plus considéré comme un rappel frais (24 h).
 */

export const SEUIL_FRAICHEUR_HEURES_DEFAUT = 6;
export const HEURE_SERVICE_DEBUT_DEFAUT = 11;
export const HEURE_RAPPEL_AVANT_SERVICE_DEFAUT = 2;
export const DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT = 24;

const MS_PAR_HEURE = 3_600_000;

/** État d'un menu d'établissement face à la confirmation du jour. */
export type EtatMenu = "jamais_confirme" | "perime" | "confirme";

/**
 * Ce que sait l'écran sur un établissement : son menu (combien de plats, combien à reconfirmer) et
 * l'historique des confirmations (dernière confirmation, dernier rappel).
 */
export interface EtatMenuEtablissement {
  restaurantId: string;
  nom: string;
  quartier: string;
  /** Nombre de plats actifs (non archivés). */
  plats: number;
  /** Nombre de plats marqués disponibles par le restaurant. */
  platsDisponibles: number;
  /** Nombre de plats épuisés. */
  platsEpuises: number;
  /** Nombre de plats disponibles dont la confirmation est absente ou périmée. */
  platsAConfirmer: number;
  /** Confirmation la plus récente du menu (null = jamais confirmé). */
  dernierConfirmationLe: Date | null;
  /** Dernier rappel envoyé à l'établissement (null = jamais). */
  dernierRappelLe: Date | null;
}

export interface FraicheurMenu {
  /** Ancienneté de la dernière confirmation en heures (null = jamais confirmée). */
  ageHeures: number | null;
  /** Aucune confirmation connue. */
  jamaisConfirme: boolean;
  /** La confirmation est plus ancienne que le seuil. */
  perime: boolean;
  /** Texte prêt à afficher (« Confirmé il y a 3 h », « Jamais confirmé »). */
  libelle: string;
}

/** Ancienneté lisible, sans dépendre de la locale de la machine (le test doit être stable). */
export function libelleAncienneteHeures(ageHeures: number): string {
  if (ageHeures < 1) return "à l'instant";
  if (ageHeures < 24) return `il y a ${Math.floor(ageHeures)} h`;
  const jours = Math.floor(ageHeures / 24);
  return jours === 1 ? "il y a 1 jour" : `il y a ${jours} jours`;
}

/** Fraîcheur de la dernière confirmation connue d'un établissement. */
export function calculerFraicheurMenu(
  dernierConfirmationLe: Date | null,
  seuilHeures: number,
  maintenant: Date
): FraicheurMenu {
  if (dernierConfirmationLe === null) {
    return { ageHeures: null, jamaisConfirme: true, perime: true, libelle: "Jamais confirmé" };
  }
  const ageMs = Math.max(0, maintenant.getTime() - dernierConfirmationLe.getTime());
  const ageHeures = ageMs / MS_PAR_HEURE;
  const perime = ageHeures > seuilHeures;
  return {
    ageHeures,
    jamaisConfirme: false,
    perime,
    libelle: perime
      ? `Confirmé ${libelleAncienneteHeures(ageHeures)} — confirmation périmée`
      : `Confirmé ${libelleAncienneteHeures(ageHeures)}`,
  };
}

/**
 * État du menu d'un établissement.
 * - « jamais_confirme » : aucun plat n'a jamais été confirmé (le service du jour n'a pas eu lieu) ;
 * - « perime » : au moins un plat disponible n'a plus de confirmation fraîche ;
 * - « confirme » : tous les plats disponibles ont une confirmation fraîche (ou l'établissement n'a aucun plat).
 */
export function classerEtatMenu(
  etat: EtatMenuEtablissement,
  seuilHeures: number,
  maintenant: Date
): EtatMenu {
  if (etat.plats === 0) return "confirme";
  const fraicheur = calculerFraicheurMenu(etat.dernierConfirmationLe, seuilHeures, maintenant);
  if (fraicheur.jamaisConfirme) return "jamais_confirme";
  if (etat.platsAConfirmer > 0 || fraicheur.perime) return "perime";
  return "confirme";
}

/** Libellé et ton de l'état, pour l'écran (la pastille porte toujours un texte, jamais la couleur seule). */
export const LIBELLES_ETAT_MENU: Record<EtatMenu, { texte: string; ton: "danger" | "attention" | "succes" }> = {
  jamais_confirme: { texte: "Jamais confirmé", ton: "danger" },
  perime: { texte: "À reconfirmer", ton: "attention" },
  confirme: { texte: "Confirmé", ton: "succes" },
};

/** Un établissement a besoin d'une confirmation dès que son état n'est pas « confirmé ». */
export function doitEtreReconfirme(etat: EtatMenuEtablissement, seuilHeures: number, maintenant: Date): boolean {
  return classerEtatMenu(etat, seuilHeures, maintenant) !== "confirme";
}

/**
 * Liste des établissements à reconfirmer, triée par urgence : jamais confirmé d'abord, puis
 * confirmation périmée ; à égalité, celui qui a le plus de plats à reconfirmer passe devant.
 */
export function listerEtablissementsAReconfirmer(
  etats: readonly EtatMenuEtablissement[],
  seuilHeures: number,
  maintenant: Date
): EtatMenuEtablissement[] {
  const rang: Record<EtatMenu, number> = { jamais_confirme: 0, perime: 1, confirme: 2 };
  return etats
    .filter((etat) => doitEtreReconfirme(etat, seuilHeures, maintenant))
    .sort((a, b) => {
      const etatA = classerEtatMenu(a, seuilHeures, maintenant);
      const etatB = classerEtatMenu(b, seuilHeures, maintenant);
      if (rang[etatA] !== rang[etatB]) return rang[etatA] - rang[etatB];
      if (a.platsAConfirmer !== b.platsAConfirmer) return b.platsAConfirmer - a.platsAConfirmer;
      return a.nom.localeCompare(b.nom, "fr");
    });
}

export interface CompteursMenus {
  /** Établissements de l'équipe tous confondus. */
  etablissements: number;
  /** Établissements dont le menu doit être reconfirmé. */
  aConfirmer: number;
  /** Plats disponibles à reconfirmer, tous établissements confondus. */
  platsAConfirmer: number;
  /** Établissements dont le menu est frais. */
  confirmes: number;
}

/** Compteurs de tête d'écran. */
export function compterMenus(
  etats: readonly EtatMenuEtablissement[],
  seuilHeures: number,
  maintenant: Date
): CompteursMenus {
  let aConfirmer = 0;
  let platsAConfirmer = 0;
  let confirmes = 0;
  for (const etat of etats) {
    if (doitEtreReconfirme(etat, seuilHeures, maintenant)) {
      aConfirmer++;
      platsAConfirmer += etat.platsAConfirmer;
    } else {
      confirmes++;
    }
  }
  return { etablissements: etats.length, aConfirmer, platsAConfirmer, confirmes };
}

export interface OptionsRappel {
  /** Heure de début du service (0–23). */
  heureService: number;
  /** La fenêtre de rappel s'ouvre ce nombre d'heures avant le service. */
  heureRappelAvant: number;
  /** Un rappel plus ancien que ce nombre d'heures est considéré comme périmé. */
  dureeRappelHeures: number;
}

export interface FenetreRappel {
  /** Un rappel est dû : la fenêtre avant le service est ouverte. */
  du: boolean;
  /** Un rappel a déjà été envoyé et il est encore frais. */
  rappelRecent: boolean;
  /** Un rappel a été envoyé mais il est périmé. */
  rappelPerime: boolean;
  /** Texte prêt à afficher. */
  libelle: string;
}

/**
 * Évalue la fenêtre de rappel d'un établissement.
 * La fenêtre s'ouvre `heureRappelAvant` heures avant le service et reste ouverte jusqu'au lendemain :
 * à 9 h pour un service de 11 h, le rappel du jour est dû ; à 8 h, il ne l'est pas encore.
 */
export function evaluerRappel(
  dernierRappelLe: Date | null,
  maintenant: Date,
  options: OptionsRappel
): FenetreRappel {
  const heureActuelle = maintenant.getHours();
  const du = heureActuelle >= options.heureService - options.heureRappelAvant;

  if (dernierRappelLe === null) {
    return { du, rappelRecent: false, rappelPerime: false, libelle: "Aucun rappel envoyé" };
  }
  const ageHeures = Math.max(0, maintenant.getTime() - dernierRappelLe.getTime()) / MS_PAR_HEURE;
  const rappelRecent = ageHeures <= options.dureeRappelHeures;
  return {
    du,
    rappelRecent,
    rappelPerime: !rappelRecent,
    libelle: rappelRecent
      ? `Rappel envoyé ${libelleAncienneteHeures(ageHeures)}`
      : `Rappel ancien (${libelleAncienneteHeures(ageHeures)})`,
  };
}

export type ResultatPlanConfirmation = { ok: true; plats: number } | { ok: false; message: string };

/**
 * Vérifie qu'une confirmation « en un geste » a du sens : un établissement sans plat actif
 * n'a rien à confirmer, on ne lui propose donc pas le bouton.
 */
export function planifierConfirmationMenu(etat: {
  plats: number;
  platsAConfirmer: number;
}): ResultatPlanConfirmation {
  if (etat.plats === 0) {
    return { ok: false, message: "Cet établissement n'a aucun plat actif : il n'y a rien à confirmer." };
  }
  return { ok: true, plats: etat.plats };
}

/** Canaux de rappel proposés à l'équipe. */
export const CANAUX_RAPPEL = ["interne", "appel"] as const;
export type CanalRappel = (typeof CANAUX_RAPPEL)[number];

export const LIBELLES_CANAL_RAPPEL: Record<CanalRappel, string> = {
  interne: "Notification interne",
  appel: "Appel téléphonique",
};

/** Un canal de rappel inconnu n'est jamais accepté tel quel. */
export function normaliserCanalRappel(brut: string | null | undefined): CanalRappel {
  return brut === "appel" ? "appel" : "interne";
}
