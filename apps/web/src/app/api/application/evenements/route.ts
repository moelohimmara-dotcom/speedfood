import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { traiterFileEvenements } from "@/lib/push/evenements-service";

/**
 * Traitement de la file d'événements de commande, appelé par la tâche planifiée du Worker
 * (`scheduled` dans worker-entree.js, toutes les 5 minutes, même secret que l'entretien du
 * paiement). Sans secret configuré ou faux, la route n'existe pas (404), comme les autres
 * routes d'entretien.
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
    const bilan = await traiterFileEvenements();
    return NextResponse.json(bilan);
  } catch {
    console.error("evenements_traitement_echec");
    return NextResponse.json({ erreur: "Traitement impossible." }, { status: 500 });
  }
}
