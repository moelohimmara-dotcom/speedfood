import Link from "next/link";
import { FormulaireOubli } from "./FormulaireOubli";
import { Alert, Card } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function OubliPage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams;
  return (
    <PageCompte
      titre="Mot de passe oublié"
      sousTitre="Saisissez l'adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau."
      pied={
        <p>
          <Link href="/connexion" className="lien-texte">Retour à la connexion</Link>
        </p>
      }
    >
      {lien === "invalide" ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          Ce lien est invalide ou a expiré. Demandez-en un nouveau ci-dessous.
        </Alert>
      ) : null}
      <Card>
        <FormulaireOubli />
      </Card>
    </PageCompte>
  );
}
