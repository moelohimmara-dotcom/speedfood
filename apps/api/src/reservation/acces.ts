import type { SupabaseClient } from "@supabase/supabase-js";
import { projeterReservationClient, type ReglageReservation, type ReservationClient, type ValeursReglageReservation } from "@speedfood/shared/contracts/reservation";
import type { StatutReservation } from "@speedfood/shared/reservation/statuts";
import type { PortsReservationClient, ResultatCreationAtomique, ResultatEcriture } from "./client.ts";
import { estCodeRefusCreation } from "./regles.ts";
import type { LigneReservationRestaurant, PortsReservationRestaurant } from "./restaurateur.ts";

/**
 * Accès à la table `reservations_table` (et aux deux réglages de `restaurants`) : les PORTS des services, branchés sur Supabase.
 *
 *  - JAMAIS `select *` : chaque requête liste ses colonnes (la table interdit d'ailleurs `select *` aux comptes connectés, la colonne du condensé du jeton leur étant fermée). Aucune requête ne
 *    nomme cette colonne : ni lue, ni écrite, ni renvoyée (une réservation d'un invité n'existe pas dans ce lot).
 *  - Côté CLIENT, le client fourni est celui du SERVEUR (clé de service : la table n'a ni INSERT ni UPDATE pour un compte, et l'annulation par le client est réservée au serveur par la base) ; c'est
 *    pourquoi chaque requête pose elle-même le filtre `client_user_id` : la RLS ne protège pas ici. La CRÉATION passe par la fonction SQL `fn_creer_reservation_atomique` (lot M5), exécutable par le
 *    seul rôle de service ; elle fait elle-même les contrôles de capacité, de plafond, de doublon et de rejeu.
 *  - Côté RESTAURATEUR, le client fourni est celui du JETON du membre (RLS appliquée, `traitee_par` posé par la base), et chaque requête filtre en plus sur le restaurant du contexte.
 *  - Aucune erreur de la base n'est journalisée ni renvoyée telle quelle (ni téléphone, ni note, ni détail SQL) : les ports rendent l'erreur brute au service, qui la traduit.
 */

export const COLONNES_RESERVATION_CLIENT = "id, reference, restaurant_id, nom_client, telephone, nb_personnes, creneau, note, statut, motif_refus, cree_le, restaurants(nom)";
export const COLONNES_RESERVATION_RESTAURANT = "id, reference, nom_client, telephone, nb_personnes, creneau, note, statut, motif_refus, cree_le";
export const COLONNES_DISPONIBILITE_RESERVATION = "publie, suspendu_le, accepte_reservation";
export const COLONNES_REGLAGE_RESERVATION = "accepte_reservation, reservation_capacite_couverts";
const TABLE = "reservations_table";
const STATUTS_ACTIFS = ["demandee", "confirmee"];
/** Garde-fous de taille des lectures (le Worker a un budget de CPU limité). */
const LIMITE_LISTE_CLIENT = 50;
const LIMITE_RESTAURANT = 200;

type Relation<T> = T | T[] | null;
const un = <T>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);
type Ligne = Record<string, unknown>;
const iso = (v: unknown): unknown => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : v);

function versReservationClient(ligne: Ligne): ReservationClient {
  const restaurant = un(ligne.restaurants as Relation<{ nom?: unknown }>);
  const reservation = projeterReservationClient({
    id: ligne.id,
    reference: ligne.reference,
    restaurantId: ligne.restaurant_id,
    restaurantNom: restaurant?.nom,
    creneau: iso(ligne.creneau),
    nbPersonnes: ligne.nb_personnes,
    nom: ligne.nom_client,
    telephone: ligne.telephone,
    note: ligne.note ?? null,
    statut: ligne.statut,
    motif: ligne.motif_refus ?? null,
    creeLe: iso(ligne.cree_le),
  });
  // Une ligne douteuse est une panne (500), jamais une réservation inventée ou tronquée.
  if (!reservation) throw new Error("RESERVATION_ILLISIBLE");
  return reservation;
}

function versLigneRestaurant(ligne: Ligne): LigneReservationRestaurant {
  // Même projection stricte que la réponse : on réutilise la lecture du client avec un nom de restaurant factice, puis on retire ce champ.
  const lue = versReservationClient({ ...ligne, restaurant_id: "00000000-0000-4000-8000-000000000000", restaurants: { nom: "-" } });
  const { restaurantId: _restaurantId, restaurantNom: _restaurantNom, ...reste } = lue;
  return reste;
}

