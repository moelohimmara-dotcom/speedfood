/**
 * Règles pures de l'espace équipe « Contenu et paramètres » (application) : ce que l'application LIT — bannières, bibliothèque de
 * médias, état des interrupteurs de fonctionnalité, réglages globaux — et ce qui reste sur le site. Module sans base ni serveur, donc
 * testable seul (voir `scripts/tests/contenus-equipe.test.mts`).
 *
 * L'application ne modifie rien de tout cela : publier une bannière, basculer un interrupteur ou changer un réglage global change ce
 * que voit le public ; cela reste donc sur le site, comme la publication d'un restaurant (règle produit du lot « parité équipe »).
 */

/** Filtre de statut des bannières. `tous` = aucun filtrage. */
export type StatutBanniereEquipe = "tous" | "publie" | "brouillon";

/** Ordre d'affichage des filtres (comme sur le site). */
export const STATUTS_BANNERE_EQUIPE: readonly StatutBanniereEquipe[] = ["tous", "publie", "brouillon"];

export const LIBELLES_STATUT_BANNERE: Record<StatutBanniereEquipe, string> = {
  tous: "Toutes",
  publie: "Publiées",
  brouillon: "Brouillons",
};

/** Un filtre inconnu retombe sur « Toutes » : jamais de valeur devinée, jamais de liste vide surprise. */
export function statutBanniereEquipeValide(brut: unknown): StatutBanniereEquipe {
  return STATUTS_BANNERE_EQUIPE.includes(brut as StatutBanniereEquipe) ? (brut as StatutBanniereEquipe) : "tous";
}

/** Libellé lisible d'un statut de bannière (pour une bannière, pas pour un filtre). */
export function libelleStatutBanniereEquipe(statut: string): string {
  if (statut === "publie") return "Publiée";
  if (statut === "brouillon") return "Brouillon";
  return statut;
}

/** Ce qu'il faut pour filtrer une bannière : son statut et son image. */
export interface BanniereEquipeFiltrable {
  statut: string;
  imageUrl: string | null;
}

/**
 * Filtre les bannières : par statut, et (pour la bibliothèque de médias) sur la présence d'une image. La bibliothèque « Médias » du site
 * liste exactement les bannières qui ont une image : même règle ici, pour que l'application et le site racontent la même chose.
 */
export function filtrerBannieresEquipe<T extends BanniereEquipeFiltrable>(
  bannieres: readonly T[],
  filtres: { statut?: unknown; seulementAvecImage?: boolean }
): T[] {
  const statut = statutBanniereEquipeValide(filtres.statut);
  return bannieres.filter((banniere) => {
    if (filtres.seulementAvecImage && !banniere.imageUrl) return false;
    if (statut === "publie") return banniere.statut === "publie";
    if (statut === "brouillon") return banniere.statut === "brouillon";
    return true;
  });
}

/** Groupes d'interrupteurs de fonctionnalité, comme sur le site. */
export const LIBELLES_GROUPE_FONCTIONNALITE: Record<string, string> = {
  public: "Site public",
  commande: "Commande",
  restaurant: "Console restaurant",
};

/** Libellé d'un groupe d'interrupteur ; un groupe inconnu est affiché tel quel. */
export function libelleGroupeFonctionnalite(groupe: string | null | undefined): string {
  if (!groupe) return "Autres";
  return LIBELLES_GROUPE_FONCTIONNALITE[groupe] ?? groupe;
}

/** État d'une fonctionnalité : « Active » ou « Coupée ». */
export function libelleEtatFonctionnalite(active: boolean): string {
  return active ? "Active" : "Coupée";
}

// --- Mises à jour ------------------------------------------------------------

/** Une entrée du journal des mises à jour livrées (catalogue du site). */
export interface MiseAJourCatalogue {
  id: string;
  date: string;
  titre: string;
  resume: string;
  /** Interrupteur associé, s'il existe. */
  cle?: string;
  /** Pourquoi il n'y a pas d'interrupteur. */
  sansInterrupteur?: string;
  /** Comment vérifier que la mise à jour fonctionne. */
  verification: string;
}

/** Un interrupteur de fonctionnalité, tel que lu en base. */
export interface FonctionnaliteEtat {
  cle: string;
  libelle: string;
  description: string;
  groupe: string;
  active: boolean;
  miseAJourLe: string;
}

/** Une mise à jour, une fois reliée à son interrupteur. */
export interface MiseAJourEquipe {
  id: string;
  date: string;
  titre: string;
  resume: string;
  verification: string;
  /** Interrupteur associé, `null` quand la mise à jour n'en a pas. */
  cle: string | null;
  /** État de l'interrupteur ; `null` quand la mise à jour n'en a pas (« toujours active »). */
  active: boolean | null;
  /** Pourquoi il n'y a pas d'interrupteur. */
  raisonSansInterrupteur: string | null;
  /** Groupe de l'interrupteur, pour l'affichage. */
  groupe: string | null;
}

/**
 * Relie le journal des mises à jour à l'état réel des interrupteurs lu en base. Sans `cle`, la mise à jour n'a pas d'interrupteur : elle
 * est « toujours active » et la raison donnée sur le site est conservée. Un interrupteur annoncé mais absent de la base est traité
 * comme inexistant — jamais comme actif par défaut.
 */
