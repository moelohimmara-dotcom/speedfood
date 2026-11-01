// Fixture locale : n'est importée ni par le site ni par le Worker API de production.
import { WorkerEntrypoint } from "cloudflare:workers";
import { createHmac } from "node:crypto";

export class CalculEssai extends WorkerEntrypoint {
  deriver(cle) {
    if (typeof cle !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cle)) {
      throw new Error("calcul-refuse");
    }
    return createHmac("sha256", this.env.SECRET_FICTIF)
      .update(`speedfood-jeton-suivi-v1:${cle}`).digest("base64url").slice(0, 40);
  }
}
