import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client Supabase LIÉ À L'IDENTITÉ d'un jeton porteur (application native) : les requêtes partent avec le jeton de la personne, donc la RLS s'applique comme
 * pour la console du site (un restaurant ne voit ni ne modifie que ses lignes), sans élévation de clé de service. Le jeton doit avoir été vérifié par l'appelant.
 */
export function creerClientJeton(jeton: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies (voir .env.example).");
  return createClient<Database>(url, cle, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
