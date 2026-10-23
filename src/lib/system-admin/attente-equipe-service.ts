import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireTout } from "@/lib/db/lecture-complete";
import type { TraceActionSysteme } from "./audit";
import {
  formePartenariatValide,
  niveauAttenteValide,
  statutPartenariatValide,
  type NiveauAttenteEquipe,
} from "./attente-equipe-regles";

/**
 * Partenariats et liste d'attente dans l'application (`/api/v1/equipe/partenariats/*` et `/api/v1/equipe/liste-attente/*`).
 *
 * Les deux sections portent des données personnelles : la base les rend illisibles à tout navigateur, et tout passe ici par le client
 * d'administration, après vérification de la permission `attente.gerer` par la route. Les coordonnées ne sont jamais écrites dans le journal
 * d'audit.
 *
 * Volontairement HORS application, parce qu'elles sont irréversibles ou sortent des données personnelles : la suppression d'une demande de
 * partenariat, la suppression des contacts d'une zone ou d'une inscription, et l'export CSV d'une zone. Ces trois actions restent sur le site
 * `/system/catalogue`. Ici on lit, on contacte la personne et on fait avancer le suivi.
 */
const db = () => creerClientAdmin() as unknown as SupabaseClient;

/** Bornes de lecture : une page d'administration, pas un export. */
const LIMITE_PARTENARIATS = 200;
const LIMITE_ZONES = 500;

export interface PartenariatEquipe {
  id: string;
  /** Forme de la demande : investir, soutenir, moyens, contribuer. */
  forme: string;
  organisation: string;
  nomContact: string;
  contactType: "email" | "telephone";
  contact: string;
  message: string;
  statut: string;
  creeLe: string;
}

export interface ZoneAttenteEquipe {
  niveau: NiveauAttenteEquipe;
  id: string;
  nom: string;
  /** Où se trouve la zone (région, préfecture ou commune). */
  contexte: string;
  personnes: number;
  prevenues: number;
  derniere: string;
}

export type ResultatPartenariatEquipe =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

export type ResultatAttenteEquipe =
  | { ok: true; message: string; trace: TraceActionSysteme }
  | { ok: false; message: string };

const COLONNE: Record<NiveauAttenteEquipe, "region_id" | "prefecture_id" | "commune_id" | "neighborhood_id"> = {
  region: "region_id",
  prefecture: "prefecture_id",
  commune: "commune_id",
  quartier: "neighborhood_id",
};

/** Les demandes de partenariat, les plus récentes d'abord. */
export async function listerPartenariatsEquipe(): Promise<PartenariatEquipe[]> {
  const { data } = await db()
    .from("partenariat_demandes")
    .select("id, forme, organisation, nom_contact, contact_type, contact, message, statut, cree_le")
    .order("cree_le", { ascending: false })
    .limit(LIMITE_PARTENARIATS);
  const liste: PartenariatEquipe[] = [];
  for (const l of (data ?? []) as unknown as Array<{
    id: string;
    forme: string;
    organisation: string;
    nom_contact: string;
    contact_type: string;
    contact: string;
    message: string;
    statut: string;
    cree_le: string;
  }>) {
    // Une forme ou un statut inconnu est ignoré : la base a ses contraintes, on ne propage pas de valeur illisible à l'application.
    if (!formePartenariatValide(l.forme) || !statutPartenariatValide(l.statut)) continue;
    liste.push({
      id: l.id,
      forme: l.forme,
      organisation: l.organisation,
      nomContact: l.nom_contact,
      contactType: l.contact_type === "telephone" ? "telephone" : "email",
      contact: l.contact,
      message: l.message,
      statut: l.statut,
      creeLe: l.cree_le,
    });
  }
  return liste;
}

/**
 * Change le statut d'une demande de partenariat (« nouvelle », « en cours », « traitée », « classée »).
 * Le statut « traitée » ou « classé » date la fin du traitement, comme sur le site.
 */
