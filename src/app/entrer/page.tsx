import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageCompte } from "@/components/PageCompte";
import { Alert, Card } from "@/components/ui";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { continuerAvecFacebookAction } from "@/lib/client/actions";
import { connexionClientActive } from "@/lib/client/reglage";
import { creerClientServeur } from "@/lib/db/server";
import { InscriptionCompleteForm } from "./InscriptionCompleteForm";

export const metadata: Metadata = { title: "Rejoindre Speedfood" };

const MESSAGES_ERREUR: Record<string, string> = {
  annule: "La connexion a été annulée. Vous pouvez réessayer quand vous voulez.",
  echange: "La connexion n'a pas abouti. Réessayez dans un instant.",
  depart: "Impossible de démarrer la connexion. Réessayez dans un instant.",
};

/**
 * Page d'entrée unifiée : choix entre formulaire complet et Facebook.
 * Le bouton Facebook n'apparaît que si l'administrateur a activé la fonction
 * (réglage de `/system/parametres`) : sinon la page l'explique honnêtement
 * au lieu de proposer un bouton qui échouerait.
 */
export default async function EntrerPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string; indisponible?: string }>;
}) {
  const { suite = "", erreur } = await searchParams;
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
      sousTitre="Deux chemins, un même compte : choisissez ce qui vous arrange."
      libellePanneau="Pourquoi créer un compte Speedfood"
      panneau={{
        titre: "Votre place à table, en un geste.",
        points: [
          "Connexion en un geste avec votre compte Facebook, sans mot de passe à retenir.",
          "Ou formulaire complet : nom, téléphone, email, double mot de passe, adresse.",
          "Speedfood reçoit votre nom et votre email, jamais vos amis ni vos publications.",
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

      {/* Choix du mode d'inscription */}
      <div className="choix-inscription" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Card className="choix-carte" style={{ border: "2px solid var(--bordure)" }}>
          <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>📝 Formulaire complet</h3>
          <p className="aide-champ" style={{ marginBottom: "var(--space-3)" }}>
            Nom, téléphone, email, double mot de passe, adresse (résidence, ville, quartier, Guinée par défaut).
          </p>
          <InscriptionCompleteForm suite={suiteSure} />
        </Card>

        {actif ? (
          <Card className="choix-carte" style={{ border: "2px solid var(--bordure)" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>📘 Continuer avec Facebook</h3>
            <p className="aide-champ" style={{ marginBottom: "var(--space-3)" }}>
              Un clic, pas de mot de passe &agrave; retenir. Speedfood garde votre pseudo, votre avatar et l&apos;identifiant
              de votre compte Facebook &mdash; jamais vos amis ni vos publications.
            </p>
            <form action={continuerAvecFacebookAction} className="entrer-formulaire">
              <input type="hidden" name="suite" value={suiteSure} />
              <button type="submit" className="btn btn-facebook btn-block">
                Continuer avec Facebook
              </button>
              <p className="aide-champ">
                En continuant, vous acceptez que Speedfood garde votre pseudo, votre avatar et l&apos;identifiant de votre
                compte Facebook. Détails sur la page{" "}
                <Link href="/confidentialite" className="lien-texte">
                  Confidentialité
                </Link>
                .
              </p>
            </form>
          </Card>
        ) : (
          <Card className="choix-carte" style={{ border: "2px solid var(--muted, var(--bordure))", opacity: 0.7 }}>
            <h3 style={{ marginTop: 0, fontSize: "1.1rem" }}>📘 Continuer avec Facebook</h3>
            <p className="aide-champ" style={{ marginBottom: "var(--space-3)" }}>
              Cette option n&apos;est pas encore disponible. Choisissez le formulaire complet ci-dessus.
            </p>
          </Card>
        )}

        <p style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--secondaire)", marginTop: "var(--space-4)" }}>
          Pas envie de compte ? <Link href="/restaurants" className="lien-texte">Parcourir les restaurants</Link>
        </p>
      </div>
    </PageCompte>
  );
}