import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client Supabase en clé service-role — CONTOURNE la RLS entièrement.
 *
 * Règles non négociables (AGENT-INSTRUCTIONS.md) :
 * - Ne jamais importer ce fichier depuis un Client Component ou tout code qui finit
 *   dans le bundle navigateur. Le `import "server-only"` fait échouer le build si
 *   c'est le cas.
 * - Réservé aux opérations où le serveur doit être la seule source d'autorité :
 *   création de commande (recalcul du total, génération du jeton de suivi),
 *   transitions de statut déclenchées par une action serveur validée.
 * - Ne jamais renvoyer ce client ni sa clé au navigateur, ni la logger.
 * - Pour toute lecture qui peut passer par les policies RLS normales (catalogue
 *   public, menu), utiliser src/lib/db/public.ts à la place.
 */
export function creerClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cleServiceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies pour le client admin (voir .env.example)."
    );
  }

  return createClient<Database>(url, cleServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
