import Link from "next/link";
import type { Metadata } from "next";
import { lireAccueil } from "@/lib/site/accueil";
import { origineDuSite } from "@/lib/partage/origine";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Restaurants par quartier à Conakry",
    description: "Trouvez les restaurants Speedfood de votre quartier de Conakry : Kaloum, Dixinn, Ratoma, Matam.",
    alternates: { canonical: `${origine}/quartiers` },
  };
}

export default async function QuartiersPage() {
  const { quartiers, erreur } = await lireAccueil();
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Où nous trouver</p>
        <h1 className="pub-titre pub-h1-page">
          Votre <span className="pub-surligne">quartier</span> d&apos;abord
        </h1>
        <p className="pub-accueil-lead">Les restaurants publiés, classés par quartier de Conakry. D&apos;autres quartiers s&apos;ajoutent avec les restaurants qui s&apos;inscrivent.</p>
      </div>

      {erreur ? (
        <p className="pub-vide">Impossible de charger les quartiers pour le moment. Réessayez dans un instant.</p>
      ) : quartiers.length === 0 ? (
        <p className="pub-vide">Aucun restaurant n&apos;est encore publié. Revenez bientôt.</p>
      ) : (
        <ul className="pub-quartiers">
          {quartiers.map((q, i) => (
            <li key={q.slug} className={`pub-quartier pub-quartier-${i % 3}`}>
              <Link href={`/quartiers/${q.slug}`}>
                <span className="pub-quartier-nom">{q.nom}</span>
                <span className="pub-quartier-compte">
                  {q.restaurants} restaurant{q.restaurants > 1 ? "s" : ""}
                  {q.ouverts > 0 ? `, ${q.ouverts} ouvert${q.ouverts > 1 ? "s" : ""}` : ""}
                </span>
                <span className="pub-quartier-fleche" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
