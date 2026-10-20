import Link from "next/link";
import type { Metadata } from "next";
import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import { VecteurPartenaire } from "@/components/site/vecteurs/VecteurPartenaire";
import { SymbolePartenariat } from "@/components/site/SymbolePartenariat";
import { origineDuSite } from "@/lib/partage/origine";
import { FORMES_PARTENARIAT, LIBELLES_FORMES, lireForme, type FormePartenariat } from "@/lib/site/partenariat";
import { FormulairePartenariat } from "./FormulairePartenariat";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Devenir partenaire",
    description:
      "Investir, soutenir la communauté, apporter des moyens ou contribuer : rejoignez Speedfood et aidez les restaurants de Conakry à se faire connaître.",
    alternates: { canonical: `${origine}/devenir-partenaire` },
  };
}

// Rendue à chaque requête : le formulaire se présélectionne selon `?forme=` et le cadre du site lit les interrupteurs de fonctionnalités.
export const dynamic = "force-dynamic";

const FORMES: Record<FormePartenariat, { titre: string; texte: string; cherche: string }> = {
  investir: {
    titre: "Investir",
    texte: "Vous voulez financer la croissance de Speedfood : capital, prêt ou accompagnement financier.",
    cherche: "Un partenaire patient, qui partage une vision locale et accepte que le projet soit encore en phase pilote.",
  },
  soutenir: {
    titre: "Soutenir la communauté",
    texte: "Fondation, association, mécène : financez de la formation, du matériel ou l'accès au numérique pour les restaurateurs de quartier.",
    cherche: "Des actions concrètes pour les petits restaurants : photos de menu, formation, équipement, premiers pas en ligne.",
  },
  moyens: {
    titre: "Apporter des moyens",
    texte: "Entreprise, institution, opérateur : réseau, paiement mobile, logistique, livraison, matériel ou visibilité.",
    cherche: "Des services qui simplifient la commande et la livraison, sans enfermer les restaurants ni les clients.",
  },
  contribuer: {
    titre: "Contribuer",
    texte: "Vous donnez du temps et du talent : développement, design, traduction, données, conseil, communication.",
    cherche: "Des compétences précises, même quelques heures, qui font avancer une fonction du site.",
  },
};

const ENGAGEMENTS = [
  { titre: "Transparence", texte: "Nous disons ce que Speedfood fait, ce qu'il ne fait pas encore, et où en est le projet. Aucun chiffre n'est inventé pour convaincre." },
  { titre: "Les restaurants gardent la main", texte: "Leurs prix, leurs horaires, leur livraison. Un partenaire n'achète ni ne dirige un restaurant." },
  { titre: "Des données protégées", texte: "Les données des clients et des restaurateurs ne sont ni vendues ni cédées à un partenaire." },
  { titre: "Rien n'est engagé d'avance", texte: "Le formulaire ouvre une conversation. Tout accord est discuté puis écrit avant de commencer." },
];

export default async function DevenirPartenairePage({ searchParams }: { searchParams: Promise<{ forme?: string }> }) {
  const { forme } = await searchParams;
  const formeInitiale = lireForme(forme);

  return (
    <main className="pub-conteneur pub-rubrique partenariat-page">
      <div className="pub-entete-vecteur">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">Devenir partenaire</p>
          <h1 className="pub-titre pub-h1-page">
            Faisons grandir la table de Conakry, <span className="pub-surligne">ensemble</span>
          </h1>
          <p className="pub-accueil-lead">
            Speedfood met les restaurants de quartier à portée de téléphone. Pour aller plus loin, nous cherchons des partenaires qui veulent investir,
            soutenir la communauté, apporter des moyens ou contribuer.
          </p>
          <div className="pub-accueil-actions">
            <a href="#proposer" className="pub-btn">
              Proposer un partenariat
              <span className="pub-btn-point" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
            <Link href="/a-propos#mission" className="pub-btn pub-btn-clair">
              Notre mission
            </Link>
          </div>
          <p className="partenariat-aiguillage">
            Vous êtes restaurateur ? <Link href="/restaurateurs" className="lien-texte">Votre page est ici</Link>.
          </p>
        </div>
        <VecteurPartenaire />
      </div>

      <SeparateurBloc />

      <section aria-labelledby="partenaire-formes">
        <h2 id="partenaire-formes" className="pub-titre pub-h3-page">
          Quatre façons de nous rejoindre
        </h2>
        <ul className="partenariat-cartes">
          {FORMES_PARTENARIAT.map((f) => (
            <li key={f} className={`pub-carte pub-carte-pad partenariat-carte partenariat-carte-${f}`}>
              <SymbolePartenariat forme={f} />
              <h3>{FORMES[f].titre}</h3>
              <p>{FORMES[f].texte}</p>
              <p className="partenariat-cherche">
                <strong>Ce que nous cherchons.</strong> {FORMES[f].cherche}
              </p>
              <Link href={`/devenir-partenaire?forme=${f}#proposer`} className="lien-texte" aria-label={`Proposer : ${LIBELLES_FORMES[f]}`}>
                Je choisis cette voie
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SeparateurBloc />

      <section aria-labelledby="partenaire-engagements">
        <h2 id="partenaire-engagements" className="pub-titre pub-h3-page">
          Nos engagements envers un partenaire, et envers la communauté
        </h2>
        <ul className="pub-principes partenariat-engagements">
          {ENGAGEMENTS.map((e) => (
            <li key={e.titre} className="pub-carte pub-carte-pad">
              <h3 className="pub-titre pub-h3-page">{e.titre}</h3>
              <p>{e.texte}</p>
            </li>
          ))}
        </ul>
      </section>

      <SeparateurBloc />

      <div className="pub-deux" id="proposer">
        <section aria-labelledby="partenaire-proposer" className="partenariat-intro-form">
          <h2 id="partenaire-proposer" className="pub-titre pub-h3-page">
            Proposer un partenariat
          </h2>
          <p>Décrivez qui vous êtes et ce que vous imaginez. Une personne de l&apos;équipe vous répond ; nous lisons chaque demande.</p>
          <ul className="pub-liste-simple">
            <li>Aucun engagement : le formulaire ouvre simplement la discussion.</li>
            <li>Vos coordonnées ne servent qu&apos;à vous répondre.</li>
            <li>
              Les règles du site sont dans les <Link href="/conditions" className="lien-texte">conditions d&apos;utilisation</Link>.
            </li>
          </ul>
        </section>
        <section aria-label="Formulaire de partenariat" className="pub-carte pub-carte-pad">
          <FormulairePartenariat formeInitiale={formeInitiale} />
        </section>
      </div>
    </main>
  );
}
