import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";
import { Card, Alert } from "@/components/ui";

export default function InscriptionPage() {
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-3)" }}>Inscrire mon restaurant</h1>
      <Alert ton="info" style={{ marginBottom: "var(--space-5)" }}>
        Votre restaurant ne sera pas visible au catalogue tant qu&apos;une personne de
        l&apos;équipe Speedfood ne l&apos;aura pas validé.
      </Alert>
      <Card>
        <InscriptionForm />
      </Card>
      <p style={{ marginTop: "var(--space-4)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
        Déjà un compte ? <Link href="/connexion" className="lien-texte">Connectez-vous</Link>
      </p>
    </main>
  );
}
