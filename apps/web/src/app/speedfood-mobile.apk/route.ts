import { NextResponse } from "next/server";
import { adresseApkMobile } from "@/lib/application/apk-mobile";

/**
 * Téléchargement de la NOUVELLE appli (com.speedfood.mobile) depuis le site. L'APK pèse plus de 25 Mio, limite d'un fichier statique dans le Worker :
 * elle est hébergée sur R2 et cette route redirige vers elle (décision de la cible : `adresseApkMobile`, testée). Rien n'est publié : 404.
 * Ne touche jamais `/speedfood.apk`, le fichier que l'ancienne appli télécharge.
 */
export function GET() {
  const cible = adresseApkMobile();
  if (!cible) return new NextResponse("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(cible, { status: 302, headers: { "Cache-Control": "public, max-age=300" } });
}
