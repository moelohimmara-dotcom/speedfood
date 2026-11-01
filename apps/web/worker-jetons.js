import { WorkerEntrypoint } from "cloudflare:workers";
import { calculerJetonSuivi } from "./src/lib/commande/jetons-calcul.ts";

/** Capacité spécialisée interne (ADR-021), jamais routée par le fetch HTTP public. */
export class JetonsCommande extends WorkerEntrypoint {
  deriver(cle) {
    try {
      return calculerJetonSuivi(cle, this.env.COMMANDE_JETON_SECRET || this.env.SUPABASE_SERVICE_ROLE_KEY);
    } catch {
      throw new Error("calcul_jeton_indisponible");
    }
  }
}
