import { Hono } from "hono";
import type { Context } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { statutHttp } from "@speedfood/shared/api/v1-regles";
import { entetesCourants } from "./cales/next-headers.ts";
import type { Deps } from "./types.ts";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse d'erreur au contrat uniforme du site : `{ ok: false, erreur: { code, message } }`. */
export function reponseErreur(c: Context, erreur: ErreurApi): Response {
  return c.json({ ok: false, erreur }, statutHttp(erreur.code) as 400, SANS_CACHE);
}

export function creerApp(_deps: Deps) {
  const app = new Hono();

  // Premier maillon : les en-têtes de la requête sont disponibles, partout et sans paramètre, pour le code du site qui appelle `headers()`.
  app.use("*", (c, suivant) => entetesCourants.run(c.req.raw.headers, suivant));

  app.get("/sante", (c) => c.json({ ok: true }, 200, SANS_CACHE));

  app.notFound((c) => reponseErreur(c, { code: "INTROUVABLE", message: "Route inconnue." }));
  app.onError((erreur, c) => {
    if (erreur instanceof ErreurMetier) return reponseErreur(c, erreur.toApi());
    console.error("api_erreur_non_geree");
    return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  });

  return app;
}
