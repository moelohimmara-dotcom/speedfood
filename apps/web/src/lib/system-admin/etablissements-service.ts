import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import type { TraceActionSysteme } from "./audit";
import {
  DUREE_FERMETURE_DEFAUT_HEURES,
  DUREE_SUSPENSION_DEFAUT_HEURES,
  EtatFermeture,
  LIBELLES_TYPE_FERMETURE,
  SaisieFermeture,
  TypeFermeture,
  calculerRepriseLe,
  etatFermeture,
  messagePublicParDefaut,
  messagePublicVisible,
  validerFermeture,
} from "./etablissements-regles";

/**
 * Lot L6 — fermeture et suspension d'un établissement tenu par l'équipe.
 *
 * La décision est VISIBLE PAR LE PUBLIC : elle s'appuie donc sur les colonnes que la fiche publique
 * sait déjà lire, sans rien ajouter au site public.
 * - une suspension passe l'établissement en « commandes en pause » (`accepte_commandes = false`) ;
 * - une fermeture le passe en « fermé » (`ouvert = false`, `accepte_commandes = false`) ;
 * - le message public est affiché dans les consignes de la fiche (`restaurants.consignes`), devant les
 *   consignes habituelles ; la valeur d'origine est mémorisée et restaurée à la levée.
 *
 * Le contrôle de la commande reste côté serveur : `src/lib/commande/calculs.ts` refuse toute commande
 * lorsque `ouvert` est faux ou `accepte_commandes` est faux. Aucune commande ne peut donc passer.
 */

const db = () => creerClientAdmin() as unknown as SupabaseClient;
const LIMITE_ETABLISSEMENTS = 300;
const LIMITE_FERMETURES = 400;

export type ResultatFermeture =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

/** Une fermeture ou une suspension, lue dans la base. */
export interface Fermeture {
  id: string;
  restaurantId: string;
  type: TypeFermeture;
  motif: string;
  messagePublic: string;
  dureeHeures: number;
  repriseLe: Date | null;
  consignePrecedente: string | null;
  ouvertAvant: boolean;
  accepteCommandesAvant: boolean;
  leveLe: Date | null;
  creeLe: Date;
  etat: EtatFermeture;
}

/** Un établissement et la fermeture qui lui est éventuellement appliquée. */
export interface EtablissementEquipe {
  id: string;
  nom: string;
  quartier: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  publie: boolean;
  consignes: string;
  fermetureActive: Fermeture | null;
  /** Nombre de fermetures passées (historique). */
  fermeturesPassees: number;
}

interface LigneRestaurant {
  id: string;
  nom: string;
  quartier_id: string;
  ouvert: boolean;
  accepte_commandes: boolean;
  publie: boolean;
  consignes: string | null;
  neighborhoods: { nom: string }[] | null;
}

interface LigneFermeture {
  id: string;
  restaurant_id: string;
  type_fermeture: string;
  motif: string;
  message_public: string;
  duree_heures: number;
  reprise_le: string | null;
  consigne_precedente: string | null;
  ouvert_avant: boolean;
  accepte_commandes_avant: boolean;
  leve_le: string | null;
  cree_le: string;
}

function lireFermeture(ligne: LigneFermeture, maintenant: Date): Fermeture {
  const type: TypeFermeture = ligne.type_fermeture === "fermeture" ? "fermeture" : "suspension";
  const repriseLe = ligne.reprise_le ? new Date(ligne.reprise_le) : null;
  const leveLe = ligne.leve_le ? new Date(ligne.leve_le) : null;
  return {
    id: ligne.id,
    restaurantId: ligne.restaurant_id,
    type,
    motif: ligne.motif,
    messagePublic: ligne.message_public,
    dureeHeures: ligne.duree_heures,
    repriseLe,
    consignePrecedente: ligne.consigne_precedente,
    ouvertAvant: ligne.ouvert_avant,
    accepteCommandesAvant: ligne.accepte_commandes_avant,
    leveLe,
    creeLe: new Date(ligne.cree_le),
    etat: etatFermeture({ leveLe, repriseLe }, maintenant),
  };
}

/**
 * Les établissements que l'équipe tient (mode de vente « speedfood »), avec leur fermeture en cours
 * et le nombre de fermetures passées.
 */
