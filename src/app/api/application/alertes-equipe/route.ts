import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { marquerEnvoyes, signalementsAEnvoyer } from "@/lib/system-admin/doublons";

/**
 * Alertes e-mail de l'équipe, appelées par la tâche planifiée du Worker (même secret que l'entretien du paiement ; sans secret configuré, la route n'existe pas : 404).
 * Le Worker envoie lui-même les e-mails par le SMTP de Google (le serveur applicatif n'ouvre pas de connexion SMTP) :
 *   POST ?action=lister    → les messages à envoyer (inscriptions suspendues pour doublon dont l'équipe n'a pas encore été prévenue) ;
 *   POST ?action=confirmer → corps { ids: [...] } : ceux qui sont partis, à ne plus renvoyer.
 */
function secretValide(recu: string | null, attendu: string): boolean {
  if (!recu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

function lien(chemin: string): string {
  const base = (process.env.SITE_PUBLIC_URL ?? "https://speedfood-app.moelohimmara.workers.dev").replace(/\/+$/, "");
  return `${base}${chemin}`;
}

export async function POST(request: Request) {
  const attendu = process.env.PAIEMENT_ENTRETIEN_SECRET ?? "";
  if (attendu.length < 16) return new NextResponse(null, { status: 404 });
  if (!secretValide(request.headers.get("x-entretien-secret"), attendu)) return new NextResponse(null, { status: 404 });
  const action = new URL(request.url).searchParams.get("action");
  try {
    if (action === "lister") {
      const signalements = await signalementsAEnvoyer();
      return NextResponse.json({
        messages: signalements.map((s) => ({
          id: s.id,
          sujet: "Speedfood : inscription suspendue (adresse déjà connue)",
          texte:
            `Une inscription vient d'être suspendue : son adresse correspond à celle d'un compte existant.\n\n` +
            `Nouvelle inscription : ${s.nouvelEmail ?? "(inconnue)"}\n` +
            `Compte déjà existant : ${s.emailExistant ?? "(inconnu)"}\n` +
            `Forme canonique commune : ${s.emailCanonique}\n` +
            `Reçue le : ${s.creeLe}\n\n` +
            `La personne ne peut pas se connecter tant que vous n'avez pas décidé (autoriser si ce sont deux personnes différentes, refuser si c'est la même).\n` +
            `Décision : ${lien("/system/acces/doublons")}\n`,
        })),
      });
    }
    if (action === "confirmer") {
      const corps = (await request.json().catch(() => ({}))) as { ids?: unknown };
      const ids = Array.isArray(corps.ids) ? corps.ids.filter((i): i is string => typeof i === "string") : [];
      await marquerEnvoyes(ids);
      return NextResponse.json({ ok: true, confirmes: ids.length });
    }
    return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch {
    console.error("alertes_equipe_echec");
    return NextResponse.json({ erreur: "Alertes indisponibles." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
