import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { definirPhotoPlat, retirerPhotoPlat } from "@/lib/menu/photo-plat";

/**
 * Photo d'un plat depuis l'application : envoi (formulaire multipart : `platId` + `photo`) ou retrait (`retirer=1`, sans fichier). Le restaurant est celui du compte,
 * jamais un identifiant envoyé ; les contrôles du fichier (type, taille, signature, quota) sont ceux de la console du site.
 */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;

  let formulaire: FormData;
  try {
    formulaire = await request.formData();
  } catch {
    return repondreErreur({ code: "VALIDATION", message: "Envoi illisible. Réessayez." });
  }
  const { supabase, restaurantId } = auth.contexte;
  const platId = formulaire.get("platId");

  const resultat =
    formulaire.get("retirer") === "1"
      ? await retirerPhotoPlat(supabase, restaurantId, platId)
      : await definirPhotoPlat(supabase, restaurantId, platId, formulaire.get("photo") instanceof File ? (formulaire.get("photo") as File) : null);
  return resultat.ok ? repondre({ ok: true }) : repondreErreur({ code: "VALIDATION", message: resultat.message });
}

export const dynamic = "force-dynamic";
