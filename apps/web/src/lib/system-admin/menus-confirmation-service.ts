import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import type { TraceActionSysteme } from "./audit";
import {
  CompteursMenus,
  DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT,
  EtatMenuEtablissement,
  FenetreRappel,
  HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
  HEURE_SERVICE_DEBUT_DEFAUT,
  LIBELLES_CANAL_RAPPEL,
  SEUIL_FRAICHEUR_HEURES_DEFAUT,
  classerEtatMenu,
  compterMenus,
  evaluerRappel,
  listerEtablissementsAReconfirmer,
  normaliserCanalRappel,
  planifierConfirmationMenu,
  type CanalRappel,
  type EtatMenu,
} from "./menus-confirmation-regles";

/**
 * Lot L5 — rappel de confirmation du menu avant le service.
 *
 * Ce service lit les établissements que l'équipe tient (mode de vente « speedfood »), leur menu et
 * l'historique des rappels, puis prépare la confirmation « en un geste ».
 *
 * Règle de fraîcheur : elle vient de la MÊME source que l'affichage public — la date de confirmation
 * portée par les plats (`menu_items.disponibilite_confirmee_le`). Aucune seconde vérité sur la
 * fraîcheur du menu : ce que l'équipe voit ici est ce que le client voit.
 */

const db = () => creerClientAdmin() as unknown as SupabaseClient;
const LIMITE_ETABLISSEMENTS = 300;
const LIMITE_PLATS = 800;
const LIMITE_RAPPELS = 400;

export type ResultatMenu =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

/** Un établissement et l'état de son menu face à la confirmation du jour. */
export interface FicheMenuEtablissement extends EtatMenuEtablissement {
  /** Numéro interne à joindre pour confirmer le menu (jamais public). */
  telephoneCommandes: string | null;
  /** L'établissement est-il fermé (ouvert = false) ? */
  ferme: boolean;
  /** L'établissement est-il en pause (ne prend plus de commandes) ? */
  enPause: boolean;
  /** État calculé du menu. */
  etat: EtatMenu;
  /** Fenêtre de rappel : le rappel du jour est-il dû ? */
  fenetre: FenetreRappel;
}

export interface TableauMenusConfirmation {
  /** Seuil de fraîcheur appliqué (paramètre global, 6 h par défaut). */
  seuilHeures: number;
  /** Heure de début du service (11 h par défaut). */
  heureService: number;
  /** Heure à laquelle la fenêtre de rappel s'ouvre. */
  heureRappelAvant: number;
  etablissements: FicheMenuEtablissement[];
  /** Établissements dont le menu doit être reconfirmé, triés par urgence. */
  aReconfirmer: FicheMenuEtablissement[];
  compteurs: CompteursMenus;
  /** Rappel du jour dû pour combien d'établissements. */
  rappelsDus: number;
  maintenant: Date;
}

interface LigneRestaurant {
  id: string;
  nom: string;
  quartier_id: string;
  ouvert: boolean;
  accepte_commandes: boolean;
  neighborhoods: { nom: string }[] | null;
}

interface LignePlat {
  restaurant_id: string;
  disponible: boolean;
  disponibilite_confirmee_le: string | null;
}

interface LigneEvenement {
  restaurant_id: string;
  type_evenement: string;
  cree_le: string;
}

/** Seuil de fraîcheur : le paramètre global s'il est lisible, sinon la valeur par défaut du lot. */
export async function seuilFraicheurHeures(): Promise<number> {
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  return disponibiliteFraicheurHeures > 0 ? disponibiliteFraicheurHeures : SEUIL_FRAICHEUR_HEURES_DEFAUT;
}

/**
 * Tableau de bord du lot L5 : les établissements à reconfirmer, la fraîcheur de leur menu,
 * et l'heure à laquelle le rappel du jour est dû.
 */
