import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { jetonSuiviDepuisJetonRecu } from "@/lib/commande/requetes";
import { renderRecuPage } from "@/app/suivi/[jeton]/recu/page";

export const metadata: Metadata = { title: "Reçu de commande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Reçu partagé par le restaurant (lien WhatsApp). Le jeton de l'adresse est un jeton de REÇU, en lecture seule : il ne donne accès ni au suivi,
 * ni à la réponse aux propositions, ni au paiement, ni à la notation. Le jeton de suivi du client (sa vraie clé) n'est jamais lu par le
 * restaurant et n'apparaît pas dans cette page.
 */
export default async function RecuPartagePage({ params, searchParams }: { params: Promise<{ jeton: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { jeton: jetonRecu } = await params;
  const { doc } = await searchParams;
  const jetonSuivi = await jetonSuiviDepuisJetonRecu(jetonRecu);
  if (!jetonSuivi) notFound();
  return renderRecuPage(jetonSuivi, doc, { racine: `/recu/${jetonRecu}`, retour: null });
}
