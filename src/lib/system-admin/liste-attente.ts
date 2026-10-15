"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { validerContactAlerte } from "@/lib/site/zone-alerte";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Liste d'attente par zone, côté administration. Les contacts sont des données personnelles : la lecture, l'export et la suppression
 * exigent la permission `attente.gerer` (super administrateur et opérations), passent par le serveur (service-role, la table n'est
 * lisible par aucun navigateur) et laissent une trace dans le journal d'audit. La page n'affiche que des nombres ; les contacts ne sortent
 * que par l'export.
 */

export type NiveauAttente = "region" | "prefecture" | "commune" | "quartier";

export interface ZoneEnAttente {
  niveau: NiveauAttente;
  id: string;
  nom: string;
  /** Où se trouve la zone (région, préfecture ou commune). */
  contexte: string;
  personnes: number;
  prevenues: number;
  derniere: string;
}

export interface EtatAttente {
  erreur?: string;
  succes?: string;
}

const COLONNE: Record<NiveauAttente, "region_id" | "prefecture_id" | "commune_id" | "neighborhood_id"> = {
  region: "region_id",
  prefecture: "prefecture_id",
  commune: "commune_id",
  quartier: "neighborhood_id",
};

const MESSAGE_ECHEC = "Impossible d'effectuer l'opération. Réessayez dans un instant.";

function lireZone(formData: FormData): { niveau: NiveauAttente; id: string } | null {
  const niveau = String(formData.get("niveau") ?? "") as NiveauAttente;
  const id = String(formData.get("id") ?? "");
  if (!(niveau in COLONNE) || !estUuid(id)) return null;
  return { niveau, id };
}

/** Zones où des personnes attendent, avec le nombre de personnes (jamais leurs contacts). */
export async function listerZonesEnAttente(): Promise<ZoneEnAttente[]> {
  await verifierPermission("attente.gerer");
  const admin = creerClientAdmin();
  const [alertesR, regionsR, prefsR, communesR, quartiersR] = await Promise.all([
    admin.from("zone_alertes").select("region_id, prefecture_id, commune_id, neighborhood_id, notifie_le, cree_le"),
    admin.from("regions").select("id, nom"),
    admin.from("prefectures").select("id, nom, region_id"),
    admin.from("communes").select("id, nom, prefecture_id"),
    admin.from("neighborhoods").select("id, nom, commune_id"),
  ]);
  const regions = new Map((regionsR.data ?? []).map((r) => [r.id, r]));
  const prefs = new Map((prefsR.data ?? []).map((p) => [p.id, p]));
  const communes = new Map((communesR.data ?? []).map((c) => [c.id, c]));
  const quartiers = new Map((quartiersR.data ?? []).map((q) => [q.id, q]));

  const parZone = new Map<string, ZoneEnAttente>();
  for (const a of alertesR.data ?? []) {
    const niveau: NiveauAttente = a.neighborhood_id ? "quartier" : a.commune_id ? "commune" : a.prefecture_id ? "prefecture" : "region";
    const id = (a.neighborhood_id ?? a.commune_id ?? a.prefecture_id ?? a.region_id) as string;
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
  return [...parZone.values()].sort((a, b) => b.personnes - a.personnes || a.nom.localeCompare(b.nom, "fr"));
}

/** Marque toutes les personnes d'une zone comme prévenues (un restaurant vient d'ouvrir). */
export async function marquerZonePrevenueAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("attente.gerer");
  const zone = lireZone(formData);
  if (!zone) return;
  const { data, error } = await creerClientAdmin()
    .from("zone_alertes")
    .update({ notifie_le: new Date().toISOString() })
    .eq(COLONNE[zone.niveau], zone.id)
    .is("notifie_le", null)
    .select("id");
  if (error) return;
  await journaliserActionSysteme(contexte, {
    action: "attente.prevenue",
    cibleType: COLONNE[zone.niveau],
    cibleId: zone.id,
    motif: `${data?.length ?? 0} personne(s) marquée(s) comme prévenue(s)`,
  });
  revalidatePath("/system/catalogue/liste-attente");
}

/** Supprime tous les contacts d'une zone (zone ouverte et personnes prévenues, ou demande de retrait). */
export async function supprimerContactsZoneAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("attente.gerer");
  const zone = lireZone(formData);
  if (!zone) return;
  const { data, error } = await creerClientAdmin().from("zone_alertes").delete().eq(COLONNE[zone.niveau], zone.id).select("id");
  if (error) return;
  await journaliserActionSysteme(contexte, {
    action: "attente.suppression",
    cibleType: COLONNE[zone.niveau],
    cibleId: zone.id,
    motif: `${data?.length ?? 0} contact(s) supprimé(s) de la zone`,
  });
  revalidatePath("/system/catalogue/liste-attente");
}

/** Supprime UN contact de toutes les zones (droit de retrait demandé par la personne). Le contact n'est pas écrit dans le journal. */
export async function supprimerContactAction(_etat: EtatAttente, formData: FormData): Promise<EtatAttente> {
  const contexte = await verifierPermission("attente.gerer");
  const verifie = validerContactAlerte(String(formData.get("contact") ?? ""));
  if (!verifie.ok) return { erreur: verifie.erreur };
  const { data, error } = await creerClientAdmin().from("zone_alertes").delete().eq("contact", verifie.contact).select("id");
  if (error) return { erreur: MESSAGE_ECHEC };
  await journaliserActionSysteme(contexte, {
    action: "attente.suppression",
    cibleType: "zone_alertes",
    cibleId: "contact",
    motif: `${data?.length ?? 0} inscription(s) supprimée(s) à la demande de la personne`,
  });
  revalidatePath("/system/catalogue/liste-attente");
  return { succes: (data?.length ?? 0) > 0 ? `${data?.length} inscription(s) supprimée(s).` : "Aucune inscription avec ce contact." };
}
