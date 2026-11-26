import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { rafraichirConfirmationsDemonstration } from "@/lib/demonstration/rafraichir";

/**
 * Renouvellement des confirmations de plats du lot de démonstration, appelé toutes les 5 minutes par la tâche planifiée du Worker (`scheduled` dans worker-entree.js)
 * avec le même secret que l'entretien du paiement. Sans secret configuré, la route n'existe pas (404). Ne renvoie que des compteurs.
 */
function secretValide(recu: string | null, attendu: string): boolean {
  if (!recu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const attendu = process.env.PAIEMENT_ENTRETIEN_SECRET ?? "";
  if (attendu.length < 16) return new NextResponse(null, { status: 404 });
  if (!secretValide(request.headers.get("x-entretien-secret"), attendu)) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json(await rafraichirConfirmationsDemonstration());
  } catch {
    console.error("rafraichir_demo_echec");
    return NextResponse.json({ erreur: "Renouvellement impossible." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
