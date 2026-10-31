import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { enregistrerProfilClient } from "@/lib/client/espace-service";
import { relaisSiActif } from "@/lib/api/relais";

/** Écriture sur le compte connecté (profil) : mêmes règles et mêmes limites que le site ; l'identité vient du jeton. */
export async function POST(request: Request) {
  const relais = await relaisSiActif(request, "client");
  if (relais) return relais;
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await enregistrerProfilClient(auth.utilisateurId, c);
  return r.ok ? repondre({ ok: true, message: r.message }) : repondreErreur({ code: "VALIDATION", message: r.message });
}

export const dynamic = "force-dynamic";
