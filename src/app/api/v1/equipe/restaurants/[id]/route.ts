import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { lireFicheRestaurantEquipe } from "@/lib/system-admin/restaurants-equipe-service";

/** Fiche d'un établissement pour l'équipe : identité, état de publication, horaires, consignes, numéro à joindre et menu (plats) : permission `restaurant.moderer`. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await equipeAuthentifiee(request, "restaurant.moderer");
  if (!auth.ok) return auth.reponse;
  const { id } = await params;
  try {
    const fiche = await lireFicheRestaurantEquipe(id);
    if (!fiche) return repondreErreur({ code: "INTROUVABLE", message: "Établissement introuvable." });
    return repondre({ ok: true, restaurant: fiche });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "La fiche n'a pas pu être chargée. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
