import { traiterCommande } from "@/lib/commande/service-restaurant";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Accepter, refuser, déclarer prête, terminer ou annuler une commande : même service que la console du site (machine à états, proposition en cours, RLS). */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; action?: unknown };
  const { supabase, utilisateurId, restaurantId } = auth.contexte;
  const resultat = await traiterCommande(supabase, utilisateurId, restaurantId, typeof corps.commandeId === "string" ? corps.commandeId : "", typeof corps.action === "string" ? corps.action : "");
  return resultat.ok ? repondre({ ok: true }) : repondreErreur(resultat.erreur);
}

export const dynamic = "force-dynamic";
