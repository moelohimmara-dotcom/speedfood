import { WorkerEntrypoint } from "cloudflare:workers";
import handler from "./.open-next/worker.js";
import { calculerJetonSuivi } from "./src/lib/commande/jetons-calcul.ts";

import { CLE_JETON_ALERTE } from "./src/lib/worker/cle-alerte-interne.ts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Capacité spécialisée interne (ADR-021), jamais routée par le fetch HTTP public. */
export class JetonsCommande extends WorkerEntrypoint {
  deriver(cle) {
    try {
      return calculerJetonSuivi(cle, this.env.COMMANDE_JETON_SECRET || this.env.SUPABASE_SERVICE_ROLE_KEY);
    } catch {
      throw new Error("calcul_jeton_indisponible");
    }
  }

  /**
   * Alerte « nouvelle commande » du restaurant, demandée par l'API (qui n'a pas les secrets FCM/VAPID). Valide l'uuid, puis appelle DIRECTEMENT le gestionnaire OpenNext
   * (comme `scheduled` : la requête ne quitte pas le Worker, elle ne passe pas par `fetch` de `worker-entree.js` dont la garde refuse `/api/v1/interne/*` aux requêtes
   * externes) ; l'envoi continue après le retour de la RPC (`waitUntil`). Rend toujours `undefined`, sans rien divulguer. Le jeton aléatoire de l'isolat, inconnu de tout
   * client, prouve à la route que l'appel vient d'ici.
   */
  alerter(restaurantId) {
    try {
      if (typeof restaurantId !== "string" || !UUID.test(restaurantId)) return;
      const jeton = (globalThis[CLE_JETON_ALERTE] ??= `${crypto.randomUUID()}${crypto.randomUUID()}`);
      const requete = new Request("https://alerte.interne/api/v1/interne/alerte-commande", {
        method: "POST",
        headers: { "content-type": "application/json", "x-alerte-interne": jeton },
        body: JSON.stringify({ restaurantId }),
      });
      // Journaux : codes fixes seulement (jamais uuid, jeton ni adresse). Une réponse non ok trahit, par exemple, un jeton refusé par la route.
      this.ctx.waitUntil(
        handler.fetch(requete, this.env, this.ctx).then(
          (r) => { if (!r.ok) console.error("alerte_interne_statut", r.status); },
          () => { console.error("alerte_interne_echec"); }
        )
      );
    } catch {
      // Meilleur effort : rien ne remonte à l'API.
    }
  }
}
