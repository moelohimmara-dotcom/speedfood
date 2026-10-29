import { NextResponse } from "next/server";
import { VERSION_APPLICATION } from "@/lib/application/version";

/**
 * Dernière version de l'application Android publiée (route PUBLIQUE, sans compte : l'application la lit avant même la connexion). Ne contient que des informations déjà
 * visibles sur `/installer`. Mise en cache brève : une publication est visible en quelques minutes.
 */
export async function GET() {
  return NextResponse.json({ ok: true, version: VERSION_APPLICATION }, { headers: { "Cache-Control": "public, max-age=300" } });
}
