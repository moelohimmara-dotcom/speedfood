import Link from "next/link";
import type { Metadata } from "next";
import { origineDuSite } from "@/lib/partage/origine";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { BoutonAssistance } from "@/components/BoutonAssistance";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Conditions d'utilisation",
    description: "Les règles d'usage de Speedfood pour les clients, les restaurateurs et les partenaires.",
    alternates: { canonical: `${origine}/conditions` },
  };
}

// Rendue à chaque requête : le cadre du site lit les interrupteurs de fonctionnalités et les réglages d'assistance.
export const dynamic = "force-dynamic";

/**
 * Conditions d'utilisation, VERSION PROVISOIRE (20 octobre 2026). Rédigées d'après ce que l'application fait réellement (aucun paiement encaissé,
 * pas de livraison assurée par Speedfood, validation des pages par l'équipe, données minimales). Elles ne remplacent pas l'avis d'un juriste :
 * le droit applicable, la juridiction, la limitation de responsabilité et les clauses propres aux partenaires restent à faire valider (voir les
 * questions juridiques ouvertes dans docs/STRATEGIE-PAIEMENT.md et docs/cadrage/PROCEDURE-SECURITE.md).
 */
const SOMMAIRE = [
  { id: "objet", titre: "Objet et acteurs" },
  { id: "tous", titre: "Règles communes" },
  { id: "clients", titre: "Pour les clients" },
  { id: "restaurateurs", titre: "Pour les restaurateurs" },
  { id: "partenaires", titre: "Pour les partenaires" },
  { id: "limites", titre: "Ce que Speedfood ne fait pas" },
  { id: "donnees", titre: "Données personnelles" },
  { id: "evolution", titre: "Évolution et contact" },
];

