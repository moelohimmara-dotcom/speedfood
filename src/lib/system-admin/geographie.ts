"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Géographie administrable depuis la console système : communes (activer / désactiver, renommer) et
 * quartiers (créer, renommer, changer de commune, activer / désactiver). Même permission que la taxonomie
 * (`taxonomie.editer`). Toute écriture est journalisée dans `audit_events`.
 * Désactiver ne supprime rien : les restaurants déjà rattachés gardent leur quartier.
 */

export interface EtatGeographie {
  erreur?: string;
  succes?: boolean;
}

export interface CommuneSysteme {
  id: string;
  nom: string;
  actif: boolean;
  codeOfficiel: string | null;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
}

/** Région ou préfecture : nom, activation et point central. */
export interface ZoneLargeSysteme {
  id: string;
  nom: string;
  actif: boolean;
  codeOfficiel: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface QuartierSysteme {
  id: string;
  nom: string;
  actif: boolean;
  communeId: string | null;
  communeNom: string | null;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
}

export interface RegionSysteme {
  nom: string;
  slug: string;
}

export interface GeographieSysteme {
  /** Les huit régions, pour choisir celle que l'on gère (la liste d'un pays entier serait ingérable d'un seul bloc). */
  regions: RegionSysteme[];
  regionChoisie: RegionSysteme | null;
  /** La région choisie, en entier (activation, point central). */
  region: ZoneLargeSysteme | null;
  prefectures: ZoneLargeSysteme[];
  communes: CommuneSysteme[];
  quartiers: QuartierSysteme[];
}

const MESSAGE_ECHEC = "Impossible d'enregistrer. Réessayez dans un instant.";

/**
 * Géographie d'UNE région à la fois (Conakry par défaut) : ses communes et leurs quartiers réels. Les quartiers génériques
 * « Centre de … » des communes hors Conakry ne sont pas listés : ils représentent la commune elle-même.
 */
export async function listerGeographieSysteme(regionSlug = "conakry"): Promise<GeographieSysteme> {
  const { supabase } = await verifierPermission("taxonomie.editer");

  const { data: regionsBrutes } = await supabase.from("regions").select("nom, slug").order("nom");
  const regions = (regionsBrutes ?? []).map((r) => ({ nom: r.nom, slug: r.slug }));
  const regionChoisie = regions.find((r) => r.slug === regionSlug) ?? regions.find((r) => r.slug === "conakry") ?? null;
  if (!regionChoisie) return { regions, regionChoisie: null, region: null, prefectures: [], communes: [], quartiers: [] };

  const { data: regionLue } = await supabase.from("regions").select("id, nom, actif, code_officiel, latitude, longitude").eq("slug", regionChoisie.slug).maybeSingle();
  const { data: prefsLues } = regionLue
    ? await supabase.from("prefectures").select("id, nom, actif, code_officiel, latitude, longitude").eq("region_id", regionLue.id).order("nom")
    : { data: [] };

  const { data: communes } = await supabase
    .from("communes")
    .select("id, nom, actif, code_officiel, latitude, longitude, noms_alternatifs, prefectures!inner(slug, regions!inner(slug))")
    .eq("prefectures.regions.slug", regionChoisie.slug)
    .order("nom");
  const idsCommunes = (communes ?? []).map((c) => c.id);
  const { data: quartiers } = idsCommunes.length
    ? await supabase
        .from("neighborhoods")
        .select("id, nom, actif, commune_id, latitude, longitude, noms_alternatifs, communes(nom)")
        .in("commune_id", idsCommunes)
        .eq("generique", false)
        .order("nom")
    : { data: [] };

  const enZoneLarge = (z: { id: string; nom: string; actif: boolean; code_officiel: string | null; latitude: number | null; longitude: number | null }): ZoneLargeSysteme => ({
    id: z.id,
    nom: z.nom,
    actif: z.actif,
    codeOfficiel: z.code_officiel,
    latitude: z.latitude,
    longitude: z.longitude,
  });

  return {
    regions,
    regionChoisie,
    region: regionLue ? enZoneLarge(regionLue) : null,
    prefectures: (prefsLues ?? []).map(enZoneLarge),
    communes: (communes ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      actif: c.actif,
      codeOfficiel: c.code_officiel,
      latitude: c.latitude,
      longitude: c.longitude,
      nomsAlternatifs: c.noms_alternatifs ?? [],
    })),
    quartiers: (quartiers ?? []).map((q) => {
      const commune = Array.isArray(q.communes) ? q.communes[0] : q.communes;
      return {
        id: q.id,
        nom: q.nom,
        actif: q.actif,
        communeId: q.commune_id,
        communeNom: commune?.nom ?? null,
        latitude: q.latitude,
        longitude: q.longitude,
        nomsAlternatifs: q.noms_alternatifs ?? [],
      };
    }),
  };
}

