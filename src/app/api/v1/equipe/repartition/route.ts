import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerCommandesARepartir } from "@/lib/system-admin/repartition-lecture";

/** Commandes actives des établissements tenus par l'équipe (poste de répartition) : permission `commande.support`. */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  return repondre({ ok: true, commandes: await listerCommandesARepartir() });
}

export const dynamic = "force-dynamic";
