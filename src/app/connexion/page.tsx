import Link from "next/link";
import { ConnexionForm } from "./ConnexionForm";
import { Card } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import type { Metadata } from "next";

/**
 * Page de connexion unique, contextualisée par `suite` (ADR-010 : deux consoles
 * distinctes, une seule porte d'entrée identifiée) :
 * - `suite=/system...` → intitulé « Administration Speedfood », sans lien
 *   d'inscription restaurateur (les comptes système sont créés par un admin) ;
 * - sinon → intitulé neutre « Connexion » : un client inscrit par le formulaire
 *   arrive aussi par ici, et se serait lu « Vous n'êtes pas un restaurateur ».
 * Après connexion, `connexionAction` route selon le type de compte réel :
 * admin système pur → `/system`, restaurateur → `/restaurant`, client → `/compte`.
 */
export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  const pourSysteme = (suite ?? "").startsWith("/system");

  return (
    <PageCompte
      titre={pourSysteme ? "Administration Speedfood" : "Connexion"}
      sousTitre={
        pourSysteme
          ? "Accès réservé aux comptes de l'équipe Speedfood (rôles système)."
          : "Client, restaurateur ou équipe Speedfood : vous arrivez directement à votre espace."
      }
      panneau={
        pourSysteme
          ? undefined
          : {
              titre: "Votre restaurant, dans votre poche.",
              points: [
                "Voyez arriver les commandes et répondez d'un geste.",
                "Confirmez vos plats du jour : le client voit depuis quand.",
                "Partagez votre page par WhatsApp ou avec un QR code.",
                "Speedfood n'encaisse rien : vos clients vous paient directement, en espèces ou avec votre code marchand.",
              ],
            }
      }
      pied={
        pourSysteme ? (
          <p>
            Vous êtes restaurateur ? <Link href="/connexion" className="lien-texte">Connexion restaurateur</Link>
          </p>
        ) : (
          <p>
            Pas encore de compte ? <Link href="/entrer" className="lien-texte">Créez votre compte</Link> pour commander, ou{" "}
            <Link href="/inscription" className="lien-texte">inscrivez votre restaurant</Link>
            <br />
            Équipe Speedfood ? <Link href="/connexion?suite=/system" className="lien-texte">Administration</Link>
          </p>
        )
      }
    >
      <Card>
        <ConnexionForm suite={suite ?? ""} />
      </Card>
    </PageCompte>
  );
}
