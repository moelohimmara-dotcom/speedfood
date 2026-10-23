import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { etatDisponibilite } from "@/lib/disponibilite/etat";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import type { TraceActionSysteme } from "./audit";
import { modeVenteEquipe, validerProfilSimpleEquipe, visibleParLesClients, type ModeVenteEquipe } from "./restaurants-equipe-regles";

/**
 * Établissements de l'équipe dans l'application (`/api/v1/equipe/restaurants/*`) : la fiche de l'établissement (identité, état de
 * publication, horaires, consignes, numéro à joindre), son menu (plats et leur état de disponibilité) et la modification SIMPLE de deux
 * champs sans risque (horaires d'ouverture et numéro interne à joindre pour confirmer les commandes).
 *
 * Volontairement HORS application, parce qu'elles rendent l'établissement visible par les clients ou qu'elles sont irréversibles :
 * la publication (approuver / dépublier), la suspension, la demande de correction, la suppression, la création de fiche et le
 * retrait de la carte. Ces décisions restent sur le site `/system`. Ici on ne montre que l'état, pour décider.
 *
 * Mêmes barrières que le site : permission `restaurant.moderer`, rôle lu en base, RLS appliquée, plafond par compte, audit de chaque
 * écriture. La permission est vérifiée par la route ; ici on ne fait que la logique.
 */
const db = () => creerClientAdmin() as unknown as SupabaseClient;
const LIMITE_RESTOS = 300;
const LIMITE_PLATS = 500;

export type EtatPlatEquipe = "disponible" | "a_confirmer" | "epuise";
export { modeVenteEquipe, validerProfilSimpleEquipe, visibleParLesClients, type ModeVenteEquipe };

export interface RestaurantEquipeResume {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  /** L'établissement est-il visible par les clients ? (lecture seule : la publication reste sur le site) */
  publie: boolean;
  /** L'établissement est-il ouvert (il accepte des commandes) ? */
  ouvert: boolean;
  suspendu: boolean;
  motifCorrection: string | null;
  modeVente: ModeVenteEquipe;
  horaires: string;
  consignes: string;
  /** Numéro interne à joindre pour confirmer les commandes (jamais public). */
  telephoneCommandes: string | null;
  plats: number;
  platsDisponibles: number;
}

export interface PlatFicheEquipe {
  id: string;
  nom: string;
  prix: number;
  disponible: boolean;
  etat: EtatPlatEquipe;
}

export interface FicheRestaurantEquipe extends RestaurantEquipeResume {
  platsDetail: PlatFicheEquipe[];
}

export type ResultatProfilEquipe =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

interface LigneRestaurantEquipe {
  id: string;
  nom: string;
  publie: boolean;
  ouvert: boolean;
  suspendu_le: string | null;
  motif_correction: string | null;
  mode_vente: string | null;
  horaires: string | null;
  consignes: string | null;
  menu_categories: { nom: string }[] | null;
  neighborhoods: { nom: string }[] | null;
}

function modeVente(brut: string | null): ModeVenteEquipe {
  return modeVenteEquipe(brut);
}

async function lireContactsInternes(restaurantIds: string[]): Promise<Map<string, string>> {
  const carte = new Map<string, string>();
  if (restaurantIds.length === 0) return carte;
  const { data } = await db()
    .from("restaurant_contacts_internes")
    .select("restaurant_id, telephone_commandes")
    .in("restaurant_id", restaurantIds)
    .limit(LIMITE_RESTOS);
  for (const ligne of (data ?? []) as unknown as Array<{ restaurant_id: string; telephone_commandes: string }>) {
    carte.set(ligne.restaurant_id, ligne.telephone_commandes);
  }
  return carte;
}

/** Liste des établissements visibles par l'équipe, avec l'état de leur menu. */
export async function listerRestaurantsEquipe(): Promise<RestaurantEquipeResume[]> {
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const base = db();
  const { data } = await base
    .from("restaurants")
    .select(
      "id, nom, publie, ouvert, suspendu_le, motif_correction, mode_vente, horaires, consignes, menu_categories(nom), neighborhoods(nom)",
    )
    .order("nom", { ascending: true })
    .limit(LIMITE_RESTOS);
  const liste = (data ?? []) as unknown as LigneRestaurantEquipe[];
  if (liste.length === 0) return [];

  const ids = liste.map((r) => r.id);
  const [contacts, plats] = await Promise.all([
    lireContactsInternes(ids),
    base.from("menu_items").select("restaurant_id, disponible, disponibilite_confirmee_le").in("restaurant_id", ids).is("archive_le", null).limit(LIMITE_PLATS),
  ]);
  const maintenant = new Date();
  const parResto = new Map<string, { plats: number; disponibles: number }>();
  for (const id of ids) parResto.set(id, { plats: 0, disponibles: 0 });
  for (const p of (plats ?? []) as unknown as Array<{ restaurant_id: string; disponible: boolean; disponibilite_confirmee_le: string | null }>) {
    const compte = parResto.get(p.restaurant_id);
    if (!compte) continue;
    compte.plats += 1;
    const etat = etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant);
    if (etat.type === "disponible") compte.disponibles += 1;
  }

  return liste.map((r) => {
    const compte = parResto.get(r.id) ?? { plats: 0, disponibles: 0 };
    return {
      id: r.id,
      nom: r.nom,
      categorie: r.menu_categories?.[0]?.nom ?? "",
      quartier: r.neighborhoods?.[0]?.nom ?? "",
      publie: r.publie && r.suspendu_le === null,
      ouvert: r.ouvert,
      suspendu: r.suspendu_le !== null,
      motifCorrection: r.motif_correction,
      modeVente: modeVente(r.mode_vente),
      horaires: (r.horaires ?? "").trim(),
      consignes: (r.consignes ?? "").trim(),
      telephoneCommandes: contacts.get(r.id) ?? null,
      plats: compte.plats,
      platsDisponibles: compte.disponibles,
    };
  });
}

