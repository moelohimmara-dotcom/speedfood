import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { calculerScoresMois } from "@/lib/restaurant/score-service";

/**
 * Calcul mensuel des scores qualité des restaurants, appelé par la tâche planifiée du Worker
 * (même secret que l'entretien du paiement et la file d'événements). Sans secret configuré ou
 * faux, la route n'existe pas (404).
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

  // La tâche planifiée passe toutes les 5 minutes : le calcul du mois écoulé ne tourne que les 3 premiers jours du mois.
  if (new Date().getUTCDate() > 3) return NextResponse.json({ statut: "hors_fenetre" });

  try {
    const bilan = await calculerScoresMois();
    return NextResponse.json(bilan);
  } catch {
    console.error("score_qualite_echec");
    return NextResponse.json({ erreur: "Calcul impossible." }, { status: 500 });
  }
}
