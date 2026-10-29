import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ErreurPasserelle } from "@/lib/paiement/en-ligne/fournisseur";
import { obtenirServicePaiement } from "@/lib/paiement/en-ligne/fabrique";

/**
 * Entretien périodique du paiement en ligne, appelé par la tâche planifiée du Worker (`scheduled` dans worker-entree.js, toutes les 5
 * minutes) : expire les paiements restés en attente, relance les versements à faire ou en échec. Il traite aussi les paiements déjà
 * ouverts quand l'interrupteur est éteint (de l'argent peut être en route).
 *
 * Authentification : secret partagé `PAIEMENT_ENTRETIEN_SECRET` (secret du Worker, 16 caractères au moins) dans l'en-tête
 * `x-entretien-secret`. Sans secret configuré, la route n'existe pas (404). Rien ici n'est lisible par un visiteur.
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
    const service = await obtenirServicePaiement();
    const resultat = await service.entretien();
    return NextResponse.json(resultat);
  } catch (erreur) {
    // Fournisseur non configuré : rien à entretenir pour l'instant.
    if (erreur instanceof ErreurPasserelle && erreur.code === "non_configuree") return NextResponse.json({ expires: 0, reprises: 0 });
    console.error("paiement_entretien_echec");
    return NextResponse.json({ erreur: "Entretien impossible." }, { status: 500 });
  }
}