export async function changerStatutPartenariatEquipe(id: string, statutBrut: string): Promise<ResultatPartenariatEquipe> {
  if (!estUuid(id)) return { ok: false, message: "Demande introuvable." };
  const statut = statutPartenariatValide(statutBrut);
  if (!statut) return { ok: false, message: "Statut inconnu." };
  const { error } = await db()
    .from("partenariat_demandes")
    .update({ statut, traitee_le: statut === "traitee" || statut === "classee" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, message: "Impossible de changer le statut. Réessayez dans un instant." };
  return {
    ok: true,
    message: "Statut enregistré.",
    trace: { action: "partenariat.statut", cibleType: "partenariat_demandes", cibleId: id, motif: `statut : ${statut}` },
  };
}

/**
 * Les zones où des personnes attendent un restaurant, avec le nombre de personnes et le nombre déjà prévenues.
 * Aucun contact n'est lu ici : la page n'affiche que des nombres, comme sur le site.
 */
export async function listerZonesAttenteEquipe(): Promise<ZoneAttenteEquipe[]> {
  const base = db();
  const [alertesR, regionsR, prefsR, communesR, quartiersR] = await Promise.all([
    lireTout((de, a) =>
      base
        .from("zone_alertes")
        .select("region_id, prefecture_id, commune_id, neighborhood_id, notifie_le, cree_le")
        .order("id")
        .range(de, a),
    ),
    lireTout((de, a) => base.from("regions").select("id, nom").order("id").range(de, a)),
    lireTout((de, a) => base.from("prefectures").select("id, nom, region_id").order("id").range(de, a)),
    lireTout((de, a) => base.from("communes").select("id, nom, prefecture_id").order("id").range(de, a)),
    lireTout((de, a) => base.from("neighborhoods").select("id, nom, commune_id").order("id").range(de, a)),
  ]);
  const regions = new Map((regionsR.data ?? []).map((r) => [r.id, r as { id: string; nom: string }]));
  const prefs = new Map((prefsR.data ?? []).map((p) => [p.id, p as { id: string; nom: string; region_id: string }]));
  const communes = new Map((communesR.data ?? []).map((c) => [c.id, c as { id: string; nom: string; prefecture_id: string }]));
  const quartiers = new Map((quartiersR.data ?? []).map((q) => [q.id, q as { id: string; nom: string; commune_id: string }]));

  const parZone = new Map<string, ZoneAttenteEquipe>();
  for (const a of (alertesR.data ?? []) as unknown as Array<{
    region_id: string | null;
    prefecture_id: string | null;
    commune_id: string | null;
    neighborhood_id: string | null;
    notifie_le: string | null;
    cree_le: string;
  }>) {
    const niveau: NiveauAttenteEquipe = a.neighborhood_id
      ? "quartier"
      : a.commune_id
        ? "commune"
        : a.prefecture_id
          ? "prefecture"
          : "region";
    const id = (a.neighborhood_id ?? a.commune_id ?? a.prefecture_id ?? a.region_id) as string;
    if (!id) continue;
    let nom = "";
    let contexte = "";
    if (niveau === "quartier") {
      const q = quartiers.get(id);
      nom = q?.nom ?? "Quartier";
      contexte = communes.get(q?.commune_id ?? "")?.nom ?? "";
    } else if (niveau === "commune") {
      const c = communes.get(id);
      nom = c?.nom ?? "Commune";
      contexte = prefs.get(c?.prefecture_id ?? "")?.nom ?? "";
    } else if (niveau === "prefecture") {
      const p = prefs.get(id);
      nom = p?.nom ?? "Préfecture";
      contexte = regions.get(p?.region_id ?? "")?.nom ?? "";
    } else {
      nom = regions.get(id)?.nom ?? "Région";
    }
    const cle = `${niveau}:${id}`;
    const ligne = parZone.get(cle) ?? { niveau, id, nom, contexte, personnes: 0, prevenues: 0, derniere: a.cree_le };
    ligne.personnes += 1;
    if (a.notifie_le) ligne.prevenues += 1;
    if (a.cree_le > ligne.derniere) ligne.derniere = a.cree_le;
    parZone.set(cle, ligne);
  }
  const zones = [...parZone.values()].sort((a, b) => b.personnes - a.personnes || a.nom.localeCompare(b.nom, "fr"));
  return zones.slice(0, LIMITE_ZONES);
}

/**
 * Marque les personnes d'une zone comme prévenues (un restaurant vient d'ouvrir). Écriture tracée, sans toucher aux contacts.
 * La suppression des contacts de la zone, elle, reste sur le site : elle est irréversible.
 */
export async function marquerZonePrevenueEquipe(niveauBrut: string, id: string): Promise<ResultatAttenteEquipe> {
  const niveau = niveauAttenteValide(niveauBrut);
  if (!niveau || !estUuid(id)) return { ok: false, message: "Zone introuvable." };
  const { data, error } = await db()
    .from("zone_alertes")
    .update({ notifie_le: new Date().toISOString() })
    .eq(COLONNE[niveau], id)
    .is("notifie_le", null)
    .select("id");
  if (error) return { ok: false, message: "Impossible de marquer la zone. Réessayez dans un instant." };
  const nombre = (data ?? []).length;
  return {
    ok: true,
    message: `${nombre} personne(s) marquée(s) comme prévenue(s).`,
    trace: {
      action: "attente.prevenue",
      cibleType: COLONNE[niveau],
      cibleId: id,
      motif: `${nombre} personne(s) marquée(s) comme prévenue(s)`,
    },
  };
}
