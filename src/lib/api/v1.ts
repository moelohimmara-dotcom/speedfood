import "server-only";
import { NextResponse } from "next/server";
import { creerClientAdmin } from "@/lib/db/admin";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { corpsTropGros, lireBearer, statutHttp } from "./v1-regles";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse JSON sans cache (jamais de commande ni de jeton de suivi dans un cache partagé). */
export function repondre(corps: unknown, statut = 200): NextResponse {
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

export function repondreErreur(erreur: ErreurApi): NextResponse {
  return repondre({ ok: false, erreur }, statutHttp(erreur.code));
}

/**
 * Utilisateur du jeton porteur, vérifié auprès du service d'authentification (signature, expiration, compte existant) ; null si absent ou invalide.
 * Les cookies de session du site ne sont JAMAIS lus ici.
 */
export async function utilisateurDuJeton(request: Request): Promise<{ id: string } | null> {
  const jeton = lireBearer(request.headers.get("authorization"));
  if (!jeton) return null;
  const { data, error } = await creerClientAdmin().auth.getUser(jeton);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

/** Corps JSON d'une requête, ou une réponse d'erreur toute prête (type de contenu, taille, JSON valide). */
export async function lireCorpsJson(request: Request): Promise<{ ok: true; corps: unknown } | { ok: false; reponse: NextResponse }> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return { ok: false, reponse: repondreErreur({ code: "VALIDATION", message: "Requête invalide : JSON attendu." }) };
  }
  if (corpsTropGros(request.headers.get("content-length"))) {
    return { ok: false, reponse: repondreErreur({ code: "VALIDATION", message: "Requête trop volumineuse." }) };
  }
  try {
    return { ok: true, corps: await request.json() };
  } catch {
    return { ok: false, reponse: repondreErreur({ code: "VALIDATION", message: "Requête invalide : JSON illisible." }) };
  }
}
