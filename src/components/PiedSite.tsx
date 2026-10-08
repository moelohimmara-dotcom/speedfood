import Link from "next/link";
import { BoutonAnimations } from "@/components/site/PilotageAnimations";
import { lirePagesPublieesPourNavigation } from "@/lib/cms/lecture";

/**
 * Pied de page du site client : trois blocs (Speedfood, Clients, Restaurateurs) puis une ligne de mentions.
 * Aucune promesse commerciale : seulement des liens vers des pages qui existent.
 *
 * La colonne « Informations » liste aussi les pages publiées du CMS (Studio) : c'est ce qui leur donne
 * une entrée publique — sans ce lien, une page créée depuis l'administration restait invisible,
 * aucune navigation du site ne pointant vers `/p/…`. Lecture cachée 60 s (cms/lecture.ts), jamais
 * bloquante : en cas d'erreur de base, la colonne se réduit aux deux liens codés en dur.
 */
export async function PiedSite() {
  const pagesPubliees = await lirePagesPublieesPourNavigation();
  return (
    <footer className="site-pied">
      <div className="pub-motif" aria-hidden="true" />
      <div className="site-pied-interieur">
        <div className="site-pied-colonne site-pied-marque">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo local déjà optimisé. */}
          <img src="/icons/icon-192.png" alt="" width={56} height={56} className="site-pied-logo" />
          <p className="site-pied-titre">Speedfood</p>
          <p>
            Trouvez un plat, voyez depuis quand le restaurant l&apos;a confirmé et envoyez votre commande, sans compte,
            en réglant directement le restaurant. Phase pilote à Conakry.
          </p>
        </div>
        <nav className="site-pied-colonne" aria-label="Clients">
          <p className="site-pied-titre">Clients</p>
          <Link href="/restaurants">Restaurants</Link>
          <Link href="/comment-ca-marche">Comment ça marche</Link>
          <Link href="/quartiers">Quartiers</Link>
          <Link href="/panier">Mon panier</Link>
          <Link href="/aide">Aide et questions</Link>
        </nav>
        <nav className="site-pied-colonne" aria-label="Restaurateurs">
          <p className="site-pied-titre">Restaurateurs</p>
          <Link href="/devenir-partenaire">Devenir partenaire</Link>
          <Link href="/inscription">Inscrire mon restaurant</Link>
          <Link href="/connexion">Se connecter</Link>
        </nav>
        <nav className="site-pied-colonne" aria-label="Informations">
          <p className="site-pied-titre">Informations</p>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/a-propos">À propos</Link>
          {pagesPubliees.map((p) => (
            <Link key={p.slug} href={`/p/${p.slug}`}>
              {p.titre}
            </Link>
          ))}
        </nav>
      </div>
      <p className="site-pied-mentions">Speedfood, Conakry. Le règlement se fait directement avec le restaurant.</p>
      <p className="site-pied-animations">
        <BoutonAnimations />
      </p>
    </footer>
  );
}
