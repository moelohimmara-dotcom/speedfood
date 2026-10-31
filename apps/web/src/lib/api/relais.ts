import "server-only";
import { ipVisiteurDepuisEntetes, moduleRelaye, relayer } from "./relais-regles";

/**
 * Garde de relais des routes `/api/v1/*` : rend la réponse de l'API quand le relais est allumé pour ce module (`API_RELAIS`), sinon `null` et la route du site traite elle-même.
 * ÉTEINT par défaut : sans `API_RELAIS`, aucun appel, aucune lecture du corps, comportement strictement inchangé.
 */
export async function relaisSiActif(request: Request, module: string): Promise<Response | null> {
  if (!moduleRelaye(process.env.API_RELAIS, module)) return null;
  const baseApi = process.env.API_URL;
  const secret = process.env.RELAIS_SECRET;
  if (!baseApi || !secret) {
    console.error("relais_mal_configure");
    return null;
  }
  const ip = ipVisiteurDepuisEntetes(request.headers.get("cf-connecting-ip"), request.headers.get("x-forwarded-for"));
  return relayer(request, new URL(request.url).pathname, { baseApi, secret, ipVisiteur: ip }, request.method === "GET");
}
