import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import { chercherCommandesSupport } from "@/lib/system-admin/commandes-service";

/** Recherche de commandes pour le support (référence, statut, « du jour », restaurant) : permission `commande.consulter`. Coordonnées déjà masquées par la base. */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.consulter");
  if (!auth.ok) return auth.reponse;
  const q = new URL(request.url).searchParams;
  const statut = q.get("statut") ?? "tous";
  const reference = (q.get("reference") ?? "").trim().slice(0, 40);
  const restaurantId = q.get("restaurantId") ?? "";
  const commandes = await chercherCommandesSupport(auth.contexte.supabase, {
    reference: reference || undefined,
    statut: (STATUTS_COMMANDE as readonly string[]).includes(statut) ? (statut as StatutCommande) : "tous",
    jour: q.get("jour") === "1",
    restaurantId: /^[0-9a-f-]{36}$/i.test(restaurantId) ? restaurantId : undefined,
  });
  return repondre({ ok: true, commandes });
}

export const dynamic = "force-dynamic";
