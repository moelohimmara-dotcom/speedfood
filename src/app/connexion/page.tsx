import Link from "next/link";
import { ConnexionForm } from "./ConnexionForm";
import { Card } from "@/components/ui";

/**
 * Page de connexion unique, contextualisée par `suite` (ADR-010 : deux consoles
 * distinctes, une seule porte d'entrée identifiée) :
 * - `suite=/system...` → intitulé « Administration Speedfood », sans lien
 *   d'inscription restaurateur (les comptes système sont créés par un admin) ;
 * - sinon → intitulé « Connexion restaurateur ».
 * Après connexion, `connexionAction` route selon le type de compte réel :
 * admin système pur → `/system`, restaurateur → `/restaurant`.
 */
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  const pourSysteme = (suite ?? "").startsWith("/system");

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>
        {pourSysteme ? "Administration Speedfood" : "Connexion restaurateur"}
      </h1>
      <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginTop: 0, marginBottom: "var(--space-5)" }}>
        {pourSysteme
          ? "Accès réservé aux comptes de l'équipe Speedfood (rôles système)."
          : "Gérez votre établissement : commandes, menu et informations."}
      </p>
      <Card>
        <ConnexionForm suite={suite ?? ""} />
      </Card>
      {pourSysteme ? (
        <p style={{ marginTop: "var(--space-4)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          Vous êtes restaurateur ? <Link href="/connexion">Connexion restaurateur</Link>
        </p>
      ) : (
        <p style={{ marginTop: "var(--space-4)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          Pas encore de compte ? <Link href="/inscription">Inscrivez votre restaurant</Link>
          <br />
          Équipe Speedfood ? <Link href="/connexion?suite=/system">Administration</Link>
        </p>
      )}
    </main>
  );
}
