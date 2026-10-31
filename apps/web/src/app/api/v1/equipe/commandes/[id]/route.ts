import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { estUuid } from "@/lib/commande/commun";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { lireCommandeSupport, transitionsPossibles } from "@/lib/system-admin/commandes-service";

/** Détail d'une commande pour le support : historique, propositions, et les statuts possibles (règle commune) si le compte peut agir (`commande.support`). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "commande.consulter");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  if (!estUuid(id)) return repondreErreur({ code: "VALIDATION", message: "Commande inconnue." });
  const commande = await lireCommandeSupport(auth.contexte.supabase, id);
  if (!commande) return repondreErreur({ code: "VALIDATION", message: "Commande inconnue." });
  const peutAgir = roleAPermission(auth.contexte.role, "commande.support");
  const peutReveler = roleAPermission(auth.contexte.role, "coordonees.voir");
  return repondre({ ok: true, commande, transitions: peutAgir ? transitionsPossibles(commande.statut) : [], peutReveler });
}

export const dynamic = "force-dynamic";
