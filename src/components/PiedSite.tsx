import Link from "next/link";

/**
 * Pied de page du site client : trois blocs (Speedfood, Clients, Restaurateurs) puis une ligne de mentions.
 * Aucune promesse commerciale : seulement des liens vers des pages qui existent.
 */
export function PiedSite() {
  return (
    <footer className="site-pied">
      <div className="site-pied-interieur">
        <div className="site-pied-colonne site-pied-marque">
          <p className="site-pied-titre">Speedfood</p>
          <p>
            Trouvez un plat, voyez depuis quand le restaurant l&apos;a confirmé et envoyez votre commande, sans compte
            ni paiement en ligne. Phase pilote à Conakry.
          </p>
        </div>
        <nav className="site-pied-colonne" aria-label="Clients">
          <p className="site-pied-titre">Clients</p>
          <Link href="/restaurants">Découvrir les restaurants</Link>
          <Link href="/panier">Mon panier</Link>
          <Link href="/a-propos">Comment ça marche</Link>
        </nav>
        <nav className="site-pied-colonne" aria-label="Restaurateurs">
          <p className="site-pied-titre">Restaurateurs</p>
          <Link href="/inscription">Inscrire mon restaurant</Link>
          <Link href="/connexion">Se connecter</Link>
        </nav>
        <nav className="site-pied-colonne" aria-label="Informations">
          <p className="site-pied-titre">Informations</p>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/a-propos">À propos</Link>
        </nav>
      </div>
      <p className="site-pied-mentions">Speedfood, Conakry. Le règlement se fait directement avec le restaurant.</p>
    </footer>
  );
}
