import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { estUuid } from "@/lib/commande/commun";
import { changerStatutSupport } from "@/lib/system-admin/commandes-service";

/** Action de support sur le statut d'une commande : motif obligatoire, transition validée et tracée par la base (acteur `support:<id>`). Permission `commande.support`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  if (!estUuid(id)) return repondreErreur({ code: "VALIDATION", message: "Commande inconnue." });
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const resultat = await changerStatutSupport(auth.contexte.supabase, id, c.vers, c.motif);
  return resultat.ok ? repondre({ ok: true }) : repondreErreur({ code: "VALIDATION", message: resultat.message });
}

export const dynamic = "force-dynamic";
