import { redirect } from "next/navigation";
import { FormulaireNouveauMotDePasse } from "./FormulaireNouveauMotDePasse";
import { Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";

/** Atteinte uniquement après le lien de l'e-mail (session de récupération) ; sinon retour à la demande. */
export default async function NouveauMotDePassePage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion/oubli?lien=invalide");
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>Nouveau mot de passe</h1>
      <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginTop: 0, marginBottom: "var(--space-5)" }}>
        Choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs.
      </p>
      <Card>
        <FormulaireNouveauMotDePasse />
      </Card>
    </main>
  );
}
