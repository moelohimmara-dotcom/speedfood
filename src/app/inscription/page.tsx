import Link from "next/link";
import { FormulaireReferencement } from "./FormulaireReferencement";
import { Card, Alert } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { BoutonAssistance } from "@/components/BoutonAssistance";

// Rendue à chaque requête (et non figée à la construction) : le cadre du site lit les interrupteurs de fonctionnalités du super administrateur
// (voir src/lib/fonctionnalites/lire.ts) ; sinon un changement n'apparaîtrait qu'au prochain déploiement.
export const dynamic = "force-dynamic";

/**
 * « Demander à être référencé » (ADR-020, 21 octobre 2026) : un établissement ne crée plus lui-même sa page. Il laisse ses coordonnées ; l'équipe Speedfood
 * rappelle sous 48 heures, présente les conditions, signe l'accord, puis crée la fiche et tient le catalogue avec lui. Les restaurateurs déjà inscrits
 * continuent de se connecter par `/connexion?role=restaurateur`.
 */
export default async function ReferencementPage() {
  const { whatsapp } = await lireReglagesAssistance();
  return (
    <PageCompte
      titre="Demander à être référencé"
      sousTitre="Laissez vos coordonnées : l'équipe Speedfood vous rappelle sous 48 heures."
      libellePanneau="Les trois étapes du référencement"
      panneau={{
        titre: "Nous nous occupons de votre fiche.",
        points: [
          "1. Votre demande : cette page, en deux minutes.",
          "2. Un rappel de l'équipe, puis une visite : conditions, plats, prix, horaires.",
          "3. Nous créons votre fiche et tenons votre catalogue ; vous recevez les commandes et préparez.",
        ],
      }}
      pied={
        <p>
          Déjà référencé ? <Link href="/connexion?role=restaurateur" className="lien-texte">Connexion restaurateur</Link>
          {" · "}
          <Link href="/restaurateurs" className="lien-texte">Voir comment ça marche</Link>
          <br />
          Vous êtes client ? <Link href="/entrer" className="lien-texte">Créez votre compte client</Link>
        </p>
      }
    >
      <Alert ton="info" className="u-mb-s5">
        Votre établissement n&apos;est visible qu&apos;après le rappel de l&apos;équipe, la signature d&apos;un accord et la création de votre fiche avec vous.
      </Alert>
      {whatsapp ? (
        <p className="u-mb-s4">
          Une question avant de commencer ? <BoutonAssistance numero={whatsapp} className="btn btn-secondary btn-compact" />
        </p>
      ) : null}
      <Card>
        <FormulaireReferencement />
      </Card>
    </PageCompte>
  );
}
