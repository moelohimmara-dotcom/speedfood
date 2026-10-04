import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";
import { Card, Alert } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { formaterDelaiValidation } from "@/lib/parametres/assistance-format";
import { BoutonAssistance } from "@/components/BoutonAssistance";

export default async function InscriptionPage() {
  const { whatsapp, delaiValidationHeures } = await lireReglagesAssistance();
  return (
    <PageCompte
      titre="Inscrire mon restaurant"
      panneau={{
        titre: "Une page à vous, validée par l'équipe.",
        points: [
          "Votre menu, vos horaires et vos photos sur une page Speedfood.",
          "Un lien WhatsApp et un QR code à afficher dans votre établissement.",
          "Les clients voient depuis quand vous avez confirmé chaque plat.",
          "Rien n'est publié avant la validation par une personne de l'équipe Speedfood.",
        ],
      }}
      pied={
        <p>
          Déjà un compte ? <Link href="/connexion" className="lien-texte">Connectez-vous</Link>
          {" · "}
          <Link href="/devenir-partenaire" className="lien-texte">Voir les étapes</Link>
        </p>
      }
    >
      <Alert ton="info" style={{ marginBottom: "var(--space-5)" }}>
        Votre restaurant ne sera pas visible au catalogue tant qu&apos;une personne de l&apos;équipe Speedfood ne
        l&apos;aura pas validé.
        {delaiValidationHeures ? ` Réponse en général sous ${formaterDelaiValidation(delaiValidationHeures)}.` : null}
      </Alert>
      {whatsapp ? (
        <p style={{ marginBottom: "var(--space-4)" }}>
          Besoin d&apos;aide pour vous inscrire ? <BoutonAssistance numero={whatsapp} className="btn btn-secondary btn-compact" />
        </p>
      ) : null}
      <Card>
        <InscriptionForm />
      </Card>
    </PageCompte>
  );
}
