import Link from "next/link";
import { SelecteurRole } from "./SelecteurRole";

/**
 * Page d'accueil marketing — fusionnée depuis Jarvis/speedfood/landing (voir
 * docs/DEPLOIEMENT-CLOUDFLARE.md pour l'historique de cette fusion). Le vrai
 * catalogue connecté à Supabase (ex-page d'accueil, bloc 5) vit maintenant à
 * /restaurants. Contrairement à l'original, aucun contenu ici ne prétend
 * enregistrer une inscription qui ne serait pas réellement traitée : chaque
 * bouton mène à une action réelle (/inscription, /restaurants).
 */
export default function AccueilPage() {
  return (
    <>
      <div id="bandeau-prelancement" role="status">
        Speedfood n&apos;est pas encore lancé publiquement à Conakry — projet en phase pilote
      </div>

      <header className="topbar">
        <div className="topbar-inner">
          <a href="#haut" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M4 11c0-3.87 3.13-7 7-7h2c3.87 0 7 3.13 7 7v0c0 .55-.45 1-1 1H5c-.55 0-1-.45-1-1v0Z" />
                <path d="M4 15h16M9 19h6" />
              </svg>
            </span>
            <span className="brand-name">Speedfood</span>
          </a>
          <nav className="topnav">
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#restaurateurs">Restaurateurs</a>
            <a href="#rejoindre">Rejoindre</a>
          </nav>
          <Link href="/restaurants" className="btn btn-secondary btn-nav-cta">
            Voir les restaurants
          </Link>
        </div>
      </header>

      <main id="haut">
        <section className="hero">
          <div className="hero-inner">
            <span className="eyebrow">Bientôt à Conakry</span>
            <h1>
              Vos restaurants préférés,
              <br />à portée de main.
            </h1>
            <p className="hero-sub">
              Commandez directement auprès des restaurants de Conakry, sans compte ni
              application à installer. Si le restaurant doit changer un prix ou des frais,
              vous donnez votre accord avant que la commande parte en préparation.
            </p>
            <div className="hero-actions">
              <Link href="#rejoindre" className="btn btn-primary btn-lg">
                Je veux être prévenu·e du lancement
              </Link>
              <Link href="/restaurants" className="btn btn-secondary btn-lg">
                Voir les restaurants déjà en ligne
              </Link>
            </div>
            <ul className="check-list hero-check-list">
              <li>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Aucun compte ni application à installer pour commander
              </li>
              <li>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Le restaurant garde la main sur ses prix, ses horaires et sa livraison
              </li>
              <li>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Tout changement de montant vous est soumis avant préparation, jamais imposé
              </li>
            </ul>
            <div className="hero-trust">
              <span aria-hidden="true">
                <svg className="icon" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8v.01" />
                </svg>
              </span>
              <span>
                Projet en phase de validation terrain à Conakry, vos retours façonnent le
                produit final.
              </span>
            </div>
          </div>
          <div className="hero-visual-wrap">
            <span className="badge badge-neutre hero-visual-tag">Aperçu — restaurants d&apos;exemple</span>
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-card card-a">
                <span className="hero-card-icon">
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M4 12h16c0 4.42-3.58 8-8 8s-8-3.58-8-8Z" />
                    <path d="M12 12V5M9 7l1.5-2M15 7l-1.5-2" />
                  </svg>
                </span>
                <strong>Chez Mama Kadiatou</strong>
                <span className="meta-line">Riz &amp; sauces · Kaloum</span>
              </div>
              <div className="hero-card card-b">
                <span className="hero-card-icon">
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M12 3c1.5 2 2 3.5 1 5-.7 1-1 1.8-1 2.5A2.5 2.5 0 0 0 14.5 13c1.4 0 2.2-.9 2.5-1.8.8 1.2 1 2.6.6 4A5.5 5.5 0 0 1 6.6 14c-.5-2 .2-3.4 1.2-4.6C9.2 7.7 9 5.3 12 3Z" />
                  </svg>
                </span>
                <strong>Grill Dixinn</strong>
                <span className="meta-line">Grillades · Dixinn</span>
              </div>
              <div className="hero-card card-c">
                <span className="hero-card-icon">
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
                    <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
                    <path d="M8 4c0 1-1 1-1 2M12 4c0 1-1 1-1 2" />
                  </svg>
                </span>
                <strong>Café Matam</strong>
                <span className="meta-line">Petit-déjeuner · Matam</span>
              </div>
            </div>
          </div>
        </section>

        <section className="strip">
          <p className="strip-label">
            Restaurants pilotes envisagés à Conakry <span>(exemples, à confirmer)</span>
          </p>
          <ul className="strip-row">
            <li>
              <span className="strip-icon" style={{ background: "var(--couleur-riz)" }}>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M4 12h16c0 4.42-3.58 8-8 8s-8-3.58-8-8Z" />
                  <path d="M12 12V5M9 7l1.5-2M15 7l-1.5-2" />
                </svg>
              </span>
              Chez Mama Kadiatou
            </li>
            <li>
              <span className="strip-icon" style={{ background: "var(--couleur-grill)" }}>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M12 3c1.5 2 2 3.5 1 5-.7 1-1 1.8-1 2.5A2.5 2.5 0 0 0 14.5 13c1.4 0 2.2-.9 2.5-1.8.8 1.2 1 2.6.6 4A5.5 5.5 0 0 1 6.6 14c-.5-2 .2-3.4 1.2-4.6C9.2 7.7 9 5.3 12 3Z" />
                </svg>
              </span>
              Grill Dixinn
            </li>
            <li>
              <span className="strip-icon" style={{ background: "var(--couleur-fast)" }}>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M4 10a8 8 0 0 1 16 0Z" />
                  <path d="M3.5 10h17M4 14h16M5 18h14" />
                </svg>
              </span>
              Speedy Snack
            </li>
            <li>
              <span className="strip-icon" style={{ background: "var(--couleur-cafe)" }}>
                <svg className="icon" viewBox="0 0 24 24">
                  <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
                  <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
                  <path d="M8 4c0 1-1 1-1 2M12 4c0 1-1 1-1 2" />
                </svg>
              </span>
              Café Matam
            </li>
          </ul>
        </section>

        <section id="comment-ca-marche" className="section">
          <h2>Comment ça marche</h2>
          <p className="section-sub">
            Sans compte ni application à installer — juste un navigateur, sur téléphone ou
            ordinateur.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Découvrez</h3>
              <p>
                Parcourez les restaurants ouverts près de chez vous, filtrez par quartier ou par
                type de plat.
              </p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Commandez</h3>
              <p>
                Choisissez vos plats, indiquez retrait ou livraison, envoyez votre demande en
                quelques secondes.
              </p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Vous validez</h3>
              <p>
                Le restaurant confirme votre commande. S&apos;il doit changer un prix, des frais
                ou un délai, il vous propose la nouvelle version et rien n&apos;est préparé sans
                votre accord.
              </p>
            </div>
          </div>
        </section>

        <section id="restaurateurs" className="section section-alt">
          <div className="two-col">
            <div>
              <span className="eyebrow">Pour les restaurateurs</span>
              <h2>Gérez vos commandes sans effort technique.</h2>
              <ul className="check-list">
                <li>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Une console simple pensée pour un téléphone, pas un ordinateur
                </li>
                <li>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Vous gardez la main sur vos prix, vos horaires et vos plats disponibles
                </li>
                <li>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Gratuit pendant la phase pilote
                </li>
                <li>
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Vous acceptez ou refusez chaque commande, rien n&apos;est automatique
                </li>
              </ul>
              <Link href="/inscription" className="btn btn-primary">
                Inscrire mon restaurant
              </Link>
            </div>
            <div className="mockup-card" aria-hidden="true">
              <div className="mockup-header">Espace restaurant</div>
              <div className="mockup-row">
                <span>SF-4KVB9 · Malika T.</span>
                <span className="badge badge-demo">En attente</span>
              </div>
              <div className="mockup-row">
                <span>1 × Riz gras au poisson</span>
              </div>
              <div className="mockup-actions">
                <span className="btn btn-primary btn-sm">Accepter</span>
                <span className="btn btn-danger btn-sm">Refuser</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Le lancement démarre à Conakry</h2>
          <p className="section-sub">
            Le pilote se concentre d&apos;abord sur un petit groupe de quartiers pour bien faire
            les choses avant d&apos;aller plus loin.
          </p>
          <div className="chip-row centered">
            <span className="chip static">Kaloum</span>
            <span className="chip static">Dixinn</span>
            <span className="chip static">Ratoma</span>
            <span className="chip static">Matam</span>
          </div>
        </section>

        <section id="rejoindre" className="section section-cta">
          <div className="cta-box">
            <h2>Rejoindre Speedfood</h2>
            <p className="section-sub">Choisissez ce qui vous correspond.</p>
            <SelecteurRole />
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Speedfood — projet en phase de validation à Conakry.</p>
        <p>
          <Link href="/restaurants">Voir les restaurants déjà en ligne</Link>
          {" · "}
          <Link href="/confidentialite">Confidentialité</Link>
        </p>
      </footer>
    </>
  );
}