export async function listerEtablissementsEquipe(): Promise<EtablissementEquipe[]> {
  const base = db();
  const maintenant = new Date();

  const { data: restaurants } = await base
    .from("restaurants")
    .select("id, nom, quartier_id, ouvert, accepte_commandes, publie, consignes, neighborhoods(nom)")
    .eq("mode_vente", "speedfood")
    .order("nom", { ascending: true })
    .limit(LIMITE_ETABLISSEMENTS);

  const liste = (restaurants ?? []) as unknown as LigneRestaurant[];
  if (liste.length === 0) return [];

  const ids = liste.map((r) => r.id);
  const { data: fermetures } = await base
    .from("etablissement_fermetures")
    .select(
      "id, restaurant_id, type_fermeture, motif, message_public, duree_heures, reprise_le, consigne_precedente, ouvert_avant, accepte_commandes_avant, leve_le, cree_le"
    )
    .in("restaurant_id", ids)
    .order("cree_le", { ascending: false })
    .limit(LIMITE_FERMETURES);

  const parResto = new Map<string, { active: Fermeture | null; passees: number }>();
  for (const id of ids) parResto.set(id, { active: null, passees: 0 });
  for (const ligne of (fermetures ?? []) as unknown as LigneFermeture[]) {
    const fermeture = lireFermeture(ligne, maintenant);
    const entree = parResto.get(fermeture.restaurantId);
    if (!entree) continue;
    if (fermeture.leveLe === null && (entree.active === null || fermeture.creeLe.getTime() > entree.active.creeLe.getTime())) {
      entree.active = fermeture;
    } else {
      entree.passees += 1;
    }
  }

  return liste.map((r) => {
    const entree = parResto.get(r.id) ?? { active: null, passees: 0 };
    return {
      id: r.id,
      nom: r.nom,
      quartier: r.neighborhoods?.[0]?.nom ?? "",
      ouvert: r.ouvert,
      accepteCommandes: r.accepte_commandes,
      publie: r.publie,
      consignes: (r.consignes ?? "").trim(),
      fermetureActive: entree.active,
      fermeturesPassees: entree.passees,
    };
  });
}

/** L'historique complet des fermetures d'un établissement. */
export async function listerFermeturesEtablissement(restaurantId: string): Promise<Fermeture[]> {
  if (!estUuid(restaurantId)) return [];
  const base = db();
  const { data } = await base
    .from("etablissement_fermetures")
    .select(
      "id, restaurant_id, type_fermeture, motif, message_public, duree_heures, reprise_le, consigne_precedente, ouvert_avant, accepte_commandes_avant, leve_le, cree_le"
    )
    .eq("restaurant_id", restaurantId)
    .order("cree_le", { ascending: false })
    .limit(LIMITE_FERMETURES);
  const maintenant = new Date();
  return ((data ?? []) as unknown as LigneFermeture[]).map((ligne) => lireFermeture(ligne, maintenant));
}

/** Compose le message public et les consignes habituelles, dans cet ordre. */
function composerConsignes(messagePublic: string, consignePrecedente: string): string {
  const precedent = consignePrecedente.trim();
  return precedent.length === 0 ? messagePublic.trim() : `${messagePublic.trim()}\n\n${precedent}`;
}

/**
 * Ferme ou suspend un établissement.
 *
 * Le motif écrit est obligatoire, la reprise est planifiée, et l'effet public est immédiat :
 * la fiche n'accepte plus de commande, et le message public s'affiche à sa place.
 */
export async function fermerEtablissement(
  restaurantId: string,
  saisie: SaisieFermeture,
  utilisateurId: string
): Promise<ResultatFermeture> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };

  const maintenant = new Date();
  const validation = validerFermeture(saisie, maintenant);
  if (!validation.ok) return { ok: false, message: validation.message };

  const base = db();
  const { data: restaurant } = await base
    .from("restaurants")
    .select("id, nom, ouvert, accepte_commandes, consignes")
    .eq("id", restaurantId)
    .eq("mode_vente", "speedfood")
    .maybeSingle();
  if (!restaurant) {
    return { ok: false, message: "Établissement introuvable : il n'est pas tenu par l'équipe." };
  }

  const { data: fermetures } = await base
    .from("etablissement_fermetures")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .is("leve_le", null)
    .limit(10);
  if ((fermetures ?? []).length > 0) {
    return {
      ok: false,
      message: "Cet établissement est déjà fermé ou suspendu : levez la fermeture en cours avant d'en créer une autre.",
    };
  }

  const consignePrecedente = (restaurant.consignes ?? "").trim();
  const consigneAppliquee = composerConsignes(validation.messagePublic, consignePrecedente);
  const repriseLe = validation.repriseLe ?? calculerRepriseLe(validation.dureeHeures, maintenant);

  const { error: erreurInsert } = await base.from("etablissement_fermetures").insert({
    restaurant_id: restaurantId,
    type_fermeture: validation.type,
    motif: validation.motif,
    message_public: validation.messagePublic,
    duree_heures: validation.dureeHeures,
    reprise_le: repriseLe.toISOString(),
    consigne_precedente: consignePrecedente,
    ouvert_avant: restaurant.ouvert,
    accepte_commandes_avant: restaurant.accepte_commandes,
    leve_le: null,
    leve_par: null,
    cree_par: utilisateurId,
    cree_le: maintenant.toISOString(),
  });
  if (erreurInsert) {
    return { ok: false, message: "Impossible d'enregistrer la fermeture. Réessayez dans un instant." };
  }

  const miseAJour: Record<string, unknown> = {
    accepte_commandes: false,
    consignes: consigneAppliquee,
  };
  if (validation.type === "fermeture") {
    miseAJour.ouvert = false;
  }

  const { error: erreurMaj } = await base.from("restaurants").update(miseAJour).eq("id", restaurantId);
  if (erreurMaj) {
    return { ok: false, message: "Impossible d'appliquer la fermeture. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: `${LIBELLES_TYPE_FERMETURE[validation.type]} appliquée : l'établissement n'accepte plus de commande.`,
    trace: {
      action: "etablissement.fermeture",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: `${LIBELLES_TYPE_FERMETURE[validation.type]} (${validation.dureeHeures} h) — ${validation.motif}`,
    },
  };
}