/** Point central saisi dans un formulaire : les deux champs ou aucun ; dans les limites de la Guinée (celles de la base). */
function lirePoint(formData: FormData): { latitude: number | null; longitude: number | null } | { erreur: string } {
  const lat = String(formData.get("latitude") ?? "").trim().replace(",", ".");
  const lon = String(formData.get("longitude") ?? "").trim().replace(",", ".");
  if (lat === "" && lon === "") return { latitude: null, longitude: null };
  if (lat === "" || lon === "") return { erreur: "Indiquez la latitude ET la longitude, ou laissez les deux vides." };
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { erreur: "La latitude et la longitude doivent être des nombres (par exemple 9.64 et -13.58)." };
  if (latitude < 7 || latitude > 13 || longitude < -15.5 || longitude > -7) return { erreur: "Ce point est en dehors de la Guinée (latitude de 7 à 13, longitude de -15,5 à -7)." };
  return { latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5 };
}

/** Noms alternatifs : un par ligne (ou séparés par des virgules), de 2 à 80 caractères, dix au plus, sans doublon. */
function lireAliases(formData: FormData): string[] | { erreur: string } {
  const brut = String(formData.get("noms_alternatifs") ?? "");
  const noms = [...new Set(brut.split(/[\n,;]+/).map((n) => n.trim()).filter((n) => n !== ""))];
  if (noms.length > 10) return { erreur: "Dix noms alternatifs au plus." };
  if (noms.some((n) => n.length < 2 || n.length > 80)) return { erreur: "Chaque nom alternatif compte de 2 à 80 caractères." };
  return noms;
}

function lireNom(formData: FormData): string | null {
  const nom = String(formData.get("nom") ?? "").trim();
  if (nom.length < 2 || nom.length > 80) {
    return null;
  }
  return nom;
}

/** Créer ou modifier un quartier. Sans `id` : création. */
export async function enregistrerQuartierAction(
  _etatPrecedent: EtatGeographie,
  formData: FormData
): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const id = String(formData.get("id") ?? "");
  const nom = lireNom(formData);
  const communeId = String(formData.get("commune_id") ?? "");
  const actif = formData.get("actif") === "on";

  if (!nom) {
    return { erreur: "Le nom du quartier doit compter de 2 à 80 caractères." };
  }
  if (!estUuid(communeId)) {
    return { erreur: "Choisissez une commune." };
  }
  if (id && !estUuid(id)) {
    return { erreur: "Quartier introuvable." };
  }

  const point = lirePoint(formData);
  if ("erreur" in point) return { erreur: point.erreur };
  const aliases = lireAliases(formData);
  if (!Array.isArray(aliases)) return { erreur: aliases.erreur };
  const complement = formData.has("latitude")
    ? { latitude: point.latitude, longitude: point.longitude, noms_alternatifs: aliases, ...(point.latitude !== null ? { coordonnees_source: "saisie-admin" } : { coordonnees_source: null }) }
    : {};

  const supabase = contexte.supabase;
  if (id) {
    const { error } = await supabase
      .from("neighborhoods")
      .update({ nom, commune_id: communeId, actif, ...complement })
      .eq("id", id);
    if (error) {
      return { erreur: error.code === "23505" ? "Ce nom de quartier existe déjà." : MESSAGE_ECHEC };
    }
    await journaliserActionSysteme(contexte, {
      action: "taxonomie.modification",
      cibleType: "neighborhoods",
      cibleId: id,
      motif: `${nom} (${actif ? "actif" : "inactif"})`,
    });
  } else {
    const { data, error } = await supabase
      .from("neighborhoods")
      .insert({ nom, commune_id: communeId, actif, ...complement })
      .select("id")
      .single();
    if (error || !data) {
      return { erreur: error?.code === "23505" ? "Ce nom de quartier existe déjà." : MESSAGE_ECHEC };
    }
    await journaliserActionSysteme(contexte, {
      action: "taxonomie.creation",
      cibleType: "neighborhoods",
      cibleId: data.id,
      motif: nom,
    });
  }

  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  return { succes: true };
}

