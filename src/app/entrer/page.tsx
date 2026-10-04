import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageCompte } from "@/components/PageCompte";
import { Alert, Card } from "@/components/ui";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { continuerAvecFacebookAction } from "@/lib/client/actions";
import { connexionClientActive } from "@/lib/client/reglage";
import { creerClientServeur } from "@/lib/db/server";

export const metadata: Metadata = { title: "Rejoindre Speedfood" };

const MESSAGES_ERREUR: Record<string, string> = {
  annule: "La connexion a été annulée. Vous pouvez réessayer quand vous voulez.",
  echange: "La connexion n'a pas abouti. Réessayez dans un instant.",
  depart: "Impossible de démarrer la connexion. Réessayez dans un instant.",
};

/**
 * Entrée du compte client. Le bouton Facebook n'apparaît que si l'administrateur a activé la fonction (réglage de
 * `/system/parametres`) : sinon la page l'explique honnêtement au lieu de proposer un bouton qui échouerait.
 */
export default async function EntrerPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string; indisponible?: string }>;
}) {
  const { suite = "", erreur, indisponible } = await searchParams;
  const suiteSure = estCheminInterneSur(suite) ? suite : "/compte";

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(suiteSure);
  }

  const actif = await connexionClientActive();
  const message = erreur ? MESSAGES_ERREUR[erreur] : undefined;

  return (
    <PageCompte
      titre="Rejoignez la table"
      sousTitre="Un pseudo, un avatar, et vos commandes de plus en plus simples."
      libellePanneau="Pourquoi créer un compte Speedfood"
      panneau={{
        titre: "Votre place à table, en un geste.",
        points: [
          "Connexion en un geste avec votre compte Facebook, sans mot de passe à retenir.",
          "Un pseudo et un avatar à votre image, choisis en quelques secondes.",
          "Speedfood reçoit votre nom et votre adresse e-mail, jamais vos amis ni vos publications.",
          "Vous pouvez supprimer votre compte vous-même, à tout moment.",
        ],
      }}
      pied={
        <p>
          Pas envie de compte ? <Link href="/restaurants" className="lien-texte">Parcourir les restaurants</Link>
        </p>
      }
    >
      {message ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {message}
        </Alert>
      ) : null}
      <Card>
        {actif ? (
          <form action={continuerAvecFacebookAction} className="entrer-formulaire">
            <input type="hidden" name="suite" value={suiteSure} />
            <button type="submit" className="btn btn-facebook btn-block">
              Continuer avec Facebook
            </button>
            <p className="aide-champ">
              En continuant, vous acceptez que Speedfood garde votre pseudo, votre avatar et l&apos;identifiant de votre
              compte. Détails sur la page{" "}
              <Link href="/confidentialite" className="lien-texte">
                Confidentialité
              </Link>
              .
            </p>
          </form>
        ) : (
          <div className="entrer-formulaire">
            <Alert ton="info">
              {indisponible
                ? "La connexion par compte n'est pas encore ouverte."
                : "La création de compte arrive bientôt."}{" "}
              En attendant, vous pouvez commander sans compte.
            </Alert>
            <Link href="/restaurants" className="btn btn-primary btn-block">
              Voir les restaurants
            </Link>
          </div>
        )}
      </Card>
    </PageCompte>
  );
}