export default async function ConditionsPage() {
  const { whatsapp } = await lireReglagesAssistance();
  return (
    <main className="pub-conteneur pub-rubrique conditions-page">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Conditions d&apos;utilisation</p>
        <h1 className="pub-titre pub-h1-page">
          Des règles <span className="pub-surligne">simples et lisibles</span>
        </h1>
        <p className="pub-accueil-lead">
          Ce texte explique comment utiliser Speedfood, selon que vous êtes client, restaurateur ou partenaire. Il décrit ce que le site fait réellement, sans
          promesse que nous ne pourrions pas tenir.
        </p>
      </div>

      <div className="pub-note-pilote" role="note">
        Version provisoire du 20 octobre 2026, pendant la phase pilote à Conakry. Elle sera relue par un juriste avant sa version définitive ; les points encore à
        préciser sont signalés dans le texte.
      </div>

      <div className="conditions-disposition">
        <nav className="conditions-sommaire" aria-label="Sommaire des conditions">
          <p className="conditions-sommaire-titre">Sommaire</p>
          <ol>
            {SOMMAIRE.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titre}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="conditions-corps">
          <section id="objet" aria-labelledby="c-objet" className="pub-carte pub-carte-pad">
            <h2 id="c-objet" className="pub-titre pub-h3-page">1. Objet et acteurs</h2>
            <p>
              Speedfood est un portail qui aide les habitants de Conakry à découvrir les menus des restaurants de leur quartier et à leur transmettre une demande de
              commande. Trois publics l&apos;utilisent : les <strong>clients</strong> (qui commandent), les <strong>restaurateurs</strong> (qui reçoivent et préparent) et
              les <strong>partenaires</strong> (qui investissent, soutiennent ou contribuent).
            </p>
            <p>En utilisant le site, vous acceptez les règles communes et celles de votre rôle.</p>
          </section>

          <section id="tous" aria-labelledby="c-tous" className="pub-carte pub-carte-pad">
            <h2 id="c-tous" className="pub-titre pub-h3-page">2. Règles communes</h2>
            <ul className="pub-liste-simple">
              <li>Donnez des informations exactes : un faux nom, un faux numéro ou une fausse adresse empêchent d&apos;être servi.</li>
              <li>Respectez les autres : pas d&apos;insulte, de menace, de contenu illégal ou trompeur.</li>
              <li>N&apos;essayez pas de perturber le site (envois en rafale, accès à ce qui ne vous appartient pas). Nous limitons le nombre de demandes envoyées en peu de temps.</li>
              <li>Protégez votre compte : votre mot de passe vous appartient et ne doit pas être partagé.</li>
              <li>Nous pouvons suspendre un compte ou retirer un contenu qui enfreint ces règles, en vous en indiquant la raison.</li>
            </ul>
          </section>

          <section id="clients" aria-labelledby="c-clients" className="pub-carte pub-carte-pad conditions-clients">
            <h2 id="c-clients" className="pub-titre pub-h3-page">3. Pour les clients</h2>
            <ul className="pub-liste-simple">
              <li>Une commande envoyée est une <strong>demande</strong>. Elle devient ferme quand le restaurant l&apos;accepte. Rien n&apos;est préparé avant son accord.</li>
              <li>Le restaurant peut proposer un autre total ou d&apos;autres conditions de livraison : rien ne part en préparation sans votre accord explicite.</li>
              <li>Les plats affichent l&apos;heure de leur dernière confirmation. Sans confirmation récente, ils sont indiqués « à confirmer ».</li>
              <li>Le règlement se fait directement avec le restaurant, selon les moyens qu&apos;il propose. Speedfood n&apos;encaisse aucun paiement.</li>
              <li>Un compte client est facultatif : vous pouvez commander sans compte. Avec un compte, vous retrouvez vos commandes, adresses et favoris, et vous pouvez le supprimer vous-même à tout moment.</li>
              <li>Les avis doivent décrire une commande réelle, sans propos injurieux.</li>
            </ul>
          </section>

          <section id="restaurateurs" aria-labelledby="c-restaurateurs" className="pub-carte pub-carte-pad conditions-restaurateurs">
            <h2 id="c-restaurateurs" className="pub-titre pub-h3-page">4. Pour les restaurateurs</h2>
            <ul className="pub-liste-simple">
              <li>Votre page n&apos;est publiée qu&apos;après la validation d&apos;une personne de l&apos;équipe Speedfood, qui peut vous demander une correction.</li>
              <li>Vous restez seul responsable de vos prix, de vos horaires, de la disponibilité de vos plats, de votre livraison et de la conformité de votre activité (hygiène, autorisations).</li>
              <li>Les informations de votre page doivent être exactes et à jour : confirmez vos plats du jour, indiquez quand vous ne prenez plus de commandes.</li>
              <li>Les coordonnées d&apos;un client ne servent qu&apos;à traiter sa commande ; vous ne les réutilisez pas à d&apos;autres fins.</li>
              <li>Les photos et textes que vous publiez doivent vous appartenir ou être libres de droits.</li>
              <li>Pendant le pilote, la création de votre page n&apos;implique aucun paiement. Les conditions financières éventuelles (coût, commission) sont précisées avec vous avant publication, par écrit.</li>
              <li>Vous pouvez fermer votre compte à tout moment ; nous pouvons suspendre une page qui ne respecte pas ces règles.</li>
            </ul>
          </section>

          <section id="partenaires" aria-labelledby="c-partenaires" className="pub-carte pub-carte-pad conditions-partenaires">
            <h2 id="c-partenaires" className="pub-titre pub-h3-page">5. Pour les partenaires</h2>
            <ul className="pub-liste-simple">
              <li>Le formulaire de <Link href="/devenir-partenaire" className="lien-texte">Devenir partenaire</Link> ouvre une discussion : il n&apos;engage ni Speedfood ni vous.</li>
              <li>Tout partenariat (investissement, soutien, moyens, contribution) fait l&apos;objet d&apos;un accord écrit, discuté avant de commencer.</li>
              <li>Un partenaire n&apos;achète pas le classement des restaurants et ne dirige aucun restaurant. Toute mise en avant payante serait clairement signalée comme telle.</li>
              <li>Les données personnelles des clients et des restaurateurs ne sont ni vendues ni cédées à un partenaire.</li>
              <li>Les clauses financières, de confidentialité et de propriété propres à chaque partenariat sont fixées dans l&apos;accord écrit. <em>Modèle d&apos;accord à faire rédiger par un juriste.</em></li>
            </ul>
          </section>

          <section id="limites" aria-labelledby="c-limites" className="pub-carte pub-carte-pad">
            <h2 id="c-limites" className="pub-titre pub-h3-page">6. Ce que Speedfood ne fait pas</h2>
            <ul className="pub-liste-simple">
              <li>Il n&apos;encaisse aucun paiement et ne garantit pas le règlement entre client et restaurant.</li>
              <li>Il ne livre pas : la livraison est assurée par le restaurant ou son livreur, qui fixent leurs conditions et leurs frais.</li>
              <li>Il ne promet aucun délai de préparation ni de livraison.</li>
              <li>Il ne prépare, ne contrôle et ne garantit pas les plats : la qualité et la conformité des plats relèvent du restaurant.</li>
              <li>Il ne garantit pas que le site soit toujours disponible : une interruption est possible, surtout pendant le pilote.</li>
            </ul>
            <p><em>Limitation de responsabilité, droit applicable et juridiction compétente : à préciser par un juriste avant la version définitive.</em></p>
          </section>

          <section id="donnees" aria-labelledby="c-donnees" className="pub-carte pub-carte-pad">
            <h2 id="c-donnees" className="pub-titre pub-h3-page">7. Données personnelles</h2>
            <p>
              Nous collectons le minimum nécessaire : votre numéro n&apos;est visible que du restaurant choisi et est effacé quelque temps après la commande ; rien n&apos;est vendu.
              Le détail (ce qui est collecté, combien de temps, vos droits) est dans la <Link href="/confidentialite" className="lien-texte">politique de confidentialité</Link>.
            </p>
          </section>

          <section id="evolution" aria-labelledby="c-evolution" className="pub-carte pub-carte-pad">
            <h2 id="c-evolution" className="pub-titre pub-h3-page">8. Évolution et contact</h2>
            <p>
              Ces conditions évoluent avec le projet. La date de la version en cours est indiquée en haut de cette page ; un changement important est annoncé avant
              son entrée en vigueur. Une question, un doute, une demande de suppression de données ? Écrivez-nous.
            </p>
            <p className="pub-accueil-actions">
              <BoutonAssistance numero={whatsapp} className="pub-btn pub-btn-clair" />
              <Link href="/aide" className="pub-btn pub-btn-clair">Aide et questions</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
