import { proposerRevision } from "@/lib/commande/service-restaurant";
import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Propose au client un changement (montant, frais, conditions) sur une commande en attente : le client décide, rien n'est préparé avant sa réponse. */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as {
    commandeId?: unknown;
    nouveauSousTotal?: unknown;
    nouveauxFraisLivraison?: unknown;
    conditionsModifiees?: unknown;
  };
  if (typeof corps.nouveauSousTotal !== "number" || typeof corps.nouveauxFraisLivraison !== "number") {
    return repondreErreur({ code: "VALIDATION", message: "Les montants doivent être des nombres entiers en GNF." });
  }
  const { supabase, restaurantId } = auth.contexte;
  const resultat = await proposerRevision(supabase, restaurantId, typeof corps.commandeId === "string" ? corps.commandeId : "", {
    nouveauSousTotal: corps.nouveauSousTotal,
    nouveauxFraisLivraison: corps.nouveauxFraisLivraison,
    conditionsModifiees: typeof corps.conditionsModifiees === "string" ? corps.conditionsModifiees : null,
  });
  return resultat.ok ? repondre({ ok: true }) : repondreErreur(resultat.erreur);
}

export const dynamic = "force-dynamic";
