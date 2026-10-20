import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";
import { Card, Alert } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { formaterDelaiValidation } from "@/lib/parametres/assistance-format";
import { BoutonAssistance } from "@/components/BoutonAssistance";

// Rendue à chaque requête (et non figée à la construction) : l'accueil lit des données vivantes et le cadre du site lit les interrupteurs
// de fonctionnalités du super administrateur (voir src/lib/fonctionnalites/lire.ts) ; sinon un changement n'apparaîtrait qu'au prochain déploiement.
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const { whatsapp, delaiValidationHeures } = await lireReglagesAssistance();
  return (
    <PageCompte
      titre="Inscrire mon restaurant"
      sousTitre="Créez votre compte restaurateur, puis décrivez votre établissement."
      libellePanneau="Les trois étapes de l'inscription"
      panneau={{
        titre: "Trois étapes, vous êtes à la première.",
        points: [
          "1. Votre compte : une adresse e-mail et un mot de passe (c'est ici).",
          "2. Votre restaurant : nom, type de cuisine et quartier, puis menu, horaires et photos.",
          "3. La validation : une personne de l'équipe relit votre page avant publication.",
        ],
      }}
      pied={
        <p>
          Déjà un compte ? <Link href="/connexion?role=restaurateur" className="lien-texte">Connexion restaurateur</Link>
          {" · "}
          <Link href="/restaurateurs" className="lien-texte">Voir les étapes</Link>
          <br />
          Vous êtes client ? <Link href="/entrer" className="lien-texte">Créez votre compte client</Link>
        </p>
      }
    >
      <Alert ton="info" className="u-mb-s5">
        Votre restaurant ne sera pas visible au catalogue tant qu&apos;une personne de l&apos;équipe Speedfood ne
        l&apos;aura pas validé.
        {delaiValidationHeures ? ` Réponse en général sous ${formaterDelaiValidation(delaiValidationHeures)}.` : null}
      </Alert>
      {whatsapp ? (
        <p className="u-mb-s4">
          Besoin d&apos;aide pour vous inscrire ? <BoutonAssistance numero={whatsapp} className="btn btn-secondary btn-compact" />
        </p>
      ) : null}
      <Card>
        <InscriptionForm />
      </Card>
    </PageCompte>
  );
}
