import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { lireMenuPhotoEquipe } from "@/lib/system-admin/menu-photo-equipe";

/** Lecture d'une photo de menu pour un établissement tenu par l'équipe (multipart : `fichier`) : permission `restaurant.moderer`. Rien n'est enregistré, la liste revient pour relecture. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  let formulaire: FormData;
  try {
    formulaire = await request.formData();
  } catch {
    return repondreErreur({ code: "VALIDATION", message: "Envoi illisible. Réessayez." });
  }
  const fichier = formulaire.get("fichier");
  const r = await lireMenuPhotoEquipe(id, fichier instanceof File ? fichier : null);
  return r.ok ? repondre({ ok: true, lecture: r.lecture }) : repondreErreur({ code: r.code, message: r.message });
}

export const dynamic = "force-dynamic";
