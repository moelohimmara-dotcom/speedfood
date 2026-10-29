import { repondre, repondreErreur } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { ajouterImageCandidature } from "@/lib/referencement/candidature-service";

/** Logo ou photo de la candidature (formulaire multipart : `type` = `logo` ou `photo`, `fichier`). Dépôt privé ; contrôles du fichier identiques à ceux du site. */
export async function POST(request: Request) {
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  let formulaire: FormData;
  try {
    formulaire = await request.formData();
  } catch {
    return repondreErreur({ code: "VALIDATION", message: "Envoi illisible. Réessayez." });
  }
  const fichier = formulaire.get("fichier");
  const r = await ajouterImageCandidature(auth.utilisateurId, formulaire.get("type"), fichier instanceof File ? fichier : null);
  return r.ok ? repondre({ ok: true, candidature: r.candidature }) : repondreErreur({ code: r.code, message: r.message });
}

export const dynamic = "force-dynamic";
