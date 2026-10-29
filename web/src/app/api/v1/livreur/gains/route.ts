import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { bilansJourEtSemaine } from "@/lib/api/bilans";
import { livreurAuthentifie } from "@/lib/api/v1-livreur";

/**
 * Courses livrées par le livreur du compte : nombre et frais de course d'aujourd'hui et des 7 derniers jours, dernières courses. L'identité du livreur vient du jeton
 * (jamais d'un identifiant envoyé). Le montant est le frais de livraison de la course (`frais_gnf`) : ce n'est PAS une paie, la règle de rémunération n'existe pas
 * encore ; l'application l'écrit « frais de course ». `gains: null` : ce compte n'est pas un compte livreur.
 */
export async function GET(request: Request) {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const db = creerClientAdmin() as unknown as SupabaseClient;
  const { data: livreur } = await db.from("livreurs").select("id").eq("utilisateur_id", auth.utilisateurId).limit(1).maybeSingle();
  if (!livreur) return repondre({ ok: true, gains: null });
  const maintenant = Date.now();
  const depuis = new Date(maintenant - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("livraisons")
    .select("id, frais_gnf, livree_le, restaurants(nom), orders(reference)")
    .eq("livreur_id", livreur.id)
    .eq("statut", "livree")
    .gte("livree_le", depuis)
    .order("livree_le", { ascending: false })
    .limit(200);
  if (error) return repondreErreur({ code: "ERREUR_SERVEUR", message: "Vos courses n'ont pas pu être chargées. Réessayez dans un instant." });
  type Un<T> = T | T[] | null;
  const un = <T,>(v: Un<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const lignes = ((data ?? []) as unknown as Array<{ id: string; frais_gnf: number; livree_le: string | null; restaurants: Un<{ nom: string }>; orders: Un<{ reference: string }> }>).filter((l) => l.livree_le);
  const bilans = bilansJourEtSemaine(lignes.map((l) => ({ quand: l.livree_le as string, montantGnf: l.frais_gnf })), maintenant);
  return repondre({
    ok: true,
    gains: {
      aujourdhui: { courses: bilans.aujourdhui.nombre, fraisGnf: bilans.aujourdhui.montantGnf },
      semaine: { courses: bilans.semaine.nombre, fraisGnf: bilans.semaine.montantGnf },
      recentes: lignes.slice(0, 20).map((l) => ({ id: l.id, reference: un(l.orders)?.reference ?? "", restaurantNom: un(l.restaurants)?.nom ?? "", fraisGnf: l.frais_gnf, livreeLe: l.livree_le })),
    },
  });
}

export const dynamic = "force-dynamic";
