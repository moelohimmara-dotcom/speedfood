import Link from "next/link";
import { lireTextes } from "@/lib/cms/textes";
import { lireAccueil } from "@/lib/site/accueil";
import { FLECHE } from "./commun";

/** Quartiers : un lien par quartier qui a au moins un restaurant publié, avec son décompte. Rien s'il n'y en a aucun. */
export async function AccueilQuartiers() {
  const [{ quartiers }, t] = await Promise.all([lireAccueil(), lireTextes()]);
  if (quartiers.length === 0) return null;
  return (
    <div className="pub-bloc">
      <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-quartiers">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">{t["accueil.quartiers.kicker"]}</p>
          <h2 id="accueil-quartiers" className="pub-titre pub-h2">
            {t["accueil.quartiers.titre"]}
          </h2>
        </div>
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
                  {FLECHE}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
