import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { lirePlatsMenuEquipe } from "@/lib/system-admin/menus-equipe-service";

/** Plats d'un établissement tenu par l'équipe, avec leur état de fraîcheur : permission `restaurant.moderer`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  const menu = await lirePlatsMenuEquipe(id);
  if (!menu) return repondreErreur({ code: "VALIDATION", message: "Établissement introuvable ou non tenu par l'équipe." });
  return repondre({ ok: true, ...menu });
}

export const dynamic = "force-dynamic";
