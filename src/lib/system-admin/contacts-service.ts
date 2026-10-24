import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import type { TraceActionSysteme } from "./audit";
import {
  CompteursEcheances,
  LIBELLES_TYPE_CONTACT,
  SaisieContact,
  TypeContact,
  compterEcheances,
  etatEcheance,
  joursDepuis,
  normaliserTypeContact,
  validerContact,
} from "./contacts-regles";

/**
 * Lot L7 — journal des contacts avec l'établissement.
 *
 * Chaque contact est daté, typé, avec un compte rendu. La « prochaine action » porte une échéance :
 * elle est suivie comme un rappel (en retard, aujourd'hui, à venir).
 *
 * Ce journal est un document de travail interne de l'équipe : il reste sur le site `/system`.
 */

const db = () => creerClientAdmin() as unknown as SupabaseClient;
const LIMITE_ETABLISSEMENTS = 300;
const LIMITE_CONTACTS = 400;

export type ResultatContact =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

/** Une ligne du journal. */
export interface ContactEquipe {
  id: string;
  restaurantId: string;
  nomEtablissement: string;
  type: TypeContact;
  compteRendu: string;
  prochaineAction: string;
  echeanceLe: Date | null;
  creeLe: Date;
  /** Ancienneté du contact, en jours. */
  jours: number;
  /** État de l'échéance de la prochaine action. */
  etatEcheance: ReturnType<typeof etatEcheance>;
}

export interface JournalContacts {
  contacts: ContactEquipe[];
  /** Établissements que l'équipe tient (pour le filtre et le formulaire). */
  etablissements: { id: string; nom: string; quartier: string }[];
  compteurs: CompteursEcheances;
  /** Nombre de contacts consignés. */
  total: number;
  maintenant: Date;
}

interface LigneRestaurant {
  id: string;
  nom: string;
  neighborhoods: { nom: string }[] | null;
}

interface LigneContact {
  id: string;
  restaurant_id: string;
  type_contact: string;
  compte_rendu: string;
  prochaine_action: string | null;
  echeance_le: string | null;
  cree_le: string;
}

function dateOuNull(brut: string | null): Date | null {
  if (!brut) return null;
  const date = new Date(brut);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Le journal des contacts, filtrable par établissement.
 * Les échéances en retard remontent en premier : c'est ce que l'équipe doit faire aujourd'hui.
 */
export async function listerJournalContacts(restaurantId?: string): Promise<JournalContacts> {
  const base = db();
  const maintenant = new Date();

  const { data: restaurants } = await base
    .from("restaurants")
    .select("id, nom, neighborhoods(nom)")
    .eq("mode_vente", "speedfood")
    .order("nom", { ascending: true })
    .limit(LIMITE_ETABLISSEMENTS);
  const liste = (restaurants ?? []) as unknown as LigneRestaurant[];

  let requete = base
    .from("etablissement_contacts")
    .select("id, restaurant_id, type_contact, compte_rendu, prochaine_action, echeance_le, cree_le")
    .order("cree_le", { ascending: false })
    .limit(LIMITE_CONTACTS);
  if (restaurantId && estUuid(restaurantId)) {
    requete = requete.eq("restaurant_id", restaurantId);
  }
  const { data: lignes } = await requete;

  const nomParResto = new Map(liste.map((r) => [r.id, r.nom]));
  const contacts: ContactEquipe[] = ((lignes ?? []) as unknown as LigneContact[]).map((ligne) => {
    const type = normaliserTypeContact(ligne.type_contact) ?? "appel";
    const creeLe = dateOuNull(ligne.cree_le) ?? maintenant;
    const echeanceLe = dateOuNull(ligne.echeance_le);
    return {
      id: ligne.id,
      restaurantId: ligne.restaurant_id,
      nomEtablissement: nomParResto.get(ligne.restaurant_id) ?? "Établissement inconnu",
      type,
      compteRendu: ligne.compte_rendu,
      prochaineAction: (ligne.prochaine_action ?? "").trim(),
      echeanceLe,
      creeLe,
      jours: joursDepuis(creeLe, maintenant),
      etatEcheance: etatEcheance(echeanceLe, maintenant),
    };
  });

  const rangEcheance = { en_retard: 0, aujourdhui: 1, a_venir: 2, aucune: 3 } as const;
  contacts.sort((a, b) => {
    const rang = rangEcheance[a.etatEcheance] - rangEcheance[b.etatEcheance];
    if (rang !== 0) return rang;
    return b.creeLe.getTime() - a.creeLe.getTime();
  });

  return {
    contacts,
    etablissements: liste.map((r) => ({ id: r.id, nom: r.nom, quartier: r.neighborhoods?.[0]?.nom ?? "" })),
    compteurs: compterEcheances(contacts, maintenant),
    total: contacts.length,
    maintenant,
  };
}

/** Note un contact avec l'établissement : daté, typé, avec compte rendu et prochaine action. */
export async function enregistrerContact(
  restaurantId: string,
  saisie: SaisieContact,
  utilisateurId: string
): Promise<ResultatContact> {
  if (!estUuid(restaurantId)) return { ok: false, message: "Établissement introuvable." };

  const validation = validerContact(saisie);
  if (!validation.ok) return { ok: false, message: validation.message };

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

  const { error } = await base.from("etablissement_contacts").insert({
    restaurant_id: restaurantId,
    type_contact: validation.type,
    compte_rendu: validation.compteRendu,
    prochaine_action: validation.prochaineAction.length > 0 ? validation.prochaineAction : null,
    echeance_le: validation.echeanceLe ? validation.echeanceLe.toISOString() : null,
    cree_par: utilisateurId,
    cree_le: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, message: "Impossible d'enregistrer le contact. Réessayez dans un instant." };
  }

  return {
    ok: true,
    message: `Contact de type « ${LIBELLES_TYPE_CONTACT[validation.type]} » enregistré.`,
    trace: {
      action: "etablissement.contact_ajoute",
      cibleType: "restaurant",
      cibleId: restaurantId,
      motif: `${LIBELLES_TYPE_CONTACT[validation.type]} — ${validation.compteRendu.slice(0, 300)}`,
    },
  };
}
