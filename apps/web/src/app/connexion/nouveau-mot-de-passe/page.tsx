import { redirect } from "next/navigation";
import { FormulaireNouveauMotDePasse } from "./FormulaireNouveauMotDePasse";
import { Card } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { creerClientServeur } from "@/lib/db/server";
import type { Metadata } from "next";

/** Atteinte uniquement après le lien de l'e-mail (session de récupération) ; sinon retour à la demande. */
export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function NouveauMotDePassePage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion/oubli?lien=invalide");
  }

  return (
    <PageCompte
      titre="Nouveau mot de passe"
      sousTitre="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs."
    >
      <Card>
        <FormulaireNouveauMotDePasse />
      </Card>
    </PageCompte>
  );
}
