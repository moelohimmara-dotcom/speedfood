import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { livreurAuthentifie } from "@/lib/api/v1-livreur";
import { acteurPeut } from "@/lib/livraison/statuts";
import {
  ETAPES_COURSE_LIVREUR, STATUTS_COURSE_ACTIVE, libelleCourseLivreur, projeterCourseLivreur,
  type CourseLivreur, type ModeCourseLivreur, type StatutCourseActive,
} from "@speedfood/shared/contracts/livreur-course";

/**
 * File des courses du livreur du compte, pour l'application : ses courses actives (assignée, en route, récupérée, vers le client),
 * la plus ancienne d'abord. L'identité du livreur vient du jeton. Chaque course est projetée par le contrat partagé avec l'application :
 * les coordonnées du client ne sortent qu'après la récupération de la commande. Une course illisible est une erreur, jamais une file
 * tronquée en silence. `file: null` : ce compte n'est pas un compte livreur. Route créée pour la parité avec l'ancienne application,
 * qui l'appelait déjà (elle n'existait ni ici ni dans l'API unique).
 */
const ACTIVES: readonly StatutCourseActive[] = STATUTS_COURSE_ACTIVE;

export async function GET(request: Request) {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;

  const db = creerClientAdmin() as unknown as SupabaseClient;
  const { data: livreur } = await db.from("livreurs").select("id").eq("utilisateur_id", auth.utilisateurId).limit(1).maybeSingle();
  if (!livreur) return repondre({ ok: true, file: null });

  const { data, error } = await db
    .from("livraisons")
    .select("id, mode, statut, frais_gnf, orders(reference, client_nom, client_telephone, client_adresse), restaurants(nom)")
    .eq("livreur_id", livreur.id)
    .in("statut", [...ACTIVES])
    .order("cree_le", { ascending: true })
    .order("id", { ascending: true })
    .limit(50);
  if (error) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Votre file de courses n'a pas pu être chargée. Réessayez dans un instant." });
  }

  type Relation<T> = T | T[] | null;
  const un = <T,>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);
  const lignes = (data ?? []) as unknown as Array<{
    id: string; mode: string; statut: string; frais_gnf: number;
    orders: Relation<{ reference: string; client_nom: string; client_telephone: string; client_adresse: string | null }>;
    restaurants: Relation<{ nom: string }>;
  }>;

  const cours: CourseLivreur[] = [];
  for (const l of lignes) {
    const statut = l.statut as StatutCourseActive;
    const mode = (l.mode === "propre" ? "propre" : "speedfood") as ModeCourseLivreur;
    const commande = un(l.orders);
    const apresRecuperation = statut === "recuperee" || statut === "vers_client";
    const projetee = projeterCourseLivreur({
      livraisonId: l.id,
      statut,
      mode,
      libelle: libelleCourseLivreur(statut, mode),
      commandeReference: commande?.reference ?? "—",
      restaurantNom: un(l.restaurants)?.nom ?? "Restaurant",
      fraisGnf: l.frais_gnf,
      etapesPossibles: ETAPES_COURSE_LIVREUR.filter((vers) => acteurPeut("livreur", statut, vers, mode)),
      client: apresRecuperation && commande ? { nom: commande.client_nom, telephone: commande.client_telephone, adresse: commande.client_adresse } : null,
    });
    if (projetee === null) {
      return repondreErreur({ code: "ERREUR_SERVEUR", message: "Votre file de courses n'a pas pu être chargée. Réessayez dans un instant." });
    }
    cours.push(projetee);
  }
  return repondre({ ok: true, file: { cours } });
}

export const dynamic = "force-dynamic";
