import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { corpsTropGros, statutHttp } from "@speedfood/shared/api/v1-regles";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse JSON sans cache (jamais de commande ni de compte dans un cache partagé) : même contrat que `repondre` du site. */
export function repondre(c: Context, corps: unknown, statut = 200): Response {
  return c.json(corps as object, statut as ContentfulStatusCode, SANS_CACHE);
}

/** Réponse d'erreur au contrat uniforme `{ ok: false, erreur: { code, message } }`, statut dérivé du code. */
export function reponseErreur(c: Context, erreur: ErreurApi): Response {
  return repondre(c, { ok: false, erreur }, statutHttp(erreur.code));
}

/** Corps JSON d'une requête, ou une réponse d'erreur toute prête : mêmes refus et mêmes messages que `lireCorpsJson` du site. */
export async function lireCorpsJson(c: Context): Promise<{ ok: true; corps: unknown } | { ok: false; reponse: Response }> {
  if (!(c.req.header("content-type") ?? "").includes("application/json")) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON attendu." }) };
  }
  if (corpsTropGros(c.req.header("content-length") ?? null)) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête trop volumineuse." }) };
  }
  try {
    return { ok: true, corps: await c.req.json() };
  } catch {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON illisible." }) };
  }
}

/**
 * Formulaire multipart d'une requête, lu avec une LIMITE sur le corps ENTIER (lot D4c, envoi de photo). Refus avant toute lecture : ce n'est pas du multipart (400), `Content-Length` illisible (400) ou
 * supérieur à la limite (413). Le flux est en plus compté pendant la lecture : un `Content-Length` absent ou mensonger ne permet pas de faire lire plus que la limite (413). Rien n'est journalisé.
 */
export async function lireFormulaireBorne(c: Context, limiteOctets: number): Promise<{ ok: true; formulaire: FormData } | { ok: false; reponse: Response }> {
  const type = c.req.header("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type)) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : formulaire attendu." }) };
  }
  const trop = () => ({ ok: false as const, reponse: repondre(c, { ok: false, erreur: { code: "VALIDATION", message: `Envoi trop volumineux (${Math.round(limiteOctets / 1024 / 1024)} Mo au maximum).` } }, 413) });
  const declare = c.req.header("content-length");
  if (declare !== undefined) {
    if (!/^\d{1,12}$/.test(declare.trim())) return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide." }) };
    if (Number(declare) > limiteOctets) return trop();
  }
  const source = c.req.raw.body;
  if (source === null) return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Envoi illisible. Réessayez." }) };
  let lus = 0;
  let depasse = false;
  const compteur = new TransformStream<Uint8Array, Uint8Array>({
    transform(morceau, flux) {
      lus += morceau.byteLength;
      if (lus > limiteOctets) { depasse = true; flux.error(new Error("corps trop gros")); return; }
      flux.enqueue(morceau);
    },
  });
  try {
    const requete = new Request("https://borne.invalide/", { method: "POST", headers: { "content-type": type }, body: source.pipeThrough(compteur), duplex: "half" } as RequestInit);
    return { ok: true, formulaire: await requete.formData() };
  } catch {
    if (depasse) return trop();
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Envoi illisible. Réessayez." }) };
  }
}
