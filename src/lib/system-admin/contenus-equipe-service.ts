import "server-only";
import type { ContexteEquipeApi } from "@/lib/api/v1-equipe";
import { lireTout } from "@/lib/db/lecture-complete";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { compterAppareils, derniereAnnonce } from "@/lib/push/annonce-version";
import { MISES_A_JOUR } from "./misesAJourCatalogue";
import {
  filtrerBannieresEquipe,
  fusionnerMisesAJour,
  statutBanniereEquipeValide,
  type FonctionnaliteEtat,
  type MiseAJourEquipe,
} from "./contenus-equipe-regles";

/**
 * Contenu et paramètres de l'administration, lus pour l'application (`/api/v1/equipe/bannieres`, `/medias`, `/mises-a-jour`,
 * `/parametres`). Lecture seule : l'application montre ce qui est en ligne et ce qui est coupé, mais ne publie rien, ne coupe rien et ne
 * change aucun réglage — ces écritures restent sur le site, où elles sont validées, tracées et, pour la publication, immédiates.
 *
 * Les lectures passent par le client lié au jeton de la personne : la RLS s'applique donc exactement comme sur la console du site
 * (`content_banners`, `fonctionnalites`, `parametres_application` ne sont lisibles que par un rôle système).
 */

/** Nombre de bannières renvoyées à l'application : protège le téléphone d'une liste démesurée. */
const LIMITE_BANNERES_EQUIPE = 200;

export interface BanniereEquipe {
  id: string;
  titre: string;
  texte: string;
  lien: string | null;
  statut: "publie" | "brouillon";
  /** Ordre d'affichage sur les écrans publics. */
  ordre: number;
  imageUrl: string | null;
  creeLe: string;
  misAJourLe: string;
}

export interface ResultatBannieresEquipe {
  bannieres: BanniereEquipe[];
  /** Vrai si la liste est incomplète : borne de lecture atteinte. */
  tronque: boolean;
}

/**
 * Les bannières, filtrées par statut côté serveur (comme sur le site). La bibliothèque de médias ajoute la contrainte « a une image ».
 */
export async function listerBannieresEquipe(
  contexte: ContexteEquipeApi,
  filtres: { statut?: unknown; seulementAvecImage?: boolean }
): Promise<ResultatBannieresEquipe> {
  const { data, tronque: tronqueLecture } = await lireTout((de, a) =>
    contexte.supabase
      .from("content_banners")
      .select("id, titre, texte, lien, statut, ordre, image_url, cree_le, mis_a_jour_le")
      .order("ordre", { ascending: true })
      .order("id", { ascending: true })
      .range(de, a)
  );
  if (!data) return { bannieres: [], tronque: true };

  const bannieres = (data as unknown as Array<{
    id: string;
    titre: string;
    texte: string;
    lien: string | null;
    statut: "publie" | "brouillon";
    ordre: number;
    image_url: string | null;
    cree_le: string;
    mis_a_jour_le: string;
  }>).map((banniere) => ({
    id: banniere.id,
    titre: banniere.titre,
    texte: banniere.texte,
    lien: banniere.lien,
    statut: banniere.statut,
    ordre: banniere.ordre,
    imageUrl: banniere.image_url,
    creeLe: banniere.cree_le,
    misAJourLe: banniere.mis_a_jour_le,
  }));

  const retenues = filtrerBannieresEquipe(bannieres, {
    statut: statutBanniereEquipeValide(filtres.statut),
    seulementAvecImage: filtres.seulementAvecImage,
  });

  if (retenues.length > LIMITE_BANNERES_EQUIPE) {
    return { bannieres: retenues.slice(0, LIMITE_BANNERES_EQUIPE), tronque: true };
  }
  return { bannieres: retenues, tronque: tronqueLecture };
}

/** Un interrupteur de fonctionnalité, tel que lu en base. */
export type FonctionnaliteEquipe = FonctionnaliteEtat;

export interface MisesAJourEquipe {
  /** Version de l'application publiée (celle que l'application compare à la sienne). */
  version: { code: number; nom: string; notes: string };
  /** Appareils enregistrés pour les notifications. */
  appareils: number;
  /** Dernière version annoncée aux téléphones, si elle existe. */
  annonce: { versionCode: number; versionNom: string; annonceeLe: string; appareils: number; envoyes: number } | null;
  /** Interrupteurs pilotables, dans l'ordre du catalogue. */
  fonctionnalites: FonctionnaliteEquipe[];
  /** Journal des nouveautés livrées, relié à l'état des interrupteurs. */
  misesAJour: MiseAJourEquipe[];
}

