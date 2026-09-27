import Link from "next/link";
import { ConnexionForm } from "./ConnexionForm";
import { Card } from "@/components/ui";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-5)" }}>Connexion restaurateur</h1>
      <Card>
        <ConnexionForm suite={suite ?? "/restaurant"} />
      </Card>
      <p style={{ marginTop: "var(--space-4)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
        Pas encore de compte ? <Link href="/inscription">Inscrivez votre restaurant</Link>
      </p>
    </main>
  );
}
