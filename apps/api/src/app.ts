import { Hono } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { entetesCourants } from "./cales/next-headers.ts";
import { reponseErreur } from "./http.ts";
import { routeAide } from "./routes/aide.ts";
import { routeVersion } from "./routes/version.ts";
import type { Deps } from "./types.ts";

export { reponseErreur };

const SANS_CACHE = { "Cache-Control": "no-store" };

export function creerApp(deps: Deps) {
  const app = new Hono();

  // Premier maillon : les en-têtes de la requête sont disponibles, partout et sans paramètre, pour le code du site qui appelle `headers()`.
  app.use("*", (c, suivant) => entetesCourants.run(c.req.raw.headers, suivant));

  app.get("/sante", (c) => c.json({ ok: true }, 200, SANS_CACHE));
  app.route("/api/v1/version", routeVersion(deps));
  app.route("/api/v1/aide", routeAide(deps));

  app.notFound((c) => reponseErreur(c, { code: "INTROUVABLE", message: "Route inconnue." }));
  app.onError((erreur, c) => {
    if (erreur instanceof ErreurMetier) return reponseErreur(c, erreur.toApi());
    console.error("api_erreur_non_geree", erreur instanceof Error ? erreur.name : "inconnue");
    return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  });

  return app;
}
