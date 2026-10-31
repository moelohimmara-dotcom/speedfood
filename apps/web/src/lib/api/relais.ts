import "server-only";
import { creerSignalUnique, decisionRelais, ipVisiteurDepuisEntetes, relayer, type OptionsRoute } from "./relais-regles";

// Une seule ligne de journal par isolat (pas une par requête) ; le message ne contient jamais ni secret ni adresse.
const signalerMalConfigure = creerSignalUnique(() => console.error("relais_mal_configure"));

/**
 * Garde de relais des routes `/api/v1/*` : rend la réponse de l'API quand le relais est allumé pour ce module (`API_RELAIS`), sinon `null` et la route du site traite elle-même.
 * ÉTEINT par défaut : sans `API_RELAIS`, aucun appel, aucune lecture du corps, comportement strictement inchangé. Toute la décision est dans `relais-regles.ts` (testée).
 * `options` (étape 1c-1) : `lecture: true` pour une route POST qui ne fait que lire (repli permis, corps conservé), `delaiMs` pour un délai propre à la route. Sans options : comportement de 1b.
 */
export async function relaisSiActif(request: Request, module: string, options?: OptionsRoute): Promise<Response | null> {
  const decision = decisionRelais({ API_RELAIS: process.env.API_RELAIS, API_URL: process.env.API_URL, RELAIS_SECRET: process.env.RELAIS_SECRET }, module, request, options);
  if (decision.type === "eteint") return null;
  if (decision.type === "mal-configure") {
    signalerMalConfigure();
    return null;
  }
  const ip = ipVisiteurDepuisEntetes(request.headers.get("cf-connecting-ip"), request.headers.get("x-forwarded-for"));
  return relayer(request, new URL(request.url).pathname, { baseApi: decision.baseApi, secret: decision.secret, ipVisiteur: ip, delaiMs: options?.delaiMs }, decision.repliPossible);
}
