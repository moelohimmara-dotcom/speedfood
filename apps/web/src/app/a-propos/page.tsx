import Link from "next/link";
import { VecteurAPropos } from "@/components/site/vecteurs/VecteurAPropos";
import { SymboleAudience, type PublicSpeedfood } from "@/components/site/SymboleAudience";

/**
 * Page « À propos » (allégée le 4 octobre 2026, direction B). L'ancien argumentaire long, avec ses restaurants d'exemple, est retiré : cette
 * page ne dit que ce que le produit fait, et renvoie vers les rubriques utiles.
 */
const PRINCIPES = [
  { titre: "L'heure à l'appui", texte: "Chaque plat affiche l'heure à laquelle son restaurant l'a confirmé. Sans confirmation récente, nous écrivons « à confirmer »." },
  { titre: "Le restaurant garde la main", texte: "Ses prix, ses horaires, sa livraison. Si un montant doit changer, il vous le propose : rien ne part en préparation sans votre accord." },
  { titre: "Aucun paiement chez nous", texte: "Speedfood n'encaisse rien. Vous réglez directement avec le restaurant." },
  { titre: "Vos données restent limitées", texte: "Votre numéro n'est visible que du restaurant choisi, et il est effacé quelque temps après la commande. Rien n'est vendu." },
];

/**
 * Mission, vision et philosophie de marque (20 octobre 2026). Premier texte proposé à partir de CADRAGE.md et des principes ci-dessus ; à relire et à
 * corriger par l'équipe : ce sont ses mots qui font foi. Aucun chiffre ni promesse de résultat.
 */
const VALEURS = [
  { titre: "La vérité avant la vitesse", texte: "Une information juste vaut mieux qu'une promesse rapide : un plat est « à confirmer » tant que le restaurant ne l'a pas confirmé." },
  { titre: "Le quartier d'abord", texte: "Nous partons des rues, des marchés et des petites tables de Conakry. Un restaurant de quartier mérite la même visibilité qu'une grande enseigne." },
  { titre: "Chacun garde la main", texte: "Le restaurateur décide de ses prix, de ses horaires et de sa livraison. Le client approuve tout changement de total avant la préparation." },
  { titre: "Léger et accessible", texte: "Un site qui se charge vite sur un téléphone modeste et une connexion limitée, en français clair, sans jargon." },
  { titre: "Respect des données", texte: "Peu de données, gardées peu de temps, jamais vendues. Nous préférons demander moins." },
];

const PUBLICS: { cle: PublicSpeedfood; titre: string; texte: string; lien: string; href: string }[] = [
  { cle: "client", titre: "Clients", texte: "Trouver un plat vraiment disponible près de chez soi et envoyer sa commande.", lien: "Parcourir les restaurants", href: "/restaurants" },
  { cle: "restaurateur", titre: "Restaurateurs", texte: "Une fiche créée avec eux par l'équipe, leurs prix, leurs horaires, des commandes confirmées.", lien: "Être référencé", href: "/restaurateurs" },
  { cle: "partenaire", titre: "Partenaires", texte: "Investir, soutenir la communauté, apporter des moyens ou contribuer.", lien: "Devenir partenaire", href: "/devenir-partenaire" },
];

// Rendue à chaque requête (et non figée à la construction) : l'accueil lit des données vivantes et le cadre du site lit les interrupteurs
// de fonctionnalités du super administrateur (voir src/lib/fonctionnalites/lire.ts) ; sinon un changement n'apparaîtrait qu'au prochain déploiement.
export const dynamic = "force-dynamic";

export default function AProposPage() {
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-vecteur">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">À propos</p>
        <h1 className="pub-titre pub-h1-page">
          Les restaurants de Conakry, <span className="pub-surligne">à portée de téléphone</span>
        </h1>
        <p className="pub-accueil-lead">
          Speedfood aide les habitants de Conakry à trouver un plat, vérifier qu&apos;il est vraiment disponible, et envoyer leur commande au restaurant de leur quartier.
        </p>
      </div>
      <VecteurAPropos />
      </div>

      <div className="pub-note-pilote" role="note">
        Speedfood est en phase pilote à Conakry : Kaloum, Dixinn, Ratoma et Matam d&apos;abord. Vos retours façonnent le produit.
      </div>

      <div className="apropos-marque">
        <section id="mission" className="apropos-bloc apropos-bloc-mission" aria-labelledby="apropos-mission">
          <p className="pub-kicker">Notre mission</p>
          <h2 id="apropos-mission" className="pub-titre pub-h3-page">Rendre les restaurants de quartier faciles à trouver et à commander</h2>
          <p>
            Aider les habitants de Conakry à découvrir un plat réellement disponible auprès d&apos;un restaurant près de chez eux, et donner aux restaurateurs un
            outil simple, qui leur appartient, pour recevoir des commandes.
          </p>
        </section>
        <section id="vision" className="apropos-bloc apropos-bloc-vision" aria-labelledby="apropos-vision">
          <p className="pub-kicker">Notre vision</p>
          <h2 id="apropos-vision" className="pub-titre pub-h3-page">Une ville qui mange local, avec des informations vraies</h2>
          <p>
            Que chaque restaurant de quartier de Guinée puisse être trouvé et commandé depuis un simple téléphone, et que la table locale gagne en visibilité et en
            revenus, sans que personne ne perde la maîtrise de son métier.
          </p>
        </section>
      </div>

      <section id="philosophie" aria-labelledby="apropos-philosophie">
        <p className="pub-kicker">Notre philosophie</p>
        <h2 id="apropos-philosophie" className="pub-titre pub-h3-page">Cinq convictions qui guident chaque choix</h2>
        <ol className="apropos-valeurs">
          {VALEURS.map((v, i) => (
            <li key={v.titre} className="pub-carte pub-carte-pad">
              <span className="apropos-valeur-num" aria-hidden="true">{i + 1}</span>
              <h3>{v.titre}</h3>
              <p>{v.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="apropos-publics">
        <h2 id="apropos-publics" className="pub-titre pub-h3-page">Pour qui nous travaillons</h2>
        <ul className="apropos-publics">
          {PUBLICS.map((p) => (
            <li key={p.cle} className={`pub-carte pub-carte-pad apropos-public apropos-public-${p.cle}`}>
              <SymboleAudience public={p.cle} />
              <h3>{p.titre}</h3>
              <p>{p.texte}</p>
              <Link href={p.href} className="lien-texte">{p.lien}</Link>
            </li>
          ))}
        </ul>
      </section>

      <ul className="pub-principes">
        {PRINCIPES.map((p) => (
          <li key={p.titre} className="pub-carte pub-carte-pad">
            <h2 className="pub-titre pub-h3-page">{p.titre}</h2>
            <p>{p.texte}</p>
          </li>
        ))}
      </ul>

      <div className="pub-accueil-actions">
        <Link href="/comment-ca-marche" className="pub-btn">
          Comment ça marche
          <span className="pub-btn-point" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        <Link href="/restaurateurs" className="pub-btn pub-btn-clair">
          Je suis restaurateur
        </Link>
        <Link href="/devenir-partenaire" className="pub-btn pub-btn-clair">
          Devenir partenaire
        </Link>
        <Link href="/conditions" className="pub-btn pub-btn-clair">
          Conditions d&apos;utilisation
        </Link>
        <Link href="/confidentialite" className="pub-btn pub-btn-clair">
          Confidentialité
        </Link>
      </div>
    </main>
  );
}
