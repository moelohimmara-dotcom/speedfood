import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { deposerCandidature, lireCandidature } from "@/lib/referencement/candidature-service";

/**
 * Candidature de l'application « J'ai un restaurant » : lecture de la demande du compte connecté (null s'il n'en a pas) et dépôt d'une nouvelle demande de
 * référencement. L'identité est celle du jeton ; commune, quartier et e-mail sont retrouvés par le serveur.
 */
export async function GET(request: Request) {
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  return repondre({ ok: true, candidature: await lireCandidature(auth.utilisateurId) });
}

export async function POST(request: Request) {
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const r = await deposerCandidature(auth.utilisateurId, lu.corps);
  return r.ok ? repondre({ ok: true, candidature: r.candidature }, 201) : repondreErreur({ code: r.code, message: r.message });
}

export const dynamic = "force-dynamic";
