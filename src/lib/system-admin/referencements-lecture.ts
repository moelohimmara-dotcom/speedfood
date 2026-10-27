import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireStatutReferencement, lireTypeEtablissement, type StatutReferencement, type TypeEtablissement } from "@/lib/site/referencement";

export interface DemandeReferencementListee {
  id: string;
  type: TypeEtablissement;
  organisation: string;
  commune: string;
  quartier: string;
  indications: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string | null;
  specialites: string | null;
  responsable: string;
  email: string;
  telephone: string;
  statut: StatutReferencement;
  restaurantId: string | null;
  creeLe: string;
  /** Dossier déposé depuis l'application (null pour une demande du site). */
  candidature: DossierCandidature | null;
}

export interface DossierCandidature {
  horaires: string | null;
  moyensPaiement: string[];
  services: string[];
  nombrePlats: number;
  logoChemin: string | null;
  photoChemin: string | null;
  motifRefus: string | null;
  /** Le compte du candidat existe encore (il peut être rattaché à la fiche créée). */
  utilisateurId: string | null;
  /** Le compte est déjà membre de l'établissement créé. */
  compteRattache: boolean;
}

/** Nombre de demandes jamais ouvertes : alimente la file « À traiter » du tableau de bord. 0 si la lecture échoue. */
export async function compterReferencementsNouveaux(): Promise<number> {
  const { count, error } = await creerClientAdmin().from("referencement_demandes").select("id", { count: "exact", head: true }).eq("statut", "nouvelle");
  return error ? 0 : (count ?? 0);
}

/** Les 200 demandes les plus récentes (borne volontaire : une page d'administration, pas un export). */
export async function listerDemandesReferencement(): Promise<DemandeReferencementListee[]> {
  // Client sans types : les colonnes de la candidature (migration du 26 octobre) ne sont pas dans les types générés.
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("referencement_demandes")
    .select(
      "id, type_etablissement, organisation, commune, quartier, indications, latitude, longitude, categories, specialites, responsable_prenom, responsable_nom, contact_email, contact_telephone, statut, restaurant_id, cree_le, origine, horaires, moyens_paiement, services, menu_brouillon, logo_chemin, photo_chemin, motif_refus, utilisateur_id"
    )
    .order("cree_le", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  // Comptes déjà rattachés à leur établissement (une seule lecture pour toute la liste).
  const paires = data.filter((l) => l.utilisateur_id && l.restaurant_id);
  const rattaches = new Set<string>();
  if (paires.length > 0) {
    const { data: membres } = await admin
      .from("restaurant_memberships")
      .select("restaurant_id, utilisateur_id")
      .in("restaurant_id", paires.map((l) => l.restaurant_id as string))
      .limit(1000);
    for (const m of membres ?? []) rattaches.add(`${m.restaurant_id}:${m.utilisateur_id}`);
  }
  const liste: DemandeReferencementListee[] = [];
  for (const l of data as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const type = lireTypeEtablissement(l.type_etablissement);
    const statut = lireStatutReferencement(l.statut);
    if (!type || !statut) continue;
    liste.push({
      id: l.id,
      type,
      organisation: l.organisation,
      commune: l.commune,
      quartier: l.quartier,
      indications: l.indications,
      latitude: l.latitude,
      longitude: l.longitude,
      categories: l.categories,
      specialites: l.specialites,
      responsable: `${l.responsable_prenom} ${l.responsable_nom}`,
      email: l.contact_email,
      telephone: l.contact_telephone,
      statut,
      restaurantId: l.restaurant_id,
      creeLe: l.cree_le,
      candidature:
        l.origine === "application"
          ? {
              horaires: l.horaires,
              moyensPaiement: l.moyens_paiement ?? [],
              services: l.services ?? [],
              nombrePlats: Array.isArray(l.menu_brouillon) ? l.menu_brouillon.length : 0,
              logoChemin: l.logo_chemin,
              photoChemin: l.photo_chemin,
              motifRefus: l.motif_refus,
              utilisateurId: l.utilisateur_id,
              compteRattache: Boolean(l.utilisateur_id && l.restaurant_id && rattaches.has(`${l.restaurant_id}:${l.utilisateur_id}`)),
            }
          : null,
    });
  }
  return liste;
}
