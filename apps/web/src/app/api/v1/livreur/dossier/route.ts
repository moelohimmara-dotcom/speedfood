import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { livreurAuthentifie } from "@/lib/api/v1-livreur";
import { lireDossier, lireReglagesLivreurs } from "@/lib/livraison/livreurs-service";
import { etatDossierLivreur } from "@/lib/livraison/livreurs-regles";

/**
 * « Mon dossier » du livreur du compte, pour l'application : ce qui manque à son dossier d'activation selon ce que la console exige
 * (pièce d'identité, personne à prévenir). Seul l'ÉTAT de chaque pièce sort (« a_jour » ou « manquant ») : jamais un numéro de pièce, un nom
 * ni un téléphone. L'identité du livreur vient du jeton. `dossier: null` : ce compte n'est pas un compte livreur. Livreur d'un restaurant :
 * aucune pièce n'est demandée. Lecture seule. Route créée pour la parité avec l'ancienne application, qui l'appelait déjà
 * (elle n'existait ni ici ni dans l'API unique).
 */
export async function GET(request: Request) {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;

  const db = creerClientAdmin() as unknown as SupabaseClient;
  const { data: livreur, error } = await db.from("livreurs").select("id, restaurant_id").eq("utilisateur_id", auth.utilisateurId).limit(1).maybeSingle();
  if (error) return repondreErreur({ code: "ERREUR_SERVEUR", message: "L'état de votre dossier n'a pas pu être vérifié. Réessayez dans un instant." });
  if (!livreur) return repondre({ ok: true, dossier: null });

  const ligne = livreur as { id: string; restaurant_id: string | null };
  const [reglages, dossier] = await Promise.all([lireReglagesLivreurs(db), lireDossier(ligne.id, db)]);
  return repondre({ ok: true, dossier: etatDossierLivreur({ restaurantId: ligne.restaurant_id, reglages, dossier }) });
}

export const dynamic = "force-dynamic";
