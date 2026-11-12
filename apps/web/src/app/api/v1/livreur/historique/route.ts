import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { livreurAuthentifie } from "@/lib/api/v1-livreur";

/** Nombre de courses livrées par page d'historique (même taille que l'ancienne application attend). */
const TAILLE_PAGE = 20;

/**
 * Historique paginé des courses livrées du livreur du compte (page 1 = la plus récente), pour l'application.
 * L'identité du livreur vient du jeton (jamais d'un identifiant envoyé) ; la page demandée est portée par le corps, comme l'historique
 * du restaurateur. Le montant est le frais de livraison de la course (`frais_gnf`) : ce n'est pas une paie. `historique: null` :
 * ce compte n'est pas un compte livreur. Aucune coordonnée du client n'est lue ni renvoyée.
 */
export async function POST(request: Request) {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { page?: unknown };
  const page = typeof corps.page === "number" && Number.isInteger(corps.page) && corps.page >= 1 ? corps.page : 1;

  const db = creerClientAdmin() as unknown as SupabaseClient;
  const { data: livreur } = await db.from("livreurs").select("id").eq("utilisateur_id", auth.utilisateurId).limit(1).maybeSingle();
  if (!livreur) return repondre({ ok: true, historique: null });

  const debut = (page - 1) * TAILLE_PAGE;
  const [lignes, compte] = await Promise.all([
    db
      .from("livraisons")
      .select("id, frais_gnf, livree_le, restaurants(nom), orders(reference)")
      .eq("livreur_id", livreur.id)
      .eq("statut", "livree")
      .not("livree_le", "is", null)
      .order("livree_le", { ascending: false })
      .range(debut, debut + TAILLE_PAGE - 1),
    db
      .from("livraisons")
      .select("id", { count: "exact", head: true })
      .eq("livreur_id", livreur.id)
      .eq("statut", "livree")
      .not("livree_le", "is", null),
  ]);
  if (lignes.error || compte.error) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Votre historique n'a pas pu être chargé. Réessayez dans un instant." });
  }

  type Un<T> = T | T[] | null;
  const un = <T,>(v: Un<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const courses = ((lignes.data ?? []) as unknown as Array<{ id: string; frais_gnf: number; livree_le: string | null; restaurants: Un<{ nom: string }>; orders: Un<{ reference: string }> }>).map((l) => ({
    id: l.id,
    reference: un(l.orders)?.reference ?? "",
    restaurantNom: un(l.restaurants)?.nom ?? "",
    fraisGnf: l.frais_gnf,
    livreeLe: l.livree_le,
  }));
  const total = compte.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  return repondre({ ok: true, historique: { courses, page, pages } });
}

export const dynamic = "force-dynamic";