/** Activer / désactiver une commune (et renommer). */
export async function enregistrerCommuneAction(
  _etatPrecedent: EtatGeographie,
  formData: FormData
): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const id = String(formData.get("id") ?? "");
  const nom = lireNom(formData);
  const actif = formData.get("actif") === "on";

  if (!estUuid(id)) {
    return { erreur: "Commune introuvable." };
  }
  if (!nom) {
    return { erreur: "Le nom de la commune doit compter de 2 à 80 caractères." };
  }

  const point = lirePoint(formData);
  if ("erreur" in point) return { erreur: point.erreur };
  const aliases = lireAliases(formData);
  if (!Array.isArray(aliases)) return { erreur: aliases.erreur };
  const complement = formData.has("latitude")
    ? { latitude: point.latitude, longitude: point.longitude, noms_alternatifs: aliases, ...(point.latitude !== null ? { coordonnees_source: "saisie-admin" } : { coordonnees_source: null }) }
    : {};

  const { error } = await contexte.supabase.from("communes").update({ nom, actif, ...complement }).eq("id", id);
  if (error) {
    return { erreur: error.code === "23505" ? "Ce nom de commune existe déjà." : MESSAGE_ECHEC };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: "communes",
    cibleId: id,
    motif: `${nom} (${actif ? "active" : "inactive"})`,
  });

  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  return { succes: true };
}

/** Activer / désactiver (et renommer, placer) une préfecture ou une région. Désactiver la retire des choix et de la recherche, sans rien supprimer. */
async function enregistrerZoneLarge(table: "regions" | "prefectures", formData: FormData): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const id = String(formData.get("id") ?? "");
  const nom = lireNom(formData);
  const actif = formData.get("actif") === "on";
  const libelle = table === "regions" ? "région" : "préfecture";
  if (!estUuid(id)) return { erreur: `${libelle[0].toUpperCase()}${libelle.slice(1)} introuvable.` };
  if (!nom) return { erreur: `Le nom doit compter de 2 à 80 caractères.` };
  const point = lirePoint(formData);
  if ("erreur" in point) return { erreur: point.erreur };

  const { error } = await contexte.supabase.from(table).update({ nom, actif, latitude: point.latitude, longitude: point.longitude }).eq("id", id);
  if (error) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: table,
    cibleId: id,
    motif: `${nom} (${actif ? "active" : "inactive"})`,
  });
  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/quartiers");
  revalidatePath("/");
  return { succes: true };
}

export async function enregistrerRegionAction(_etat: EtatGeographie, formData: FormData): Promise<EtatGeographie> {
  return enregistrerZoneLarge("regions", formData);
}

export async function enregistrerPrefectureAction(_etat: EtatGeographie, formData: FormData): Promise<EtatGeographie> {
  return enregistrerZoneLarge("prefectures", formData);
}
