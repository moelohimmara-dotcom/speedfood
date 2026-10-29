import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { annoncerVersion, derniereAnnonce } from "@/lib/push/annonce-version";

/**
 * Annonce automatique de la version publiée aux applications installées, appelée par la tâche planifiée du Worker (`scheduled` dans worker-entree.js, toutes les 5
 * minutes, avec le même secret que l'entretien du paiement). Dès qu'un déploiement publie une version plus récente que la dernière annoncée, chaque téléphone reçoit
 * la notification « Mise à jour disponible » ; l'application propose alors l'installation en un geste. Une version ne s'annonce qu'une fois (`annoncerVersion`
 * écrit la ligne avant l'envoi). Sans secret configuré, la route n'existe pas (404).
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
    const derniere = await derniereAnnonce();
    if (derniere && derniere.versionCode >= VERSION_APPLICATION.code) return NextResponse.json({ statut: "a_jour" });
    const resultat = await annoncerVersion(VERSION_APPLICATION.code, VERSION_APPLICATION.nom, null);
    return NextResponse.json(resultat);
  } catch {
    console.error("annonce_auto_echec");
    return NextResponse.json({ erreur: "Annonce impossible." }, { status: 500 });
  }
}