export async function listerMenusAConfirmer(): Promise<TableauMenusConfirmation> {
  const seuilHeures = await seuilFraicheurHeures();
  const base = db();
  const maintenant = new Date();

  const { data: restaurants } = await base
    .from("restaurants")
    .select("id, nom, quartier_id, ouvert, accepte_commandes, neighborhoods(nom)")
    .eq("mode_vente", "speedfood")
    .order("nom", { ascending: true })
    .limit(LIMITE_ETABLISSEMENTS);

  const liste = (restaurants ?? []) as unknown as LigneRestaurant[];
  if (liste.length === 0) {
    return {
      seuilHeures,
      heureService: HEURE_SERVICE_DEBUT_DEFAUT,
      heureRappelAvant: HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
      etablissements: [],
      aReconfirmer: [],
      compteurs: { etablissements: 0, aConfirmer: 0, platsAConfirmer: 0, confirmes: 0 },
      rappelsDus: 0,
      maintenant,
    };
  }

  const ids = liste.map((r) => r.id);
  const [plats, rappels, contacts] = await Promise.all([
    base
      .from("menu_items")
      .select("restaurant_id, disponible, disponibilite_confirmee_le")
      .in("restaurant_id", ids)
      .is("archive_le", null)
      .limit(LIMITE_PLATS),
    base
      .from("etablissement_menu_confirmations")
      .select("restaurant_id, type_evenement, cree_le")
      .in("restaurant_id", ids)
      .eq("type_evenement", "rappel")
      .order("cree_le", { ascending: false })
      .limit(LIMITE_RAPPELS),
    base
      .from("restaurant_contacts_internes")
      .select("restaurant_id, telephone_commandes")
      .in("restaurant_id", ids)
      .limit(LIMITE_ETABLISSEMENTS),
  ]);

  const parResto = new Map<string, { plats: number; disponibles: number; epuises: number; aConfirmer: number; derniere: Date | null }>();
  for (const id of ids) parResto.set(id, { plats: 0, disponibles: 0, epuises: 0, aConfirmer: 0, derniere: null });
  for (const plat of (plats ?? []) as unknown as LignePlat[]) {
    const compte = parResto.get(plat.restaurant_id);
    if (!compte) continue;
    compte.plats += 1;
    if (!plat.disponible) {
      compte.epuises += 1;
      continue;
    }
    compte.disponibles += 1;
    const confirmeLe = plat.disponibilite_confirmee_le ? new Date(plat.disponibilite_confirmee_le) : null;
    if (confirmeLe && !Number.isNaN(confirmeLe.getTime())) {
      if (!compte.derniere || confirmeLe.getTime() > compte.derniere.getTime()) compte.derniere = confirmeLe;
      const ageHeures = Math.max(0, maintenant.getTime() - confirmeLe.getTime()) / 3_600_000;
      if (ageHeures > seuilHeures) compte.aConfirmer += 1;
    } else {
      compte.aConfirmer += 1;
    }
  }

  const dernierRappel = new Map<string, Date>();
  for (const evenement of (rappels ?? []) as unknown as LigneEvenement[]) {
    const date = new Date(evenement.cree_le);
    if (Number.isNaN(date.getTime())) continue;
    const connue = dernierRappel.get(evenement.restaurant_id);
    if (!connue || date.getTime() > connue.getTime()) dernierRappel.set(evenement.restaurant_id, date);
  }

  const telephoneParResto = new Map<string, string>();
  for (const contact of (contacts ?? []) as unknown as Array<{ restaurant_id: string; telephone_commandes: string }>) {
    telephoneParResto.set(contact.restaurant_id, contact.telephone_commandes);
  }

  const etablissements: FicheMenuEtablissement[] = liste.map((r) => {
    const compte = parResto.get(r.id) ?? { plats: 0, disponibles: 0, epuises: 0, aConfirmer: 0, derniere: null };
    const etat: EtatMenuEtablissement = {
      restaurantId: r.id,
      nom: r.nom,
      quartier: r.neighborhoods?.[0]?.nom ?? "",
      plats: compte.plats,
      platsDisponibles: compte.disponibles,
      platsEpuises: compte.epuises,
      platsAConfirmer: compte.aConfirmer,
      dernierConfirmationLe: compte.derniere,
      dernierRappelLe: dernierRappel.get(r.id) ?? null,
    };
    return {
      ...etat,
      telephoneCommandes: telephoneParResto.get(r.id) ?? null,
      ferme: !r.ouvert,
      enPause: r.ouvert && !r.accepte_commandes,
      etat: classerEtatMenu(etat, seuilHeures, maintenant),
      fenetre: evaluerRappel(etat.dernierRappelLe, maintenant, {
        heureService: HEURE_SERVICE_DEBUT_DEFAUT,
        heureRappelAvant: HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
        dureeRappelHeures: DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT,
      }),
    };
  });

  const aReconfirmer = listerEtablissementsAReconfirmer(etablissements, seuilHeures, maintenant)
    .map((etat) => etablissements.find((e) => e.restaurantId === etat.restaurantId))
    .filter((e): e is FicheMenuEtablissement => e !== undefined);

  return {
    seuilHeures,
    heureService: HEURE_SERVICE_DEBUT_DEFAUT,
    heureRappelAvant: HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
    etablissements,
    aReconfirmer,
    compteurs: compterMenus(etablissements, seuilHeures, maintenant),
    rappelsDus: etablissements.filter((e) => e.fenetre.du && e.etat !== "confirme").length,
    maintenant,
  };
}

