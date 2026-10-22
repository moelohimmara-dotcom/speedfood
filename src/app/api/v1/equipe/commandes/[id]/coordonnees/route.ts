import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { revelerCoordonneesSupport } from "@/lib/system-admin/commandes-service";

/**
 * Révèle le téléphone et l'adresse d'un client : permission `coordonees.voir`, motif obligatoire, trace d'audit écrite par la base AVANT de rendre les données.
 * Réponse sans cache, jamais journalisée côté serveur.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "coordonees.voir");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  if (!estUuid(id)) return repondreErreur({ code: "VALIDATION", message: "Commande inconnue." });
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  try {
    const coordonnees = await revelerCoordonneesSupport(auth.contexte.supabase, id, typeof c.motif === "string" ? c.motif : "");
    return repondre({ ok: true, coordonnees });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible de révéler les coordonnées." });
  }
}

export const dynamic = "force-dynamic";
