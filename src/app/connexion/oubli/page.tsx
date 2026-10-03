import Link from "next/link";
import { FormulaireOubli } from "./FormulaireOubli";
import { Alert, Card } from "@/components/ui";

export default async function OubliPage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams;
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>Mot de passe oublié</h1>
      <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginTop: 0, marginBottom: "var(--space-5)" }}>
        Saisissez l&apos;adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.
      </p>
      {lien === "invalide" ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          Ce lien est invalide ou a expiré. Demandez-en un nouveau ci-dessous.
        </Alert>
      ) : null}
      <Card>
        <FormulaireOubli />
      </Card>
      <p style={{ marginTop: "var(--space-4)", fontSize: "0.9rem" }}>
        <Link href="/connexion" className="lien-texte">Retour à la connexion</Link>
      </p>
    </main>
  );
}
