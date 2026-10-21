import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import { VecteurRestaurateur } from "@/components/site/vecteurs/VecteurRestaurateur";
import Link from "next/link";
import type { Metadata } from "next";
import { origineDuSite } from "@/lib/partage/origine";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { BoutonAssistance } from "@/components/BoutonAssistance";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Restaurateurs : être référencé sur Speedfood",
    description:
      "Demandez à être référencé : l'équipe Speedfood vous rappelle, crée votre fiche avec vous et tient votre catalogue.",
    alternates: { canonical: `${origine}/restaurateurs` },
  };
}

const ETAPES = [
  {
    titre: "Demandez à être référencé",
    texte: "Un formulaire de deux minutes : votre établissement, son emplacement, la personne à rappeler.",
  },
  {
    titre: "L'équipe vous rappelle",
    texte: "Un appel, puis une visite : nous parlons de vos plats, de vos prix, de vos horaires et des conditions, que vous êtes libre d'accepter ou non.",
  },
  {
    titre: "Nous créons votre fiche avec vous",
    texte: "L'équipe saisit votre catalogue (plats, prix, photos, horaires) et le tient à jour avec vous. Vos prix restent les vôtres.",
  },
  {
    titre: "Vous recevez les commandes",
    texte: "Chaque commande vous est confirmée avant d'être validée, par appel, WhatsApp ou depuis votre console si vous en avez une.",
  },
  {
    titre: "Vous préparez",
    texte: "Vous préparez ; l'organisation de la livraison (par vous, ou avec l'aide de Speedfood quand ce service existera) se décide avec vous lors de la visite.",
  },
];

/**
 * Page « Restaurateurs » (ancienne page « Devenir partenaire », devenue le 20 octobre 2026 la page des investisseurs et soutiens : voir
 * /devenir-partenaire). Le restaurateur n'a qu'une porte, « Demander à être référencé ». Aucun chiffre ni délai inventé : la durée de validation et les conditions du pilote sont formulées comme des
 * réserves, jusqu'à décision de l'équipe.
 */
export default async function RestaurateursPage() {
  const { whatsapp } = await lireReglagesAssistance();
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-vecteur">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">Pour les restaurateurs</p>
          <h1 className="pub-titre pub-h1-page">
            Nous nous occupons de <span className="pub-surligne">votre fiche</span>
          </h1>
          <p className="pub-accueil-lead">
            Speedfood met votre restaurant en vitrine à Conakry et vous envoie
            les commandes. L&apos;équipe crée votre fiche et tient votre catalogue
            avec vous : vous gardez la main sur vos prix et vos horaires.
          </p>
          <div className="pub-accueil-actions">
            <Link href="/inscription" className="pub-btn">
              Demander à être référencé
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
            <BoutonAssistance
              numero={whatsapp}
              className="pub-btn pub-btn-clair"
            />
          </div>
        </div>
        <VecteurRestaurateur />
      </div>

      <SeparateurBloc />

      <div className="pub-deux">
        <section aria-labelledby="partenaire-etapes">
          <h2 id="partenaire-etapes" className="pub-titre pub-h3-page">
            Cinq étapes
          </h2>
          <ol className="pub-etapes-pro">
            {ETAPES.map((e, i) => (
              <li key={e.titre}>
                <span className="pub-etape-num">{i + 1}</span>
                <div>
                  <h3>{e.titre}</h3>
                  <p>
                    {e.texte}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          aria-labelledby="partenaire-fiche"
          className="pub-carte pub-carte-pad"
        >
          <h2 id="partenaire-fiche" className="pub-titre pub-h3-page">
            Ce que nous vous demandons
          </h2>
          <ul className="pub-liste-simple">
            <li>Votre carte avec les prix (une photo du menu suffit pour commencer).</li>
            <li>Vos horaires et vos jours de fermeture.</li>
            <li>Un téléphone joignable, WhatsApp si possible, pour confirmer les commandes.</li>
            <li>Les documents nécessaires vous sont indiqués lors du rappel.</li>
          </ul>
        </section>
      </div>

      <SeparateurBloc />

      <div className="pub-deux">
        <section aria-labelledby="partenaire-pas">
          <h2 id="partenaire-pas" className="pub-titre pub-h3-page">
            Ce que Speedfood ne fait pas
          </h2>
          <ul className="pub-liste-simple">
            <li>
              Il n&apos;encaisse aucun paiement : le client règle directement
              avec vous.
            </li>
            <li>
              Il ne livre pas : si vous livrez, c&apos;est vous qui fixez vos
              conditions et vos frais.
            </li>
            <li>Il ne promet aucun délai de livraison à vos clients.</li>
          </ul>
        </section>
        <section aria-labelledby="partenaire-pilote">
          <h2 id="partenaire-pilote" className="pub-titre pub-h3-page">
            Conditions du pilote
          </h2>
          <p>
            Le projet est en phase pilote à Conakry. Les conditions (coût
            éventuel, commission) vous sont présentées lors de la visite, avant
            la création de votre fiche ; la demande de référencement
            n&apos;implique aucun paiement et aucun engagement.
          </p>
          <p>
            <Link href="/aide" className="lien-texte">
              Questions fréquentes
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