/** Fiche d'un établissement : son menu (plats et disponibilité) en plus de la liste. */
export async function lireFicheRestaurantEquipe(restaurantId: string): Promise<FicheRestaurantEquipe | null> {
  if (!estUuid(restaurantId)) return null;
  const base = db();
  const { data } = await base
    .from("restaurants")
    .select(
      "id, nom, publie, ouvert, suspendu_le, motif_correction, mode_vente, horaires, consignes, menu_categories(nom), neighborhoods(nom)",
    )
    .eq("id", restaurantId)
    .maybeSingle();
  const resto = data as unknown as LigneRestaurantEquipe | null;
  if (!resto) return null;

  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const [contacts, plats] = await Promise.all([
    lireContactsInternes([restaurantId]),
    base
      .from("menu_items")
      .select("id, nom, prix, disponible, disponibilite_confirmee_le")
      .eq("restaurant_id", restaurantId)
      .is("archive_le", null)
      .order("cree_le", { ascending: true })
      .limit(LIMITE_PLATS),
  ]);
  const maintenant = new Date();
  const platsDetail = ((plats ?? []) as unknown as Array<{ id: string; nom: string; prix: number; disponible: boolean; disponibilite_confirmee_le: string | null }>).map((p) => ({
    id: p.id,
    nom: p.nom,
    prix: p.prix,
    disponible: p.disponible,
    etat: etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant).type,
  }));

  return {
    id: resto.id,
    nom: resto.nom,
    categorie: resto.menu_categories?.[0]?.nom ?? "",
    quartier: resto.neighborhoods?.[0]?.nom ?? "",
    publie: resto.publie && resto.suspendu_le === null,
    ouvert: resto.ouvert,
    suspendu: resto.suspendu_le !== null,
    motifCorrection: resto.motif_correction,
    modeVente: modeVente(resto.mode_vente),
    horaires: (resto.horaires ?? "").trim(),
    consignes: (resto.consignes ?? "").trim(),
    telephoneCommandes: contacts.get(restaurantId) ?? null,
    plats: platsDetail.length,
    platsDisponibles: platsDetail.filter((p) => p.etat === "disponible").length,
    platsDetail,
  };
}

/**
 * Modification SIMPLE et sans risque : les horaires d'ouverture et le numéro interne à joindre pour confirmer les commandes.
 * Les deux sont réversibles, n'ont aucun effet sur la visibilité par les clients et sont journalisés.
 */
export async function modifierProfilSimpleEquipe(
  restaurantId: string,
  horaires: string,
  telephoneBrut: string,
): Promise<ResultatProfilEquipe> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };
  const validation = validerProfilSimpleEquipe(horaires, telephoneBrut);
  if (!validation.ok) return { ok: false, message: validation.message };
  const horairesPropres = validation.horaires;
  const telephoneNormalise = validation.telephone;

  const base = db();
  const { error: erreurRestaurant } = await base.from("restaurants").update({ horaires: horairesPropres }).eq("id", restaurantId);
  if (erreurRestaurant) return { ok: false, message: "Impossible d'enregistrer les horaires. Réessayez dans un instant." };

  if (telephoneNormalise === null) {
    const { error: erreurSuppression } = await base.from("restaurant_contacts_internes").delete().eq("restaurant_id", restaurantId);
    if (erreurSuppression) return { ok: false, message: "Impossible d'enregistrer le numéro. Réessayez dans un instant." };
  } else {
    const { error: erreurContact } = await base
      .from("restaurant_contacts_internes")
      .upsert({ restaurant_id: restaurantId, telephone_commandes: telephoneNormalise, mis_a_jour_le: new Date().toISOString() });
    if (erreurContact) return { ok: false, message: "Impossible d'enregistrer le numéro. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: "Horaires et numéro à joindre enregistrés.",
    trace: {
      action: "restaurant.profil_modifie",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: telephoneNormalise ? "Horaires et numéro à joindre modifiés par l'équipe." : "Horaires modifiés par l'équipe ; numéro à joindre retiré.",
    },
  };
}