/**
 * Confirmation du menu du jour, en un geste.
 *
 * Elle rafraîchit la date de confirmation de TOUS les plats actifs de l'établissement, sans toucher à
 * leur disponibilité : un plat épuisé reste épuisé (la disponibilité se règle plat par plat dans l'écran
 * du menu), mais le menu entier cesse d'être « à confirmer » pour les clients.
 */
export async function confirmerMenuDuJour(restaurantId: string, utilisateurId: string): Promise<ResultatMenu> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };

  const base = db();
  const { data: restaurant } = await base
    .from("restaurants")
    .select("id, nom")
    .eq("id", restaurantId)
    .eq("mode_vente", "speedfood")
    .maybeSingle();
  if (!restaurant) {
    return { ok: false, message: "Établissement introuvable : il n'est pas tenu par l'équipe." };
  }

  const { data: plats } = await base
    .from("menu_items")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null)
    .limit(LIMITE_PLATS);
  const nombrePlats = (plats ?? []).length;

  const plan = planifierConfirmationMenu({ plats: nombrePlats, platsAConfirmer: nombrePlats });
  if (!plan.ok) return { ok: false, message: plan.message };

  const maintenant = new Date().toISOString();
  const { error: erreurMaj } = await base
    .from("menu_items")
    .update({ disponibilite_confirmee_le: maintenant })
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null);
  if (erreurMaj) {
    return { ok: false, message: "Impossible de confirmer le menu. Réessayez dans un instant." };
  }

  const { error: erreurTrace } = await base.from("etablissement_menu_confirmations").insert({
    restaurant_id: restaurantId,
    type_evenement: "confirmation",
    plats_concernes: nombrePlats,
    canal: null,
    cree_par: utilisateurId,
    cree_le: maintenant,
  });
  if (erreurTrace) {
    return { ok: false, message: "Impossible d'enregistrer la confirmation. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: `Menu du jour confirmé : ${nombrePlats} plat${nombrePlats > 1 ? "s" : ""}.`,
    trace: {
      action: "etablissement.menu_confirme",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: `Menu du jour confirmé (${nombrePlats} plats).`,
    },
  };
}

/**
 * Rappel de confirmation : l'équipe prévient l'établissement (notification interne ou appel).
 * Le rappel est tracé (audit + journal des rappels), il ne se perd pas.
 */
export async function enregistrerRappelMenu(
  restaurantId: string,
  canalBrut: string,
  utilisateurId: string
): Promise<ResultatMenu> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };
  const canal: CanalRappel = normaliserCanalRappel(canalBrut);

  const base = db();
  const { data: restaurant } = await base
    .from("restaurants")
    .select("id, nom")
    .eq("id", restaurantId)
    .eq("mode_vente", "speedfood")
    .maybeSingle();
  if (!restaurant) {
    return { ok: false, message: "Établissement introuvable : il n'est pas tenu par l'équipe." };
  }

  const { data: plats } = await base
    .from("menu_items")
    .select("id, disponible, disponibilite_confirmee_le")
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null)
    .limit(LIMITE_PLATS);
  const seuilHeures = await seuilFraicheurHeures();
  const maintenant = new Date();
  const aConfirmer = ((plats ?? []) as unknown as LignePlat[]).filter((plat) => {
    if (!plat.disponible) return false;
    const confirmeLe = plat.disponibilite_confirmee_le ? new Date(plat.disponibilite_confirmee_le) : null;
    if (!confirmeLe || Number.isNaN(confirmeLe.getTime())) return true;
    return (maintenant.getTime() - confirmeLe.getTime()) / 3_600_000 > seuilHeures;
  }).length;

  const { error } = await base.from("etablissement_menu_confirmations").insert({
    restaurant_id: restaurantId,
    type_evenement: "rappel",
    plats_concernes: aConfirmer,
    canal,
    cree_par: utilisateurId,
    cree_le: maintenant.toISOString(),
  });
  if (error) {
    return { ok: false, message: "Impossible d'enregistrer le rappel. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: `Rappel de confirmation enregistré (${LIBELLES_CANAL_RAPPEL[canal].toLowerCase()}).`,
    trace: {
      action: "etablissement.menu_rappel",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: `Rappel de confirmation envoyé par ${LIBELLES_CANAL_RAPPEL[canal].toLowerCase()} (${aConfirmer} plats à reconfirmer).`,
    },
  };
}
