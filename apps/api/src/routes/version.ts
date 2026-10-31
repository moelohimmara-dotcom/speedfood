import { Hono } from "hono";
import type { Deps } from "../types.ts";

/** Dernière version de l'application publiée. Route PUBLIQUE (l'application la lit avant la connexion) ; cache court : une publication est visible en quelques minutes. */
export function routeVersion(deps: Pick<Deps, "version">) {
  const route = new Hono();
  route.get("/", (c) => c.json({ ok: true, version: deps.version }, 200, { "Cache-Control": "public, max-age=300" }));
  return route;
}
