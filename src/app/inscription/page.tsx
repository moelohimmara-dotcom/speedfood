import Link from "next/link";
import { InscriptionForm } from "./InscriptionForm";
import { Card, Alert } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";

export default function InscriptionPage() {
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
        </p>
      }
    >
      <Alert ton="info" style={{ marginBottom: "var(--space-5)" }}>
        Votre restaurant ne sera pas visible au catalogue tant qu&apos;une personne de l&apos;équipe Speedfood ne
        l&apos;aura pas validé.
      </Alert>
      <Card>
        <InscriptionForm />
      </Card>
    </PageCompte>
  );
}