/**
 * Lève la fermeture en cours : l'établissement retrouve exactement l'état qu'il avait avant la décision
 * (ouvert ou non, commandes acceptées ou non) et ses consignes d'origine.
 *
 * Si les consignes ont été modifiées entre-temps (le restaurant les a retouchées), elles ne sont pas
 * écrasées : la levée laisse la version actuelle en place et le dit.
 */
export async function leverFermeture(
  restaurantId: string,
  motif: string,
  utilisateurId: string
): Promise<ResultatFermeture> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };
  const motifPropre = motif.trim();
  if (motifPropre.length < 5) {
    return { ok: false, message: "Indiquez pourquoi la fermeture est levée (5 caractères minimum)." };
  }
  if (motifPropre.length > 1000) {
    return { ok: false, message: "Le motif ne peut pas dépasser 1000 caractères." };
  }

  const base = db();
  const { data: lignes } = await base
    .from("etablissement_fermetures")
    .select(
      "id, restaurant_id, type_fermeture, motif, message_public, duree_heures, reprise_le, consigne_precedente, ouvert_avant, accepte_commandes_avant, leve_le, cree_le"
    )
    .eq("restaurant_id", restaurantId)
    .is("leve_le", null)
    .order("cree_le", { ascending: false })
    .limit(1);

  const ligne = ((lignes ?? []) as unknown as LigneFermeture[])[0];
  if (!ligne) {
    return { ok: false, message: "Aucune fermeture en cours pour cet établissement." };
  }

  const fermeture = lireFermeture(ligne, new Date());
  const { data: restaurant } = await base
    .from("restaurants")
    .select("id, consignes")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!restaurant) {
    return { ok: false, message: "Établissement introuvable." };
  }

  const consignesAttendues = composerConsignes(fermeture.messagePublic, fermeture.consignePrecedente ?? "");
  const consignesActuelles = (restaurant.consignes ?? "").trim();
  const consignesChangees = consignesActuelles !== consignesAttendues;

  const miseAJour: Record<string, unknown> = {
    ouvert: fermeture.ouvertAvant,
    accepte_commandes: fermeture.accepteCommandesAvant,
  };
  if (!consignesChangees) {
    miseAJour.consignes = fermeture.consignePrecedente ?? "";
  }

  const maintenant = new Date().toISOString();
  const { error: erreurMaj } = await base.from("restaurants").update(miseAJour).eq("id", restaurantId);
  if (erreurMaj) {
    return { ok: false, message: "Impossible de lever la fermeture. Réessayez dans un instant." };
  }

  const { error: erreurLeve } = await base
    .from("etablissement_fermetures")
    .update({ leve_le: maintenant, leve_par: utilisateurId })
    .eq("id", fermeture.id);
  if (erreurLeve) {
    return { ok: false, message: "Impossible d'enregistrer la levée. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: consignesChangees
      ? "Fermeture levée. Les consignes de l'établissement ont été modifiées depuis : elles ont été conservées."
      : "Fermeture levée : l'établissement accepte de nouveau les commandes.",
    trace: {
      action: "etablissement.fermeture_levee",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: `Fermeture levée — ${motifPropre}`,
    },
  };
}

/** Valeurs par défaut affichées dans le formulaire (une seule source : le fichier de règles). */
export function valeursParDefautFermeture(): {
  dureeSuspension: number;
  dureeFermeture: number;
  messageSuspension: string;
  messageFermeture: string;
} {
  return {
    dureeSuspension: DUREE_SUSPENSION_DEFAUT_HEURES,
    dureeFermeture: DUREE_FERMETURE_DEFAUT_HEURES,
    messageSuspension: messagePublicParDefaut("suspension", "Cet établissement"),
    messageFermeture: messagePublicParDefaut("fermeture", "Cet établissement"),
  };
}

/** Le message clients reste-t-il affiché ? (une fermeture levée ne l'est plus) */
export function messageEncoreVisible(fermeture: Fermeture, maintenant: Date): boolean {
  return messagePublicVisible({ leveLe: fermeture.leveLe, repriseLe: fermeture.repriseLe }, maintenant);
}
