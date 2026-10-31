import { repondre } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { lireEspaceClient } from "@/lib/client/espace-service";
import { relaisSiActif } from "@/lib/api/relais";

/** Profil, adresses, favoris et avis du compte connecté, en un seul appel (ouverture de l'espace client de l'application). */
export async function GET(request: Request) {
  const relais = await relaisSiActif(request, "client");
  if (relais) return relais;
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  return repondre({ ok: true, ...(await lireEspaceClient(auth.utilisateurId)) });
}

export const dynamic = "force-dynamic";
