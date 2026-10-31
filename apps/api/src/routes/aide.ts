import { Hono } from "hono";
import type { Deps } from "../types.ts";

/** Contact d'assistance (rubrique Aide) : numéro WhatsApp de l'administration, ou `null`. Route PUBLIQUE, cache court. */
export function routeAide(deps: Pick<Deps, "lireAssistance">) {
  const route = new Hono();
  route.get("/", async (c) => {
    const { whatsapp } = await deps.lireAssistance();
    return c.json({ ok: true, whatsapp }, 200, { "Cache-Control": "public, max-age=300" });
  });
  return route;
}
