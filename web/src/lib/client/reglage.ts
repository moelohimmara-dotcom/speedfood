import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Interrupteur de la connexion Facebook des clients, réglé depuis `/system/parametres`. Désactivé par défaut : tant que
 * Facebook n'est pas configuré dans Supabase, aucun bouton n'est affiché et la route de départ refuse de démarrer.
 */
export async function connexionClientActive(): Promise<boolean> {
  const { data, error } = await creerClientAdmin()
    .from("parametres_application")
    .select("connexion_facebook_active")
    .eq("id", true)
    .maybeSingle();
  return !error && data?.connexion_facebook_active === true;
}

/** Interrupteur de la connexion Google des clients (même principe que Facebook, réglé depuis `/system/parametres`). */
export async function connexionGoogleActive(): Promise<boolean> {
  const { data, error } = await creerClientAdmin()
    .from("parametres_application")
    .select("connexion_google_active")
    .eq("id", true)
    .maybeSingle();
  return !error && data?.connexion_google_active === true;
}