/** Ports côté CLIENT : `client()` rend le client du SERVEUR (clé de service). */
export function creerAccesReservationClient(d: { client(): SupabaseClient }): Omit<PortsReservationClient, "maintenant"> {
  const lireListe = async (utilisateurId: string): Promise<ReservationClient[]> => {
    const { data, error } = await d.client()
      .from(TABLE)
      .select(COLONNES_RESERVATION_CLIENT)
      .eq("client_user_id", utilisateurId)
      .order("cree_le", { ascending: false })
      .order("id", { ascending: true })
      .limit(LIMITE_LISTE_CLIENT);
    if (error) throw new Error("RESERVATIONS_INDISPONIBLES");
    return ((data ?? []) as unknown as Ligne[]).map(versReservationClient);
  };
  return {
    async lireDisponibilite(id) {
      const { data, error } = await d.client().from("restaurants").select(COLONNES_DISPONIBILITE_RESERVATION).eq("id", id).maybeSingle();
      if (error) throw new Error("RESTAURANT_INDISPONIBLE");
      if (!data) return null;
      const r = data as unknown as Ligne;
      return { publie: r.publie === true, suspendu: r.suspendu_le !== null && r.suspendu_le !== undefined, accepteReservation: r.accepte_reservation === true };
    },
    async creerAtomique(ligne): Promise<ResultatCreationAtomique> {
      // UNE fonction SQL (lot M5) : verrous, rejeu, fenêtre, restaurant, plafond, doublon, capacité et insertion dans la même transaction. Arguments nommés, un par un : jamais un objet recopié en bloc.
      // Le compte est celui du jeton (posé par le service) ; le restaurant est relu en base par la fonction. Aucun jeton de suivi.
      const { data, error } = await d.client().rpc("fn_creer_reservation_atomique", {
        p_client_user_id: ligne.clientUserId,
        p_restaurant_id: ligne.restaurantId,
        p_nom: ligne.nom,
        p_telephone: ligne.telephone,
        p_nb_personnes: ligne.nbPersonnes,
        p_creneau: ligne.creneau,
        p_note: ligne.note,
      });
      if (error) return { ok: false as const, genre: "base" as const, erreur: { code: error.code, message: error.message } };
      return lireReponseCreation(data);
    },
    lister: lireListe,
    async lire(utilisateurId, id) {
      const { data, error } = await d.client().from(TABLE).select(COLONNES_RESERVATION_CLIENT).eq("id", id).eq("client_user_id", utilisateurId).maybeSingle();
      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");
      return data ? versReservationClient(data as unknown as Ligne) : null;
    },
    async annuler(utilisateurId, id) {
      const { data, error } = await d.client()
        .from(TABLE)
        .update({ statut: "annulee_client" })
        .eq("id", id)
        .eq("client_user_id", utilisateurId)
        .in("statut", STATUTS_ACTIFS)
        .select(COLONNES_RESERVATION_CLIENT);
      if (error) return { ok: false as const, genre: "base" as const, erreur: { code: error.code, message: error.message } };
      const lignes = (data ?? []) as unknown as Ligne[];
      return lignes.length === 0 ? { ok: false as const, genre: "aucune_ligne" as const } : { ok: true as const, ligne: versReservationClient(lignes[0]) };
    },
  };
}

/** Lecture STRICTE de la réponse de la fonction SQL : une forme douteuse est une panne (500 générique), jamais une réservation inventée ni un refus deviné. */
export function lireReponseCreation(brute: unknown): ResultatCreationAtomique {
  const o = typeof brute === "object" && brute !== null && !Array.isArray(brute) ? (brute as Ligne) : null;
  if (!o) throw new Error("RESERVATION_ILLISIBLE");
  if (o.etat === "refus") {
    if (!estCodeRefusCreation(o.code)) throw new Error("RESERVATION_ILLISIBLE");
    return { ok: false, genre: "refus", code: o.code };
  }
  if (o.etat !== "creee" && o.etat !== "rejeu") throw new Error("RESERVATION_ILLISIBLE");
  if (typeof o.reservation !== "object" || o.reservation === null || Array.isArray(o.reservation)) throw new Error("RESERVATION_ILLISIBLE");
  return { ok: true, etat: o.etat, reservation: versReservationClient(o.reservation as Ligne) };
}