export function fusionnerMisesAJour(
  catalogue: readonly MiseAJourCatalogue[],
  fonctionnalites: readonly FonctionnaliteEtat[]
): MiseAJourEquipe[] {
  const parCle = new Map(fonctionnalites.map((f) => [f.cle, f]));
  return catalogue.map((entree) => {
    const f = entree.cle ? parCle.get(entree.cle) : undefined;
    return {
      id: entree.id,
      date: entree.date,
      titre: entree.titre,
      resume: entree.resume,
      verification: entree.verification,
      cle: f ? f.cle : null,
      active: f ? f.active : null,
      raisonSansInterrupteur: f ? null : (entree.sansInterrupteur ?? "Cette fonctionnalité n'est pas encore enregistrée dans la base."),
      groupe: f ? f.groupe : null,
    };
  });
}

// --- Paramètres --------------------------------------------------------------

/** Nature d'un réglage, pour que l'application sache comment l'afficher. */
export type NatureParametreEquipe = "duree" | "montant" | "nombre" | "texte" | "contact" | "interrupteur";

export interface DescriptionParametreEquipe {
  cle: string;
  libelle: string;
  nature: NatureParametreEquipe;
}

/** Les réglages globaux affichés dans l'application, dans l'ordre de la page `/system/parametres`. */
export const PARAMETRES_EQUIPE: readonly DescriptionParametreEquipe[] = [
  { cle: "commandePropositionDelaiMinutes", libelle: "Délai de proposition d'une commande", nature: "duree" },
  { cle: "prixPlatMaxGnf", libelle: "Plafond de prix d'un plat", nature: "montant" },
  { cle: "disponibiliteFraicheurHeures", libelle: "Durée de fraîcheur de la disponibilité", nature: "duree" },
  { cle: "conservationCoordonneesJours", libelle: "Conservation des coordonnées", nature: "duree" },
  { cle: "conservationNonClotureeJours", libelle: "Conservation d'une commande non clôturée", nature: "duree" },
  { cle: "conservationAuditMois", libelle: "Conservation du journal d'audit", nature: "duree" },
  { cle: "whatsappAssistance", libelle: "WhatsApp d'assistance", nature: "contact" },
  { cle: "delaiValidationHeures", libelle: "Délai de validation annoncé", nature: "duree" },
  { cle: "positionCarteActive", libelle: "Bouton « Utiliser ma position »", nature: "interrupteur" },
  { cle: "connexionFacebookActive", libelle: "Connexion Facebook", nature: "interrupteur" },
  { cle: "connexionGoogleActive", libelle: "Connexion Google", nature: "interrupteur" },
  { cle: "promesseSignature", libelle: "Signature d'accueil", nature: "texte" },
  { cle: "promesseSousTitre", libelle: "Sous-titre d'accueil", nature: "texte" },
  { cle: "promessePartage", libelle: "Texte de partage", nature: "texte" },
];

/**
 * Ce que l'équipe peut faire depuis l'application, et ce qui reste sur le site.
 * - Consulter les bannières, la bibliothèque de médias, l'état des mises à jour et les réglages : dans l'application (lecture seule).
 * - Créer, publier ou supprimer une bannière : sur le site (une bannière publiée change ce que voit le public).
 * - Basculer un interrupteur ou annoncer une version : sur le site (effet immédiat sur le public).
 * - Modifier un réglage global : sur le site (formulaire validé, tracé au journal d'audit).
 * - Les éditeurs de pages, de textes et de design : sur le site (outils de composition, sans équivalent sur téléphone).
 */
export interface ActionsEquipeContenus {
  /** Consulter les bannières et filtrer par statut : dans l'application. */
  lireBannieres: boolean;
  /** Consulter la bibliothèque de médias : dans l'application. */
  lireMedias: boolean;
  /** Créer une bannière : sur le site seulement (effet public). */
  creationBanniereSurLeSiteSeulement: boolean;
  /** Publier ou dépublier une bannière : sur le site seulement (effet public). */
  publicationBanniereSurLeSiteSeulement: boolean;
  /** Supprimer une bannière : sur le site seulement (destructif). */
  suppressionBanniereSurLeSiteSeulement: boolean;
  /** Basculer un interrupteur de fonctionnalité : sur le site seulement (effet public immédiat). */
  basculeInterrupteurSurLeSiteSeulement: boolean;
  /** Annoncer une version aux téléphones : sur le site seulement (envoie des notifications). */
  annonceVersionSurLeSiteSeulement: boolean;
  /** Modifier un réglage global : sur le site seulement (formulaire validé et tracé). */
  modificationParametresSurLeSiteSeulement: boolean;
  /** Composer les pages et les textes du site : sur le site seulement (éditeur). */
  editionPagesEtTextesSurLeSiteSeulement: boolean;
  /** Composer le design (jetons) : sur le site seulement (éditeur). */
  editionDesignSurLeSiteSeulement: boolean;
}

export const ACTIONS_EQUIPE_CONTENUS: ActionsEquipeContenus = {
  lireBannieres: true,
  lireMedias: true,
  creationBanniereSurLeSiteSeulement: true,
  publicationBanniereSurLeSiteSeulement: true,
  suppressionBanniereSurLeSiteSeulement: true,
  basculeInterrupteurSurLeSiteSeulement: true,
  annonceVersionSurLeSiteSeulement: true,
  modificationParametresSurLeSiteSeulement: true,
  editionPagesEtTextesSurLeSiteSeulement: true,
  editionDesignSurLeSiteSeulement: true,
};
