import { NextResponse } from "next/server";
import { connexionClientActive } from "@/lib/client/reglage";

/**
 * Connexions par réseau social que l'équipe a ouvertes aux clients (route PUBLIQUE, sans compte : l'application la lit avant la connexion). Ne contient que l'état de l'interrupteur
 * « Connexion Facebook » de `/system/parametres`, déjà visible par n'importe quel visiteur du site (le bouton Facebook de `/entrer`). Tant que Facebook n'est pas prêt côté Meta,
 * l'interrupteur reste décoché et l'application n'affiche pas le bouton. En cas d'erreur, l'état « fermé » est renvoyé : jamais un bouton qui échouerait.
 */
export async function GET() {
  let facebook = false;
  try {
    facebook = await connexionClientActive();
  } catch {
    facebook = false;
  }
  return NextResponse.json({ ok: true, facebook }, { headers: { "Cache-Control": "public, max-age=60" } });
}
