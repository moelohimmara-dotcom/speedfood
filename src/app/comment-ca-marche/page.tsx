import Link from "next/link";
import type { Metadata } from "next";
import { EtapesInteractives, type EtapeAffichee } from "@/components/site/EtapesInteractives";
import { Illustration } from "@/components/illustrations/Illustration";
import { PALETTES, type Illustration as ModeleIllustration } from "@/lib/illustrations/modele";
import { origineDuSite } from "@/lib/partage/origine";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Comment ça marche",
    description: "Choisir un restaurant, commander, suivre sa commande et la recevoir : les quatre étapes de Speedfood à Conakry.",
    alternates: { canonical: `${origine}/comment-ca-marche` },
  };
}

function grand(motif: string): ModeleIllustration {
  return { style: "assiette", motif, ...PALETTES.defaut, fond: "#ffd9b8", texte: "", genere: true };
}

/** Chaque phrase décrit ce que l'application fait réellement (aide, propositions de prix, suivi, règlement hors Speedfood). */
const ETAPES = [
  {
    titre: "Choisir",
    texte: "Un restaurant de votre quartier.",
    detail:
      "Parcourez les restaurants par quartier ou par envie. Chaque plat affiche l'heure à laquelle son restaurant l'a confirmé : si la confirmation est ancienne, il est marqué « à confirmer ».",
    motif: "couvert",
  },
  {
    titre: "Commander",
    texte: "Un panier, vos coordonnées, c'est tout.",
    detail:
      "Ajoutez vos plats, indiquez votre nom et votre téléphone (et une adresse pour une livraison). Aucun compte n'est obligatoire. Aucun paiement en ligne : rien n'est débité.",
    motif: "emporter",
  },
  {
    titre: "Suivre",
    texte: "Un lien privé, quatre états.",
    detail:
      "Votre lien de suivi indique si la commande est en attente, acceptée, prête ou terminée. Si le restaurant doit changer un prix, il vous le propose : rien ne part en préparation sans votre accord.",
    motif: "trait-livraison",
  },
  {
    titre: "Recevoir",
    texte: "Retrait ou livraison, réglés au restaurant.",
    detail:
      "Le restaurant vous remet la commande, ou la livre selon ses propres conditions. Vous le réglez directement : Speedfood n'encaisse rien et ne promet aucun délai de livraison.",
    motif: "bol",
  },
];

export default function CommentCaMarchePage() {
  const etapes: EtapeAffichee[] = ETAPES.map((e) => ({
    titre: e.titre,
    texte: e.texte,
    detail: e.detail,
    visuel: <Illustration valeur={grand(e.motif)} nom={e.titre} decoratif />,
  }));

  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Quatre étapes</p>
        <h1 className="pub-titre pub-h1-page">
          Du choix à <span className="pub-surligne">l&apos;assiette</span>
        </h1>
        <p className="pub-accueil-lead">Pas d&apos;application à installer ni de paiement en ligne. Voici ce qui se passe, dans l&apos;ordre.</p>
      </div>

      <EtapesInteractives etapes={etapes} />

      <noscript>
      <ol className="pub-liste-sans-js">
        {ETAPES.map((e, i) => (
          <li key={e.titre}>
            <strong>
              {i + 1}. {e.titre}.
            </strong>{" "}
            {e.detail}
          </li>
        ))}
      </ol>
      </noscript>

      <div className="pub-bande-pro">
        <div>
          <p className="pub-kicker pub-kicker-encre">Prêt ?</p>
          <h2 className="pub-titre pub-h2">Commencez par choisir un restaurant</h2>
        </div>
        <Link href="/restaurants" className="pub-btn pub-btn-clair">
          Voir les restaurants
          <span className="pub-btn-point" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>
    </main>
  );
}
