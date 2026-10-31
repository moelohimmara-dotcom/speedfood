import { repondre, repondreErreur } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { lireMenuCandidat } from "@/lib/referencement/menu-photo";

/** Lecture d'une photo de menu pour le brouillon d'une candidature (formulaire multipart : `fichier`). Rien n'est enregistré : la liste revient à l'application pour relecture. */
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
  const r = await lireMenuCandidat(auth.utilisateurId, fichier instanceof File ? fichier : null);
  return r.ok ? repondre({ ok: true, lecture: r.lecture }) : repondreErreur({ code: r.code, message: r.message });
}

export const dynamic = "force-dynamic";
