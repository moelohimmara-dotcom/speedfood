import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { fichePourJeton, lireReglagesLivreurs } from "@/lib/livraison/livreurs-service";
import { jetonActivationPlausible } from "@/lib/livraison/livreurs-regles";
import { Alert, Card } from "@/components/ui";
import { FormulaireActivation } from "./FormulaireActivation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Devenir livreur · Speedfood", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Activation d'un compte livreur par le lien reçu (usage unique). Il faut être connecté : le lien est lié au compte qui l'ouvre. */
export default async function ActiverLivreurPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const jeton = String((await searchParams).jeton ?? "");
  const suite = `/livreur/activer?jeton=${encodeURIComponent(jeton)}`;

  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(suite)}`);

  const fiche = jetonActivationPlausible(jeton) ? await fichePourJeton(jeton) : null;
  if (!fiche) {
    return (
      <main className="livreur-page">
        <h1>Devenir livreur</h1>
        <Card>
          <Alert ton="danger">Ce lien est invalide ou a expiré. Demandez-en un nouveau à Speedfood.</Alert>
        </Card>
      </main>
    );
  }

  const reglages = await lireReglagesLivreurs();
  // Livreur d'un restaurant : ni dossier d'identité ni approbation (le restaurateur le connaît), et il ne verra que les livraisons de ce restaurant.
  const duRestaurant = fiche.restaurantNom !== null;
  return (
    <main className="livreur-page">
      <h1>{duRestaurant ? `Livreur de ${fiche.restaurantNom}` : "Devenir livreur Speedfood"}</h1>
      <Card>
        <p>
          Bonjour <strong>{fiche.nom}</strong>. Ce lien active votre compte livreur ({user.email}). Il ne sert qu&apos;une fois.
          {duRestaurant ? ` Vous verrez ici les livraisons de ${fiche.restaurantNom}, et seulement celles-ci.` : ""}
        </p>
        <FormulaireActivation
          jeton={jeton}
          pieceRequise={duRestaurant ? false : reglages.pieceRequise}
          urgenceRequise={duRestaurant ? false : reglages.urgenceRequise}
          approbation={duRestaurant ? false : reglages.approbationRequise}
        />
      </Card>
    </main>
  );
}
