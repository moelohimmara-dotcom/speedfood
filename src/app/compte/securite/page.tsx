import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { Alert, Card } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { ActivationMfa } from "./ActivationMfa";

/**
 * Sécurité du compte : activer ou désactiver la double authentification (facultative).
 * Ouverte à tout compte connecté (restaurateur ou administrateur).
 */
export default async function SecuriteComptePage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion?suite=/compte/securite");
  }

  const etat = await lireEtatMfa(supabase);
  const administrateur = await aUnRoleSysteme(supabase, user.id);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <LienRetour href={administrateur ? "/system" : "/restaurant"}>Retour</LienRetour>
      <h1 style={{ fontSize: "1.8rem", margin: "var(--space-3) 0 var(--space-2)" }}>Sécurité du compte</h1>
      <p style={{ color: "var(--secondaire)", marginTop: 0 }}>Connecté en tant que {user.email}.</p>

      <Alert ton={etat.actif ? "succes" : administrateur ? "danger" : "info"} style={{ marginBottom: "var(--space-5)" }}>
        {etat.actif ? (
          <>
            <strong>La double authentification est activée.</strong> À chaque connexion, après votre mot de passe, un code
            à 6 chiffres de votre application vous est demandé.
          </>
        ) : (
          <>
            <strong>Pourquoi l&apos;activer ?</strong> Un mot de passe peut être deviné, volé ou réutilisé ailleurs. Avec la
            double authentification, il ne suffit plus : il faut aussi votre téléphone.{" "}
            {administrateur
              ? "Pour un compte d'administration, c'est la protection la plus importante : il donne accès aux coordonnées de tous les clients."
              : "Elle protège vos commandes, votre menu et les coordonnées de vos clients."}{" "}
            <strong>Elle reste facultative</strong> : vous pouvez l&apos;activer ou la désactiver quand vous voulez.
          </>
        )}
      </Alert>

      <Card>
        <ActivationMfa actif={etat.actif} facteurId={etat.facteurId} sessionRenforcee={etat.sessionRenforcee} />
      </Card>

      <h2 style={{ fontSize: "1.1rem", margin: "var(--space-6) 0 var(--space-2)" }}>À savoir avant d&apos;activer</h2>
      <ul style={{ color: "var(--secondaire)", fontSize: "0.9rem", paddingLeft: "1.2rem", margin: 0 }}>
        <li>
          Il faut une application d&apos;authentification sur le téléphone (Google Authenticator, Microsoft Authenticator,
          Aegis, 2FAS…).
        </li>
        <li>
          <strong>Il n&apos;y a pas de code de secours.</strong> Si vous perdez le téléphone sans avoir conservé la clé
          affichée à l&apos;activation, vous ne pourrez plus vous connecter seul : l&apos;équipe Speedfood devra retirer la
          protection de votre compte. Notez la clé dans un gestionnaire de mots de passe.
        </li>
        <li>Une fois activée, le code est demandé à chaque nouvelle connexion, et la protection s&apos;applique aussi côté base de données.</li>
      </ul>
    </main>
  );
}
