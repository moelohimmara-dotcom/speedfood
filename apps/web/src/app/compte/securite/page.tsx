import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { Alert, Card } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { lireEtatQuestions } from "@/lib/auth/questions-serveur";
import { ActivationMfa } from "./ActivationMfa";
import { QuestionsSecurite } from "./QuestionsSecurite";

/**
 * Sécurité du compte : activer ou désactiver la double authentification (facultative).
 * Ouverte à tout compte connecté (restaurateur ou administrateur).
 */
export default async function SecuriteComptePage({ searchParams }: { searchParams: Promise<{ secours?: string }> }) {
  const { secours } = await searchParams;
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion?suite=/compte/securite");
  }

  const etat = await lireEtatMfa(supabase);
  const administrateur = await aUnRoleSysteme(supabase, user.id);
  const questions = await lireEtatQuestions(supabase);

  return (
    <main className="u-maxw-560px-m-0-auto-p-s8-s4">
      <LienRetour href={administrateur ? "/system" : "/restaurant"}>Retour</LienRetour>
      <h1 className="u-fs-1-8rem-m-s3-0-s2">Sécurité du compte</h1>
      <p className="u-c-secondaire-mt-0">Connecté en tant que {user.email}.</p>

      <Alert ton={etat.actif ? "succes" : administrateur ? "danger" : "info"} className="u-mb-s5">
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

      <h2 className="u-fs-1-1rem-m-s6-0-s2">Questions de sécurité</h2>
      {secours === "1" ? (
        <Alert ton="info" className="u-mb-s4">
          Vous êtes entré avec un code de secours : il est maintenant utilisé. Redéfinissez vos questions ou générez de nouveaux codes
          ci-dessous.
        </Alert>
      ) : null}
      <p className="questions-aide">
        Deux questions personnelles posées après votre mot de passe, avec des codes de secours si vous les oubliez. <strong>Facultatif.</strong>{" "}
        C&apos;est une protection de plus pour les pages de l&apos;application, <strong>moins forte</strong> que l&apos;application
        d&apos;authentification ci-dessus : elle ne protège pas l&apos;accès direct à la base de données. Si vous activez les deux, l&apos;application
        d&apos;authentification suffit à entrer.
      </p>
      <Card>
        <QuestionsSecurite active={questions.active} requise={questions.requise} codesRestants={questions.codesRestants} />
      </Card>

      <h2 className="u-fs-1-1rem-m-s6-0-s2">À savoir avant d&apos;activer</h2>
      <ul className="u-c-secondaire-fs-0-9rem-pl-1-2rem-m-0">
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
