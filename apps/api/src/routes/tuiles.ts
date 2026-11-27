import { Hono } from "hono";
import type { Deps } from "../types.ts";
import { cleCache, urlFournisseur, validerTuile } from "../tuiles/relais.ts";

/** Une tuile de 256 pixels pèse quelques Ko ; au-delà, la réponse du fournisseur n'est pas une tuile. */
const TAILLE_MAX_OCTETS = 300_000;
/** Une tuile change rarement : un jour de cache évite de redemander au fournisseur (et de consommer son quota). */
const CACHE_TUILE = "public, max-age=86400";
const erreur = (code: string, message: string) => ({ ok: false, erreur: { code, message } });

/**
 * `GET /api/v1/tuiles/:z/:x/:y(.png)` : fond de carte de l'appli. Route PUBLIQUE (les images se chargent sans en-tête d'identité) mais bornée : zooms 2 à 17, Guinée seulement.
 * La clé du fournisseur est lue à l'appel, n'apparaît dans aucune réponse ; une panne du fournisseur donne 502 (l'appli garde alors ses repères sur fond uni).
 */
export function routeTuiles(deps: Pick<Deps, "tuiles">) {
  const route = new Hono();
  route.get("/:z/:x/:y", async (c) => {
    const tuile = validerTuile(c.req.param("z"), c.req.param("x"), c.req.param("y").replace(/\.png$/, ""));
    if (!tuile) return c.json(erreur("INTROUVABLE", "Tuile hors zone."), 404, { "Cache-Control": "no-store" });
    const cle = deps.tuiles?.cle();
    if (!deps.tuiles || !cle) return c.json(erreur("INDISPONIBLE", "Fond de carte indisponible."), 503, { "Cache-Control": "no-store" });

    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    const cleDuCache = new Request(cleCache(tuile));
    const enCache = await cache?.match(cleDuCache).catch(() => undefined);
    if (enCache) return new Response(enCache.body, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": CACHE_TUILE } });

    let amont: Response;
    try { amont = await deps.tuiles.chercher(urlFournisseur(tuile, cle)); } catch { return c.json(erreur("FOURNISSEUR", "Fond de carte momentanément indisponible."), 502, { "Cache-Control": "no-store" }); }
    const octets = amont.ok ? await amont.arrayBuffer().catch(() => null) : null;
    const typeOk = (amont.headers.get("content-type") ?? "").startsWith("image/png");
    if (!octets || !typeOk || octets.byteLength === 0 || octets.byteLength > TAILLE_MAX_OCTETS) {
      return c.json(erreur("FOURNISSEUR", "Fond de carte momentanément indisponible."), 502, { "Cache-Control": "no-store" });
    }
    const reponse = new Response(octets, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": CACHE_TUILE } });
    if (cache) { try { c.executionCtx.waitUntil(cache.put(cleDuCache, reponse.clone())); } catch { /* pas de contexte d'exécution (essais) : pas de mise en cache */ } }
    return reponse;
  });
  return route;
}
