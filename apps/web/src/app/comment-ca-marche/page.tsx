import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import Link from "next/link";
import { VecteurParcours } from "@/components/site/vecteurs/VecteurParcours";
import type { Metadata } from "next";
import {
  EtapesInteractives,
  type EtapeAffichee,
} from "@/components/site/EtapesInteractives";
import { Illustration } from "@/components/illustrations/Illustration";
import {
  PALETTES,
  type Illustration as ModeleIllustration,
} from "@/lib/illustrations/modele";
import { origineDuSite } from "@/lib/partage/origine";
import { TicketVoyage } from "@/components/site/TicketVoyage";
import { lireAccueil, ticketExemple } from "@/lib/site/accueil";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Comment ça marche",
    description:
      "Choisir sa zone, consulter les menus, envoyer sa commande et la suivre : les quatre étapes de Speedfood, en phase pilote à Conakry.",
    alternates: { canonical: `${origine}/comment-ca-marche` },
  };
}

function grand(motif: string): ModeleIllustration {
  return {
    style: "assiette",
    motif,
    ...PALETTES.defaut,
    fond: "#ffd9b8",
    texte: "",
    genere: true,
  };
}

/** Chaque phrase décrit ce que l'application fait réellement (aide, propositions de prix, suivi, règlement hors Speedfood). */
const ETAPES = [
  {
    titre: "Choisissez votre zone",
    texte: "Une commune ou un quartier, pour voir les restaurants qui s'y trouvent.",
    detail:
      "Indiquez votre localité depuis la page d'accueil ou parcourez « Explorer les localités ». Speedfood vous montre les restaurants référencés dans cette zone. Le service est en phase pilote dans certaines zones de Conakry : d'autres localités seront ajoutées progressivement.",
    motif: "etape-choisir",
  },
  {
    titre: "Consultez les menus",
    texte: "Les plats, leurs prix et l'heure de confirmation du restaurant.",
    detail:
      "Chaque plat affiche l'heure à laquelle son restaurant l'a confirmé : si la confirmation est ancienne, il est marqué « à confirmer ». Vous voyez aussi les informations du restaurant avant de décider.",
    motif: "etape-commander",
  },
  {
    titre: "Envoyez votre commande",
    texte: "Un panier, un compte, un envoi au restaurant.",
    detail:
      "Ajoutez vos plats, connectez-vous ou créez votre compte, puis indiquez votre nom et votre téléphone (et une adresse pour une livraison). Rien n'est débité à la commande : vous payez le restaurant après son acceptation.",
    motif: "etape-suivre",
  },
  {
    titre: "Suivez et recevez votre commande",
    texte: "Les mises à jour du restaurant, puis retrait ou livraison.",
    detail:
      "Votre lien de suivi indique si la commande est en attente, acceptée, prête ou terminée. Si le restaurant doit changer un prix, il vous le propose : rien ne part en préparation sans votre accord. Le restaurant précise les options de retrait ou de livraison ; vous le réglez directement, en espèces ou avec son code marchand Orange Money ou MTN MoMo. Speedfood n'encaisse rien et ne promet aucun délai de livraison.",
    motif: "emporter",
  },
];

/** Pastille ronde (même style que les étapes de l'accueil) pour la bande « Prêt ? ». */
function pastille(motif: string): ModeleIllustration {
  return {
    style: "pastille",
    motif,
    ...PALETTES.defaut,
    fond: "#ffe9c7",
    texte: "",
    genere: true,
  };
}

export default async function CommentCaMarchePage() {
  const ticket = ticketExemple(await lireAccueil());
  const etapes: EtapeAffichee[] = ETAPES.map((e) => ({
    titre: e.titre,
    texte: e.texte,
    detail: e.detail,
    visuel: <Illustration valeur={grand(e.motif)} nom={e.titre} decoratif />,
  }));

  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-vecteur">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Quatre étapes</p>
        <h1 className="pub-titre pub-h1-page">
          De la recherche à <span className="pub-surligne">la commande</span>
        </h1>
        <p className="pub-accueil-lead">
          Pas d&apos;application à installer, rien à payer à Speedfood. Voici ce
          qui se passe, dans l&apos;ordre.
        </p>
      </div>
      <VecteurParcours />
      </div>

      <EtapesInteractives etapes={etapes} />
      <p className="pub-etapes-pied">
        Tout cela sans application ni frais cachés.
      </p>

      {ticket ? (
        <>
          <SeparateurBloc />
          <section
            className="pub-section-ticket"
            aria-labelledby="ticket-titre"
          >
            <div className="pub-entete-rubrique">
              <p className="pub-kicker">Une commande, de bout en bout</p>
              <h2 id="ticket-titre" className="pub-titre pub-h2">
                Suivez chaque étape{" "}
                <span className="pub-surligne">en toute clarté</span>
              </h2>
              <p className="pub-accueil-lead">
                Le ticket se remplit, le restaurant l&apos;accepte, le prépare,
                puis la commande est terminée. Chaque état s&apos;affiche sur
                votre lien de suivi.
              </p>
            </div>
            <TicketVoyage
              restaurant={ticket.restaurant}
              lignes={ticket.lignes}
            />
          </section>
        </>
      ) : null}

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

      <SeparateurBloc />

      <div className="pub-bande-pro">
        <div className="pub-bande-contenu">
          <span className="pub-bande-icone">
            <Illustration valeur={pastille("etape-choisir")} nom="" decoratif />
          </span>
          <div>
            <p className="pub-kicker pub-kicker-encre">Prêt ?</p>
            <h2 className="pub-titre pub-h2">
              Commencez par choisir votre zone
            </h2>
          </div>
        </div>
        <Link href="/restaurants" className="pub-btn pub-btn-clair">
          Voir les restaurants
          <span className="pub-btn-point" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>
    </main>
  );
}