/**
 * L'état des mises à jour : version publiée, dernière annonce, interrupteurs et journal des nouveautés. L'état vient de la base (jamais
 * présumé) ; le journal livré est relié aux interrupteurs par la règle pure `fusionnerMisesAJour`.
 */
export async function lireMisesAJourEquipe(contexte: ContexteEquipeApi): Promise<MisesAJourEquipe> {
  const { data } = await lireTout((de, a) =>
    contexte.supabase
      .from("fonctionnalites")
      .select("cle, libelle, description, groupe, active, mis_a_jour_le")
      .order("ordre", { ascending: true })
      .order("cle", { ascending: true })
      .range(de, a)
  );

  const fonctionnalites = ((data ?? []) as unknown as Array<{
    cle: string;
    libelle: string;
    description: string;
    groupe: string;
    active: boolean;
    mis_a_jour_le: string;
  }>).map((f) => ({
    cle: f.cle,
    libelle: f.libelle,
    description: f.description,
    groupe: f.groupe,
    active: f.active,
    miseAJourLe: f.mis_a_jour_le,
  }));

  const [annonce, appareils] = await Promise.all([derniereAnnonce(), compterAppareils()]);

  return {
    version: { code: VERSION_APPLICATION.code, nom: VERSION_APPLICATION.nom, notes: VERSION_APPLICATION.notes },
    appareils,
    annonce,
    fonctionnalites,
    misesAJour: fusionnerMisesAJour(MISES_A_JOUR, fonctionnalites),
  };
}

export interface ParametresEquipe {
  commandePropositionDelaiMinutes: number;
  prixPlatMaxGnf: number;
  disponibiliteFraicheurHeures: number;
  conservationCoordonneesJours: number;
  conservationNonClotureeJours: number;
  conservationAuditMois: number;
  whatsappAssistance: string;
  delaiValidationHeures: number | null;
  positionCarteActive: boolean;
  promesseSignature: string;
  promesseSousTitre: string;
  promessePartage: string;
  connexionFacebookActive: boolean;
  connexionGoogleActive: boolean;
}

/**
 * Les réglages globaux de l'application, en lecture seule. Les valeurs par défaut sont les mêmes que sur le site : une ligne absente ne
 * doit pas faire croire à un réglage « zéro ».
 *
 * Les colonnes numériques sont converties en entiers : la base peut les renvoyer sous forme décimale, et l'application doit lire un
 * nombre rond (« 30 minutes », pas « 30,0 minutes »).
 */
export async function lireParametresEquipe(contexte: ContexteEquipeApi): Promise<ParametresEquipe> {
  const { data } = await contexte.supabase
    .from("parametres_application")
    .select(
      "commande_proposition_delai_minutes, prix_plat_max_gnf, disponibilite_fraicheur_heures, conservation_coordonnees_jours, conservation_non_cloturee_jours, conservation_audit_mois, whatsapp_assistance, delai_validation_heures, position_carte_active, promesse_signature, promesse_sous_titre, promesse_partage, connexion_facebook_active, connexion_google_active"
    )
    .eq("id", true)
    .single();

  const entier = (valeur: unknown, defaut: number): number => {
    const nombre = Math.round(Number(valeur));
    return Number.isFinite(nombre) ? nombre : defaut;
  };

  return {
    commandePropositionDelaiMinutes: entier(data?.commande_proposition_delai_minutes, 30),
    prixPlatMaxGnf: entier(data?.prix_plat_max_gnf, 5_000_000),
    disponibiliteFraicheurHeures: entier(data?.disponibilite_fraicheur_heures, 6),
    conservationCoordonneesJours: entier(data?.conservation_coordonnees_jours, 90),
    conservationNonClotureeJours: entier(data?.conservation_non_cloturee_jours, 30),
    conservationAuditMois: entier(data?.conservation_audit_mois, 12),
    whatsappAssistance: data?.whatsapp_assistance ?? "",
    delaiValidationHeures: data?.delai_validation_heures == null ? null : entier(data.delai_validation_heures, 0),
    positionCarteActive: data?.position_carte_active ?? false,
    promesseSignature: data?.promesse_signature ?? "",
    promesseSousTitre: data?.promesse_sous_titre ?? "",
    promessePartage: data?.promesse_partage ?? "",
    connexionFacebookActive: data?.connexion_facebook_active ?? false,
    connexionGoogleActive: data?.connexion_google_active ?? false,
  };
}
