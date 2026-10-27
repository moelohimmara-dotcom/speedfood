import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import { importerPlatsEquipe } from "@/lib/system-admin/menu-photo-equipe";

/** Ajoute au menu d'un établissement tenu par l'équipe les plats relus depuis une photo (corps : `{ "plats": [{ "nom", "prix" }] }`) : permission `restaurant.moderer`, tracé dans le journal d'audit. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await importerPlatsEquipe(id, c.plats);
  if (!r.ok) return repondreErreur({ code: "VALIDATION", message: r.message });
  try {
    await journaliserActionSysteme(auth.contexte as unknown as ContexteSysteme, r.trace);
  } catch (erreur) {
    if (!(erreur instanceof ErreurMetier)) throw erreur;
  }
  return repondre({ ok: true, message: r.message, ajoutes: r.ajoutes });
}

export const dynamic = "force-dynamic";
