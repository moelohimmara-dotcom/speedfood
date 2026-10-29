import { NextResponse } from "next/server";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";

/**
 * Contact d'assistance affiché dans l'application (rubrique Aide) : le numéro WhatsApp renseigné par l'administration (`/system/parametres`), ou `null`.
 * Route PUBLIQUE : le numéro est déjà affiché sur le site. Cache court : un changement d'administration est visible en quelques minutes.
 */
export async function GET() {
  const { whatsapp } = await lireReglagesAssistance();
  return NextResponse.json({ ok: true, whatsapp }, { headers: { "Cache-Control": "public, max-age=300" } });
}
