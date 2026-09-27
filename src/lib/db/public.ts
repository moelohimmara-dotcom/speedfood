import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client Supabase en clé publique (anon), sans session utilisateur.
 * Utilisable dans les Server Components pour le catalogue public : la visibilité
 * réelle des lignes reste entièrement gouvernée par les policies RLS côté base
 * (ex. "lecture_publique_restaurants_publies"), pas par ce fichier.
 *
 * Ne jamais utiliser ce client pour une écriture sensible (commande, statut) —
 * voir src/lib/db/admin.ts pour ces cas, exclusivement dans des route handlers serveur.
 */
export function creerClientPublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies (voir .env.example)."
    );
  }

  return createClient<Database>(url, cle);
}
