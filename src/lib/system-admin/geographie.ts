"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { creerClientAdmin } from "@/lib/db/admin";
import { lienZone } from "@/lib/site/zones";
import { slugQuartier } from "@/lib/site/quartiers";
import { roleAPermission } from "./permissions";
import {
  calculerDifferences,
  lireLignesImport,
  lireStatutLancement,
  pointValide,
  type Changement,
  type ElementActuel,
  type StatutLancement,
} from "./geographie-outils";

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
  slug: string;
  statutLancement: StatutLancement | null;
  /** Personnes qui attendent un restaurant dans cette commune (ou l'un de ses quartiers) : un nombre, jamais un contact. */
  attente: number;
  lienPublic: string;
}

/** Région ou préfecture : nom, activation et point central. */
export interface ZoneLargeSysteme {
  id: string;
  nom: string;
  actif: boolean;
  codeOfficiel: string | null;
  latitude: number | null;
  longitude: number | null;
  slug: string;
  attente: number;
  lienPublic: string;
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
  slug: string;
  attente: number;
  lienPublic: string;
}

/** Une modification récente de la géographie, lue dans le journal d'audit. */
export interface EntreeHistoriqueGeographie {
  id: string;
  quand: string;
  qui: string | null;
  action: string;
  cible: string;
  detail: string | null;
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
  /** Dernières modifications de cette région (vide si le rôle n'a pas accès au journal). */
  historique: EntreeHistoriqueGeographie[];
}

const MESSAGE_ECHEC = "Impossible d'enregistrer. Réessayez dans un instant.";

/**
 * Géographie d'UNE région à la fois (Conakry par défaut) : ses communes et leurs quartiers réels. Les quartiers génériques
 * « Centre de … » des communes hors Conakry ne sont pas listés : ils représentent la commune elle-même.
 */
export async function listerGeographieSysteme(regionSlug = "conakry"): Promise<GeographieSysteme> {
  const contexteHistorique = await verifierPermission("taxonomie.editer");
  const { supabase } = contexteHistorique;

  const { data: regionsBrutes } = await supabase.from("regions").select("nom, slug").order("nom");
  const regions = (regionsBrutes ?? []).map((r) => ({ nom: r.nom, slug: r.slug }));
  const regionChoisie = regions.find((r) => r.slug === regionSlug) ?? regions.find((r) => r.slug === "conakry") ?? null;
  if (!regionChoisie) return { regions, regionChoisie: null, region: null, prefectures: [], communes: [], quartiers: [], historique: [] };

  const { data: regionLue } = await supabase.from("regions").select("id, nom, slug, actif, code_officiel, latitude, longitude").eq("slug", regionChoisie.slug).maybeSingle();
  const { data: prefsLues } = regionLue
    ? await supabase.from("prefectures").select("id, nom, slug, actif, code_officiel, latitude, longitude").eq("region_id", regionLue.id).order("nom")
    : { data: [] };

  const { data: communes } = await supabase
    .from("communes")
    .select("id, nom, slug, actif, code_officiel, latitude, longitude, noms_alternatifs, statut_lancement, prefectures!inner(slug, regions!inner(slug))")
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

  // Demande : combien de personnes attendent, par zone. Seuls des nombres sortent (aucun contact n'est lu).
  const { data: alertes } = await creerClientAdmin().from("zone_alertes").select("region_id, prefecture_id, commune_id, neighborhood_id");
  const parCol = (col: "region_id" | "prefecture_id" | "commune_id" | "neighborhood_id") => {
    const m = new Map<string, number>();
    for (const a of alertes ?? []) {
      const id = a[col];
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };
  const attRegion = parCol("region_id");
  const attPref = parCol("prefecture_id");
  const attCommune = parCol("commune_id");
  const attQuartier = parCol("neighborhood_id");
  const communeDeQuartier = new Map((quartiers ?? []).map((q) => [q.id, q.commune_id]));
  const attenteCommune = (id: string) => {
    let n = attCommune.get(id) ?? 0;
    for (const [qid, nb] of attQuartier) if (communeDeQuartier.get(qid) === id) n += nb;
    return n;
  };

  const enZoneLarge = (
    z: { id: string; nom: string; slug: string; actif: boolean; code_officiel: string | null; latitude: number | null; longitude: number | null },
    type: "region" | "prefecture"
  ): ZoneLargeSysteme => ({
    id: z.id,
    nom: z.nom,
    actif: z.actif,
    codeOfficiel: z.code_officiel,
    latitude: z.latitude,
    longitude: z.longitude,
    slug: z.slug,
    attente: (type === "region" ? attRegion : attPref).get(z.id) ?? 0,
    lienPublic: lienZone({ niveau: type, slug: z.slug }),
  });

  return {
    regions,
    regionChoisie,
    region: regionLue ? enZoneLarge(regionLue, "region") : null,
    prefectures: (prefsLues ?? []).map((p) => enZoneLarge(p, "prefecture")),
    communes: (communes ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      actif: c.actif,
      codeOfficiel: c.code_officiel,
      latitude: c.latitude,
      longitude: c.longitude,
      nomsAlternatifs: c.noms_alternatifs ?? [],
      slug: c.slug,
      statutLancement: lireStatutLancement(c.statut_lancement) ?? null,
      attente: attenteCommune(c.id),
      lienPublic: lienZone({ niveau: "commune", slug: c.slug }),
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
        slug: slugQuartier(q.nom),
        attente: attQuartier.get(q.id) ?? 0,
        lienPublic: lienZone({ niveau: "quartier", slug: slugQuartier(q.nom) }),
      };
    }),
    historique: await lireHistorique(contexteHistorique, [
      ...(regionLue ? [regionLue.id] : []),
      ...(prefsLues ?? []).map((p) => p.id),
      ...(communes ?? []).map((c) => c.id),
      ...(quartiers ?? []).map((q) => q.id),
    ]),
  };
}

