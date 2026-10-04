import Link from "next/link";

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

export default function AProposPage() {
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">À propos</p>
        <h1 className="pub-titre pub-h1-page">
          Les restaurants de Conakry, <span className="pub-surligne">à portée de téléphone</span>
        </h1>
        <p className="pub-accueil-lead">
          Speedfood aide les habitants de Conakry à trouver un plat, vérifier qu&apos;il est vraiment disponible, et envoyer leur commande au restaurant de leur quartier.
        </p>
      </div>

      <div className="pub-note-pilote" role="note">
        Speedfood est en phase pilote à Conakry : Kaloum, Dixinn, Ratoma et Matam d&apos;abord. Vos retours façonnent le produit.
      </div>

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
        <Link href="/devenir-partenaire" className="pub-btn pub-btn-clair">
          Je suis restaurateur
        </Link>
        <Link href="/confidentialite" className="pub-btn pub-btn-clair">
          Confidentialité
        </Link>
      </div>
    </main>
  );
}
