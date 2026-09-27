import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Client Supabase lié à la session utilisateur (cookies), en clé anon — la RLS
 * s'applique normalement selon l'utilisateur connecté (owner/manager de restaurant,
 * admin système). Préparé pour le bloc 4 (authentification) ; pas encore utilisé
 * tant qu'aucun flux de connexion n'est branché.
 *
 * Server Components / route handlers uniquement (dépend de next/headers).
 */
export async function creerClientServeur() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies (voir .env.example)."
    );
  }

  const magasinCookies = await cookies();

  return createServerClient<Database>(url, cle, {
    cookies: {
      getAll() {
        return magasinCookies.getAll();
      },
      setAll(cookiesASetter) {
        try {
          for (const { name, value, options } of cookiesASetter) {
            magasinCookies.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component (lecture seule) : la session sera
          // rafraîchie par le middleware une fois celui-ci ajouté au bloc 4.
        }
      },
    },
  });
}
