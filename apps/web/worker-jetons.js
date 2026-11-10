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

  /**
   * Alerte « nouvelle demande de réservation » (lot M4c) : même mécanisme que `alerter`, route interne distincte. N'altère pas `alerter` (commandes). Valide l'uuid ; rend toujours `undefined`.
   */
  alerterReservation(restaurantId) {
    try {
      if (typeof restaurantId !== "string" || !UUID.test(restaurantId)) return;
      relayerVersRouteInterne(this, "/api/v1/interne/alerte-reservation", { restaurantId });
    } catch {
      // Meilleur effort : rien ne remonte à l'API.
    }
  }

  /**
   * Message au client après la réponse du restaurant (lot M4c). Valide l'uuid de la réservation et le statut (trois réponses seulement) ; le compte du client n'est jamais transmis, la route le relit.
   * Rend toujours `undefined`.
   */
  prevenirClientReservation(reservationId, statut) {
    try {
      if (typeof reservationId !== "string" || !UUID.test(reservationId)) return;
      if (typeof statut !== "string" || !["confirmee", "refusee", "annulee_restaurant"].includes(statut)) return;
      relayerVersRouteInterne(this, "/api/v1/interne/message-reservation", { reservationId, statut });
    } catch {
      // Meilleur effort : rien ne remonte à l'API.
    }
  }
}

/**
 * Appel direct du gestionnaire OpenNext (comme `alerter`) pour les routes internes de la réservation. Fonction de MODULE et non méthode de la classe : une méthode serait appelable par la liaison de service
 * avec un chemin au choix ; ici le chemin est fixé par les deux entrées ci-dessus. Journaux : codes fixes seulement.
 */
function relayerVersRouteInterne(entree, chemin, corps) {
  const jeton = (globalThis[CLE_JETON_ALERTE] ??= `${crypto.randomUUID()}${crypto.randomUUID()}`);
  const requete = new Request(`https://alerte.interne${chemin}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-alerte-interne": jeton },
    body: JSON.stringify(corps),
  });
  entree.ctx.waitUntil(
    handler.fetch(requete, entree.env, entree.ctx).then(
      (r) => { if (!r.ok) console.error("alerte_interne_statut", r.status); },
      () => { console.error("alerte_interne_echec"); }
    )
  );
}
