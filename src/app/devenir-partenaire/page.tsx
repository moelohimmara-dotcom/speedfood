import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import { VecteurRestaurateur } from "@/components/site/vecteurs/VecteurRestaurateur";
import Link from "next/link";
import type { Metadata } from "next";
import { origineDuSite } from "@/lib/partage/origine";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { formaterDelaiValidation } from "@/lib/parametres/assistance-format";
import { BoutonAssistance } from "@/components/BoutonAssistance";
import { ChecklistRestaurateur } from "@/components/site/ChecklistRestaurateur";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Devenir restaurant partenaire",
    description:
      "Inscrivez votre restaurant sur Speedfood : étapes, ce que vous recevez, ce que Speedfood ne fait pas.",
    alternates: { canonical: `${origine}/devenir-partenaire` },
  };
}

const ETAPES = [
  {
    titre: "Créez votre compte",
    texte:
      "Une adresse e-mail et un mot de passe. Vous pouvez ensuite activer la double authentification.",
  },
  {
    titre: "Décrivez votre établissement",
    texte:
      "Nom, type de cuisine et quartier : trois champs, le reste se complète après.",
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
 * Page « Devenir partenaire ». Aucun chiffre ni délai inventé : la durée de validation et les conditions du pilote sont formulées comme des
 * réserves, jusqu'à décision de l'équipe.
 */
export default async function DevenirPartenairePage() {
  const { whatsapp, delaiValidationHeures } = await lireReglagesAssistance();
  const delai = delaiValidationHeures
    ? `Réponse en général sous ${formaterDelaiValidation(delaiValidationHeures)}. `
    : "";
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-vecteur">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">Pour les restaurateurs</p>
          <h1 className="pub-titre pub-h1-page">
            Votre carte <span className="pub-surligne">en ligne</span>
          </h1>
          <p className="pub-accueil-lead">
            Speedfood met votre restaurant en vitrine à Conakry et vous envoie
            les commandes. Vous gardez la main sur vos prix, vos horaires et
            votre livraison.
          </p>
          <div className="pub-accueil-actions">
            <Link href="/inscription" className="pub-btn">
              Inscrire mon restaurant
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
                    {e.titre === "Validation par l'équipe" ? delai : ""}
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
            Ma fiche est-elle prête ?
          </h2>
          <ChecklistRestaurateur />
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
            éventuel, commission) sont précisées avec chaque restaurant
            partenaire avant la publication de sa page ; la création de votre
            page n&apos;implique aucun paiement.
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
