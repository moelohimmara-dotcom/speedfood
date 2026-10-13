import Link from "next/link";
import { VecteurQuartiers } from "@/components/site/vecteurs/VecteurQuartiers";
import type { Metadata } from "next";
import { lireAccueil, grouperQuartiersParCommune, type GroupeQuartiersCommune } from "@/lib/site/accueil";
import { origineDuSite } from "@/lib/partage/origine";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Restaurants par quartier à Conakry",
    description:
      "Trouvez les restaurants Speedfood de votre quartier de Conakry, classés par commune : Kaloum, Dixinn, Matam, Ratoma, Matoto et leurs quartiers.",
    alternates: { canonical: `${origine}/quartiers` },
  };
}

/** « 1 restaurant » / « 2 restaurants », avec le pluriel juste. */
function pluriel(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`;
}

function BilanCommune({ groupe }: { groupe: GroupeQuartiersCommune }) {
  return (
    <p className="pub-commune-bilan">
      {pluriel(groupe.quartiers.length, "quartier", "quartiers")} · {pluriel(groupe.restaurants, "restaurant", "restaurants")}
      {groupe.ouverts > 0 ? ` · ${groupe.ouverts} ouvert${groupe.ouverts > 1 ? "s" : ""}` : ""}
    </p>
  );
}

function FlecheLien() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default async function QuartiersPage() {
  const { quartiers, erreur } = await lireAccueil();
  const groupes = grouperQuartiersParCommune(quartiers);
  const totalRestaurants = quartiers.reduce((n, q) => n + q.restaurants, 0);
  const totalOuverts = quartiers.reduce((n, q) => n + q.ouverts, 0);

  return (
    <main className="pub-conteneur pub-rubrique pub-quartiers-page">
      <header className="pub-quartiers-entete">
        <div className="pub-quartiers-entete-texte">
          <p className="pub-kicker">Où nous trouver</p>
          <h1 className="pub-titre pub-h1-page">
            Votre <span className="pub-surligne">quartier</span> d&apos;abord
          </h1>
          <p className="pub-accueil-lead">
            Les restaurants publiés, classés par commune puis par quartier de Conakry.
          </p>
        </div>
        <div className="pub-quartiers-entete-vecteur">
          <VecteurQuartiers />
        </div>
      </header>

      {erreur ? (
        <p className="pub-vide" role="status">
          Impossible de charger les quartiers pour le moment. Réessayez dans un instant.
        </p>
      ) : groupes.length === 0 ? (
        <p className="pub-vide" role="status">
          Aucun restaurant n&apos;est encore publié. Revenez bientôt.
        </p>
      ) : (
        <>
          <p className="pub-quartiers-synthese" aria-label="Synthèse">
            {pluriel(groupes.length, "commune", "communes")} · {pluriel(quartiers.length, "quartier", "quartiers")} ·{" "}
            {pluriel(totalRestaurants, "restaurant", "restaurants")}
            {totalOuverts > 0 ? ` · ${totalOuverts} ouvert${totalOuverts > 1 ? "s" : ""} maintenant` : ""}
          </p>

          <div className="pub-communes">
            {groupes.map((groupe) => (
              <section key={groupe.communeNom} className="pub-commune" aria-labelledby={`commune-${groupe.communeNom}`}>
                <div className="pub-commune-entete">
                  <h2 id={`commune-${groupe.communeNom}`} className="pub-commune-titre">
                    {groupe.communeNom}
                  </h2>
                  <BilanCommune groupe={groupe} />
                </div>
                <ul className="pub-quartiers-grille">
                  {groupe.quartiers.map((q) => (
                    <li key={`${groupe.communeNom}-${q.slug}`}>
                      <Link href={`/quartiers/${q.slug}`} className="pub-quartier-carte">
                        <span className="pub-quartier-carte-nom">{q.nom}</span>
                        <span className="pub-quartier-carte-meta">
                          {pluriel(q.restaurants, "restaurant", "restaurants")}
                          {q.ouverts > 0 ? (
                            <span className="pub-quartier-carte-ouvert">{q.ouverts} ouvert{q.ouverts > 1 ? "s" : ""}</span>
                          ) : null}
                        </span>
                        <span className="pub-quartier-carte-fleche">
                          <FlecheLien />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
