import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgerCandidaturesRefusees } from "@/lib/referencement/purge";

/**
 * Purge quotidienne des images et menus des candidatures refusées depuis 30 jours, appelée par la tâche planifiée du Worker (`scheduled` dans worker-entree.js, une fois par jour)
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
    return NextResponse.json(await purgerCandidaturesRefusees());
  } catch {
    console.error("purge_candidatures_echec");
    return NextResponse.json({ erreur: "Purge impossible." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
