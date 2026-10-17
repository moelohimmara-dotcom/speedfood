import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { lireEtatLivreur } from "@/lib/livraison/livreur";
import { Alert, Card } from "@/components/ui";
import { ConsoleLivreur } from "./ConsoleLivreur";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Console livreur · Speedfood", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Console du livreur : se mettre en ligne, recevoir une offre de course, avancer les étapes, saisir le code de remise.
 * Accessible seulement à un compte lié à une fiche livreur (créée par l'exploitation).
 */
export default async function LivreurPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?suite=/livreur");

  const etat = await lireEtatLivreur(user.id);
  if (!etat) {
    return (
      <main className="livreur-page">
        <h1>Console livreur</h1>
        <Card>
          <Alert ton="info">
            Ce compte n&apos;est pas un compte livreur. Les comptes livreurs sont créés par l&apos;équipe Speedfood : contactez-la si vous souhaitez livrer.
          </Alert>
        </Card>
      </main>
    );
  }

  return (
    <main className="livreur-page">
      <h1>Console livreur</h1>
      <ConsoleLivreur etatInitial={etat} />
    </main>
  );
}
