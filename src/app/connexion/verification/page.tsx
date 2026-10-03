import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { Card } from "@/components/ui";
import { FormulaireVerification } from "./FormulaireVerification";

/** Seconde étape de connexion : code de la double authentification (uniquement si elle est activée). */
export default async function VerificationConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  const destination = estCheminInterneSur(suite ?? "") ? (suite as string) : "/restaurant";

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/connexion?suite=${encodeURIComponent(destination)}`);
  }
  // Rien à vérifier si la session est déjà renforcée ou si aucun code n'est requis.
  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.nextLevel !== "aal2" || niveau.currentLevel === "aal2") {
    redirect(destination);
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>Vérification en deux étapes</h1>
      <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginTop: 0, marginBottom: "var(--space-5)" }}>
        Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.
      </p>
      <Card>
        <FormulaireVerification suite={destination} />
      </Card>
    </main>
  );
}
