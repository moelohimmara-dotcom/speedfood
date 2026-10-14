import Link from "next/link";
import { VecteurQuartiers } from "@/components/site/vecteurs/VecteurQuartiers";
import type { Metadata } from "next";
import { ParcourirLocalites } from "@/components/site/ParcourirLocalites";
import { lireAccueil, grouperQuartiersParCommune } from "@/lib/site/accueil";
import { lireHierarchieZones } from "@/lib/site/zones";
import { slugQuartier } from "@/lib/site/quartiers";
import { origineDuSite } from "@/lib/partage/origine";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Localités : restaurants par région, préfecture, commune et quartier",
    description:
      "Explorez toute la Guinée : régions, préfectures, communes et quartiers où des restaurants Speedfood sont référencés. Phase pilote à Conakry.",
    alternates: { canonical: `${origine}/quartiers` },
  };
}

/** « 1 restaurant » / « 2 restaurants », avec le pluriel juste. */
function pluriel(nombre: number, singulier: string, plusieurs: string): string {
  return `${nombre} ${nombre > 1 ? plusieurs : singulier}`;
}

export default async function QuartiersPage() {
  const [{ quartiers, erreur }, hierarchie] = await Promise.all([lireAccueil(), lireHierarchieZones()]);
  const groupes = grouperQuartiersParCommune(quartiers);

  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-vecteur pub-entete-vecteur-quartiers">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">Explorer les localités</p>
          <h1 className="pub-titre pub-h1-page">
            Choisissez votre <span className="pub-surligne">localité</span>
          </h1>
          <p className="pub-accueil-lead">
            Toutes les régions, préfectures et communes de Guinée sont consultables. Phase pilote : les restaurants sont aujourd&apos;hui
            à Conakry, d&apos;autres localités s&apos;ajoutent avec les restaurants qui s&apos;inscrivent.
          </p>
        </div>
        <VecteurQuartiers />
      </div>

      {hierarchie.length > 0 ? <ParcourirLocalites hierarchie={hierarchie} /> : null}

      {erreur ? (
        <p className="pub-vide">Impossible de charger les quartiers pour le moment. Réessayez dans un instant.</p>
      ) : groupes.length === 0 ? (
        <p className="pub-vide">Aucun restaurant n&apos;est encore publié. Revenez bientôt.</p>
      ) : (
        <>
          {groupes.length > 3 ? (
            <nav className="pub-communes-index" aria-label="Aller à une commune">
              {groupes.map((groupe) => (
                <a key={groupe.communeNom} href={`#commune-${slugQuartier(groupe.communeNom)}`} className="pub-communes-puce">
                  {groupe.communeNom}
                </a>
              ))}
            </nav>
          ) : null}

          {groupes.map((groupe) => {
            const identifiant = `commune-${slugQuartier(groupe.communeNom)}`;
            return (
              <section key={groupe.communeNom} id={identifiant} className="pub-commune-bloc" aria-labelledby={`${identifiant}-titre`}>
                <header className="pub-commune-bloc-entete">
                  <p className="pub-kicker">Commune</p>
                  <h2 id={`${identifiant}-titre`} className="pub-titre pub-h3-page">
                    {groupe.communeNom}
                  </h2>
                  <p className="pub-commune-bloc-bilan">
                    {pluriel(groupe.quartiers.length, "quartier", "quartiers")} ·{" "}
                    {pluriel(groupe.restaurants, "restaurant", "restaurants")}
                    {groupe.ouverts > 0 ? ` · ${groupe.ouverts} ouvert${groupe.ouverts > 1 ? "s" : ""}` : ""}
                  </p>
                </header>
                <ul className="pub-quartiers">
                  {groupe.quartiers.map((q, i) => (
                    <li key={`${groupe.communeNom}-${q.slug}`} className={`pub-quartier pub-quartier-${i % 3}`}>
                      <Link href={`/quartiers/${q.slug}`}>
                        <span className="pub-quartier-nom">{q.nom}</span>
                        <span className="pub-quartier-compte">
                          {pluriel(q.restaurants, "restaurant", "restaurants")}
                          {q.ouverts > 0 ? `, ${q.ouverts} ouvert${q.ouverts > 1 ? "s" : ""}` : ""}
                        </span>
                        <span className="pub-quartier-fleche" aria-hidden="true">
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
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