/** Dernières modifications des zones données, lues dans le journal d'audit (réservé aux rôles qui y ont accès). */
async function lireHistorique(contexte: Awaited<ReturnType<typeof verifierPermission>>, ids: string[]): Promise<EntreeHistoriqueGeographie[]> {
  if (!roleAPermission(contexte.role, "systeme.audit")) return [];
  try {
    const garde = new Set(ids);
    const reponses = await Promise.all(
      ["taxonomie.modification", "taxonomie.creation"].map((action) => contexte.supabase.rpc("fn_lister_audit", { p_action: action, p_limite: 200 }))
    );
    return reponses
      .flatMap((r) => r.data ?? [])
      .filter((e) => garde.has(e.cible_id))
      .sort((a, b) => b.horodatage.localeCompare(a.horodatage))
      .slice(0, 25)
      .map((e) => ({ id: e.id, quand: e.horodatage, qui: e.acteur_email, action: e.action, cible: e.cible_type, detail: e.motif }));
  } catch {
    return [];
  }
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

  let statut: { statut_lancement?: StatutLancement | null } = {};
  if (formData.has("statut_lancement")) {
    const lu = lireStatutLancement(formData.get("statut_lancement"));
    if (lu === undefined) return { erreur: "Statut de lancement inconnu." };
    statut = { statut_lancement: lu };
  }

  const { error } = await contexte.supabase.from("communes").update({ nom, actif, ...complement, ...statut }).eq("id", id);
  if (error) {
    return { erreur: error.code === "23505" ? "Ce nom de commune existe déjà." : MESSAGE_ECHEC };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: "communes",
    cibleId: id,
    motif: `${nom} (${actif ? "active" : "inactive"})${"statut_lancement" in statut ? ` · statut ${statut.statut_lancement ?? "automatique"}` : ""}`,
  });

  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  revalidatePath("/");
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


// ---------------------------------------------------------------------------------------------------------------------------------
// Actions par lot, fusion, suggestion de point, import
// ---------------------------------------------------------------------------------------------------------------------------------

const MAX_LOT = 200;

function rafraichirGeographie() {
  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/system/catalogue/couverture");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  revalidatePath("/");
}

/**
 * Une même modification sur plusieurs communes ou quartiers cochés : activer, désactiver, ou (communes) fixer le statut de lancement.
 * Le serveur revalide tout : identifiants, taille du lot, valeur. Une seule trace d'audit résume le lot.
 */
export async function enregistrerLotAction(_etat: EtatGeographie, formData: FormData): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const niveau = String(formData.get("niveau") ?? "");
  const operation = String(formData.get("operation") ?? "");
  const ids = [...new Set(formData.getAll("ids").map(String))];
  if (niveau !== "commune" && niveau !== "quartier") return { erreur: "Niveau inconnu." };
  if (ids.length === 0) return { erreur: "Cochez au moins un élément." };
  if (ids.length > MAX_LOT || ids.some((i) => !estUuid(i))) return { erreur: `Sélection invalide (${MAX_LOT} éléments au plus).` };

  let champs: { actif: boolean } | { statut_lancement: StatutLancement | null };
  let libelle: string;
  if (operation === "activer" || operation === "desactiver") {
    champs = { actif: operation === "activer" };
    libelle = operation === "activer" ? "activation" : "désactivation";
  } else if (operation.startsWith("statut:") && niveau === "commune") {
    const lu = lireStatutLancement(operation.slice(7));
    if (lu === undefined) return { erreur: "Statut de lancement inconnu." };
    champs = { statut_lancement: lu };
    libelle = `statut ${lu ?? "automatique"}`;
  } else {
    return { erreur: "Choisissez une action." };
  }

  const table = niveau === "commune" ? "communes" : "neighborhoods";
  const { error, count } = await contexte.supabase.from(table).update(champs, { count: "exact" }).in("id", ids);
  if (error) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: table,
    cibleId: ids[0],
    motif: `lot de ${count ?? ids.length} : ${libelle}`,
  });
  rafraichirGeographie();
  return { succes: true };
}

