import Link from "next/link";
import type { Metadata } from "next";
import { LienRetour } from "@/components/LienRetour";
import { origineDuSite } from "@/lib/partage/origine";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Devenir restaurant partenaire",
    description: "Inscrivez votre restaurant sur Speedfood : étapes, ce que vous recevez, ce que Speedfood ne fait pas.",
    alternates: { canonical: `${origine}/devenir-partenaire` },
  };
}

const ETAPES = [
  {
    titre: "Créez votre compte",
    texte: "Une adresse e-mail et un mot de passe. Vous pouvez ensuite activer la double authentification.",
  },
  {
    titre: "Décrivez votre établissement",
    texte: "Nom, type de cuisine et quartier : trois champs, le reste se complète après.",
  },
  {
    titre: "Complétez votre page",
    texte:
      "Photo, logo, menu avec prix, horaires, consignes et moyens de paiement acceptés. Un tableau de bord vous indique ce qu'il reste à faire.",
  },
  {
    titre: "Validation par l'équipe",
    texte:
      "Une personne de l'équipe Speedfood relit votre page avant publication. Si une correction est nécessaire, elle vous l'indique dans votre tableau de bord.",
  },
  {
    titre: "Recevez vos commandes",
    texte:
      "Votre page, son lien et son QR code sont prêts à partager. Chaque nouvelle commande déclenche une alerte sonore, et une notification même console fermée si vous l'activez.",
  },
];

/**
 * Page « Devenir partenaire » (lots D et E). Aucun chiffre ni délai inventé : la durée de validation et les
 * conditions du pilote sont formulées comme des réserves, jusqu'à décision de l'équipe.
 */
export default function DevenirPartenairePage() {
  return (
    <main className="page-texte">
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>
      <h1>Devenir restaurant partenaire</h1>
      <p className="page-texte-intro">
        Speedfood met votre restaurant en vitrine à Conakry et vous envoie les commandes. Vous gardez la main sur vos
        prix, vos horaires et votre livraison.
      </p>

      <ol className="etapes-partenaire">
        {ETAPES.map((etape) => (
          <li key={etape.titre}>
            <h2>{etape.titre}</h2>
            <p>{etape.texte}</p>
          </li>
        ))}
      </ol>

      <h2 className="page-texte-sous-titre">Ce que Speedfood ne fait pas</h2>
      <ul className="page-texte-liste">
        <li>Il n&apos;encaisse aucun paiement : le client règle directement avec vous.</li>
        <li>Il ne livre pas : si vous livrez, c&apos;est vous qui fixez vos conditions et vos frais.</li>
        <li>Il ne promet aucun délai de livraison à vos clients.</li>
      </ul>

      <h2 className="page-texte-sous-titre">Conditions du pilote</h2>
      <p>
        Le projet est en phase pilote à Conakry. Les conditions (coût éventuel, commission) sont précisées avec chaque
        restaurant partenaire avant la publication de sa page ; la création de votre page n&apos;implique aucun paiement.
      </p>

      <div className="page-texte-actions">
        <Link href="/inscription" className="btn btn-primary btn-lg">
          Inscrire mon restaurant
        </Link>
        <Link href="/aide" className="btn btn-secondary btn-lg">
          Questions fréquentes
        </Link>
      </div>
    </main>
  );
}
