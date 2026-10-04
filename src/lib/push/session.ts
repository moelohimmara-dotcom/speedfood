import "server-only";
import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/db/server";

const ENTETES = { "Cache-Control": "no-store" } as const;

export function reponseJson(corps: unknown, statut = 200): Response {
  return NextResponse.json(corps, { status: statut, headers: ENTETES });
}

/**
 * Une requête qui MODIFIE des données doit venir de notre propre site : l'en-tête `Origin` (envoyé par tous les
 * navigateurs sur un POST ou un DELETE) doit correspondre à l'adresse du site. Défense en plus du `SameSite` des cookies.
 */
export function origineValide(requete: Request): boolean {
  const origine = requete.headers.get("origin");
  if (!origine) {
    return false;
  }
  try {
    return new URL(origine).host === new URL(requete.url).host;
  } catch {
    return false;
  }
}

export interface MembreCourant {
  utilisateurId: string;
  restaurantId: string;
}

/** Membre connecté et son restaurant (déduit de la session, jamais d'un paramètre), ou la réponse d'erreur à renvoyer. */
export async function obtenirMembreCourant(): Promise<{ membre: MembreCourant } | { erreur: Response }> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erreur: reponseJson({ code: "NON_AUTHENTIFIE" }, 401) };
  }
  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { erreur: reponseJson({ code: "NON_AUTORISE" }, 403) };
  }
  return { membre: { utilisateurId: user.id, restaurantId: membership.restaurant_id } };
}