/** Fusionne deux quartiers en double de la même commune (voir `fn_fusionner_quartiers`) : tout est déplacé, le doublon est désactivé, rien n'est supprimé. */
export async function fusionnerQuartiersAction(_etat: EtatGeographie, formData: FormData): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const source = String(formData.get("source") ?? "");
  const cible = String(formData.get("cible") ?? "");
  if (!estUuid(source) || !estUuid(cible)) return { erreur: "Choisissez les deux quartiers." };
  if (source === cible) return { erreur: "Choisissez deux quartiers différents." };
  if (formData.get("confirmation") !== "on") return { erreur: "Cochez la confirmation pour fusionner." };

  const { data, error } = await contexte.supabase.rpc("fn_fusionner_quartiers", { p_source: source, p_cible: cible });
  if (error) {
    return {
      erreur: /meme commune/i.test(error.message)
        ? "Les deux quartiers doivent être dans la même commune."
        : /Centre de/i.test(error.message)
          ? "Un quartier « Centre de … » représente la commune : il ne se fusionne pas."
          : MESSAGE_ECHEC,
    };
  }
  const resume = typeof data === "object" && data !== null ? (data as Record<string, number>) : {};
  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: "neighborhoods",
    cibleId: cible,
    motif: `fusion : ${source} → ${cible} (${resume.restaurants ?? 0} restaurant(s), ${resume.alertes ?? 0} alerte(s) déplacés)`,
  });
  rafraichirGeographie();
  return { succes: true };
}

export interface SuggestionPoint {
  erreur?: string;
  latitude?: number;
  longitude?: number;
  /** Nom complet du lieu trouvé, à comparer avec la zone avant d'accepter. */
  lieu?: string;
}

const NOMINATIM_RECHERCHE = "https://nominatim.openstreetmap.org/search";
const IDENTIFICATION = "Speedfood/1.0 (+https://speedfood-app.moelohimmara.workers.dev)";

/**
 * Propose un point central pour une zone d'après OpenStreetMap (une requête par clic d'un administrateur, jamais en boucle).
 * Rien n'est enregistré : l'administrateur compare le lieu trouvé, puis enregistre lui-même.
 */
