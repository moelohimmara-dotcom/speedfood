import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { libelleQuestion } from "@/lib/auth/questions";
import { lireEtatQuestions } from "@/lib/auth/questions-serveur";
import { Card } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { FormulaireQuestions } from "./FormulaireQuestions";
import type { Metadata } from "next";

/** Étape de connexion facultative : réponses aux deux questions de sécurité (uniquement si le compte les a activées). */
export const metadata: Metadata = { title: "Questions de sécurité" };

export default async function QuestionsConnexionPage({
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

  const etat = await lireEtatQuestions(supabase);
  if (!etat.active || !etat.requise) {
    redirect(destination);
  }

  return (
    <PageCompte titre="Questions de sécurité" sousTitre="Répondez à vos deux questions pour accéder à votre espace.">
      <Card>
        <FormulaireQuestions
          suite={destination}
          question1={libelleQuestion(etat.question1 ?? "")}
          question2={libelleQuestion(etat.question2 ?? "")}
          codesRestants={etat.codesRestants}
        />
      </Card>
    </PageCompte>
  );
}
