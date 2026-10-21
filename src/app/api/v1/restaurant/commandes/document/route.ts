import { emettreDocument } from "@/lib/commande/service-paiement";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Établit le reçu numéroté ou la facture d'une commande (numérotation continue, contrôles dans la base) ; demander deux fois le même document renvoie le premier. */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { commandeId?: unknown; type?: unknown };
  const resultat = await emettreDocument(auth.contexte.supabase, typeof corps.commandeId === "string" ? corps.commandeId : "", typeof corps.type === "string" ? corps.type : "");
  return resultat.ok ? repondre({ ok: true }) : repondreErreur(resultat.erreur);
}

export const dynamic = "force-dynamic";
