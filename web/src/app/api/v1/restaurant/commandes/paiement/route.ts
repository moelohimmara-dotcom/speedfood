import { confirmerPaiement } from "@/lib/commande/service-paiement";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Confirme (« recu ») ou conteste (« non_recu ») le paiement d'une commande : même service et mêmes règles de base que la console du site. */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; decision?: unknown };
  const { supabase, restaurantId } = auth.contexte;
  const resultat = await confirmerPaiement(supabase, restaurantId, typeof corps.commandeId === "string" ? corps.commandeId : "", typeof corps.decision === "string" ? corps.decision : "");
  return resultat.ok ? repondre({ ok: true }) : repondreErreur(resultat.erreur);
}

export const dynamic = "force-dynamic";