/** Ports côté RESTAURATEUR : chaque fonction reçoit le client du JETON du membre. */
export function creerAccesReservationRestaurant(): Omit<PortsReservationRestaurant, "maintenant"> {
  const db = (client: unknown) => client as SupabaseClient;
  return {
    async lireDuJour(client, restaurantId, debut, fin) {
      const { data, error } = await db(client)
        .from(TABLE)
        .select(COLONNES_RESERVATION_RESTAURANT)
        .eq("restaurant_id", restaurantId)
        .gte("creneau", debut.toISOString())
        .lt("creneau", fin.toISOString())
        .order("creneau", { ascending: true })
        .order("id", { ascending: true })
        .limit(LIMITE_RESTAURANT);
      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");
      return ((data ?? []) as unknown as Ligne[]).map(versLigneRestaurant);
    },
    async lireDemandesAVenir(client, restaurantId, maintenant) {
      const { data, error } = await db(client)
        .from(TABLE)
        .select(COLONNES_RESERVATION_RESTAURANT)
        .eq("restaurant_id", restaurantId)
        .eq("statut", "demandee")
        .gte("creneau", maintenant.toISOString())
        .order("creneau", { ascending: true })
        .order("id", { ascending: true })
        .limit(LIMITE_RESTAURANT);
      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");
      return ((data ?? []) as unknown as Ligne[]).map(versLigneRestaurant);
    },
    async lire(client, restaurantId, id) {
      const { data, error } = await db(client).from(TABLE).select(COLONNES_RESERVATION_RESTAURANT).eq("id", id).eq("restaurant_id", restaurantId).maybeSingle();
      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");
      return data ? versLigneRestaurant(data as unknown as Ligne) : null;
    },
    async ecrireStatut(client, restaurantId, id, ancien: StatutReservation, nouveau: StatutReservation, motif): Promise<ResultatEcriture<LigneReservationRestaurant>> {
      // Colonnes permises au restaurateur : statut et motif, rien d'autre (qui a traité et quand sont posés par la base).
      const maj: { statut: StatutReservation; motif_refus?: string } = { statut: nouveau };
      if (motif !== null) maj.motif_refus = motif;
      const { data, error } = await db(client)
        .from(TABLE)
        .update(maj)
        .eq("id", id)
        .eq("restaurant_id", restaurantId)
        .eq("statut", ancien)
        .select(COLONNES_RESERVATION_RESTAURANT);
      if (error) return { ok: false, genre: "base", erreur: { code: error.code, message: error.message } };
      const lignes = (data ?? []) as unknown as Ligne[];
      return lignes.length === 0 ? { ok: false, genre: "aucune_ligne" } : { ok: true, ligne: versLigneRestaurant(lignes[0]) };
    },
    async lireReglage(client, restaurantId) {
      const { data, error } = await db(client).from("restaurants").select(COLONNES_REGLAGE_RESERVATION).eq("id", restaurantId).maybeSingle();
      return error || !data ? null : versReglage(data as unknown as Ligne);
    },
    async ecrireReglage(client, restaurantId, valeurs: ValeursReglageReservation): Promise<ResultatEcriture<ReglageReservation>> {
      const maj: { accepte_reservation?: boolean; reservation_capacite_couverts?: number | null } = {};
      if (valeurs.accepteReservation !== undefined) maj.accepte_reservation = valeurs.accepteReservation;
      if (valeurs.capaciteCouverts !== undefined) maj.reservation_capacite_couverts = valeurs.capaciteCouverts;
      if (Object.keys(maj).length === 0) return { ok: false, genre: "aucune_ligne" };
      const { data, error } = await db(client).from("restaurants").update(maj).eq("id", restaurantId).select(COLONNES_REGLAGE_RESERVATION);
      if (error) return { ok: false, genre: "base", erreur: { code: error.code, message: error.message } };
      const lignes = (data ?? []) as unknown as Ligne[];
      return lignes.length === 0 ? { ok: false, genre: "aucune_ligne" } : { ok: true, ligne: versReglage(lignes[0]) };
    },
  };
}

function versReglage(l: Ligne): ReglageReservation {
  const c = l.reservation_capacite_couverts;
  return { accepteReservation: l.accepte_reservation === true, capaciteCouverts: typeof c === "number" ? c : null };
}