export async function suggererPointAction(nom: string, contexte: string): Promise<SuggestionPoint> {
  await verifierPermission("taxonomie.editer");
  const nomPropre = String(nom ?? "").trim().slice(0, 80);
  const contextePropre = String(contexte ?? "").trim().slice(0, 120);
  if (nomPropre.length < 2) return { erreur: "Renseignez d'abord le nom." };
  const q = [nomPropre, contextePropre, "Guinée"].filter((x) => x !== "").join(", ");
  try {
    const reponse = await fetch(`${NOMINATIM_RECHERCHE}?${new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "gn", "accept-language": "fr" })}`, {
      headers: { "User-Agent": IDENTIFICATION, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!reponse.ok) return { erreur: "Le service de cartes ne répond pas. Réessayez dans un instant." };
    const donnees: unknown = await reponse.json();
    const premier = Array.isArray(donnees) ? (donnees[0] as { lat?: string; lon?: string; display_name?: string } | undefined) : undefined;
    const latitude = Number(premier?.lat);
    const longitude = Number(premier?.lon);
    if (!premier || !pointValide(latitude, longitude)) return { erreur: "Aucun lieu trouvé pour ce nom. Saisissez le point à la main." };
    return { latitude: Math.round(latitude * 1e5) / 1e5, longitude: Math.round(longitude * 1e5) / 1e5, lieu: String(premier.display_name ?? "").slice(0, 200) };
  } catch {
    return { erreur: "Le service de cartes ne répond pas. Réessayez dans un instant." };
  }
}

export interface ApercuImport {
  erreur?: string;
  erreurs?: string[];
  changements?: { id: string; niveau: "commune" | "quartier"; nom: string; champs: string[] }[];
  inconnus?: number;
  inchanges?: number;
  /** Nombre de lignes appliquées (après confirmation). */
  appliques?: number;
  echecs?: string[];
}

/** État actuel (communes et quartiers) des identifiants d'un fichier, lu par lots pour rester sous la limite d'adresse. */
async function lireActuels(contexte: Awaited<ReturnType<typeof verifierPermission>>, ids: string[]): Promise<ElementActuel[]> {
  const actuels: ElementActuel[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const lot = ids.slice(i, i + 100);
    const [communes, quartiers] = await Promise.all([
      contexte.supabase.from("communes").select("id, nom, actif, latitude, longitude, noms_alternatifs, statut_lancement").in("id", lot),
      contexte.supabase.from("neighborhoods").select("id, nom, actif, latitude, longitude, noms_alternatifs").in("id", lot),
    ]);
    for (const c of communes.data ?? []) {
      actuels.push({ id: c.id, niveau: "commune", nom: c.nom, actif: c.actif, latitude: c.latitude, longitude: c.longitude, nomsAlternatifs: c.noms_alternatifs ?? [], statutLancement: lireStatutLancement(c.statut_lancement) ?? null });
    }
    for (const q of quartiers.data ?? []) {
      actuels.push({ id: q.id, niveau: "quartier", nom: q.nom, actif: q.actif, latitude: q.latitude, longitude: q.longitude, nomsAlternatifs: q.noms_alternatifs ?? [], statutLancement: null });
    }
  }
  return actuels;
}

type PreparationImport =
  | { contexte: Awaited<ReturnType<typeof verifierPermission>>; erreur: string }
  | { contexte: Awaited<ReturnType<typeof verifierPermission>>; erreurs: string[] }
  | { contexte: Awaited<ReturnType<typeof verifierPermission>>; changements: Changement[]; inconnus: unknown[]; inchanges: number };

async function preparerImport(formData: FormData): Promise<PreparationImport> {
  const contexte = await verifierPermission("taxonomie.editer");
  const texte = String(formData.get("csv") ?? "");
  if (texte.trim() === "") return { contexte, erreur: "Collez le contenu du fichier ou choisissez un fichier." };
  if (texte.length > 1_500_000) return { contexte, erreur: "Le fichier est trop volumineux." };
  const { lignes, erreurs } = lireLignesImport(texte);
  if (erreurs.length > 0) return { contexte, erreurs: erreurs.slice(0, 30) };
  const actuels = await lireActuels(contexte, lignes.map((l) => l.id));
  return { contexte, ...calculerDifferences(lignes, actuels) };
}

/** Étape 1 de l'import : montre ce qui changerait, sans rien écrire. */
export async function apercuImportAction(_etat: ApercuImport, formData: FormData): Promise<ApercuImport> {
  const r = await preparerImport(formData);
  if ("erreur" in r) return { erreur: r.erreur };
  if ("erreurs" in r) return { erreurs: r.erreurs };
  return {
    changements: r.changements.slice(0, 200).map((c) => ({ id: c.id, niveau: c.niveau, nom: c.nomActuel, champs: c.champs })),
    inconnus: r.inconnus.length,
    inchanges: r.inchanges,
  };
}

/** Étape 2 : recalcule les différences sur l'état ACTUEL de la base (jamais sur l'aperçu envoyé par le navigateur), puis applique. */
export async function appliquerImportAction(_etat: ApercuImport, formData: FormData): Promise<ApercuImport> {
  const r = await preparerImport(formData);
  if ("erreur" in r) return { erreur: r.erreur };
  if ("erreurs" in r) return { erreurs: r.erreurs };
  if (formData.get("confirmation") !== "on") return { erreur: "Cochez la confirmation pour appliquer les changements." };
  if (r.changements.length === 0) return { appliques: 0, inconnus: r.inconnus.length, inchanges: r.inchanges };

  const echecs: string[] = [];
  let appliques = 0;
  for (const { ligne } of r.changements) {
    const complement = {
      latitude: ligne.latitude,
      longitude: ligne.longitude,
      noms_alternatifs: ligne.nomsAlternatifs,
      coordonnees_source: ligne.latitude !== null ? "import-csv" : null,
    };
    const { error } =
      ligne.niveau === "commune"
        ? await r.contexte.supabase.from("communes").update({ nom: ligne.nom, actif: ligne.actif, statut_lancement: ligne.statutLancement, ...complement }).eq("id", ligne.id)
        : await r.contexte.supabase.from("neighborhoods").update({ nom: ligne.nom, actif: ligne.actif, ...complement }).eq("id", ligne.id);
    if (error) echecs.push(`Ligne ${ligne.numero} (${ligne.nom}) : ${error.code === "23505" ? "ce nom existe déjà" : "non enregistrée"}.`);
    else appliques += 1;
  }
  await journaliserActionSysteme(r.contexte, {
    action: "taxonomie.modification",
    cibleType: "communes",
    cibleId: r.changements[0].id,
    motif: `import CSV : ${appliques} modification(s) appliquée(s), ${echecs.length} refusée(s)`,
  });
  rafraichirGeographie();
  return { appliques, echecs: echecs.slice(0, 20), inconnus: r.inconnus.length, inchanges: r.inchanges };
}
