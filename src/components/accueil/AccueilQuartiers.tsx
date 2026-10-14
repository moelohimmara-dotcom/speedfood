import Link from "next/link";
import { lireTextes } from "@/lib/cms/textes";
import { lireAccueil } from "@/lib/site/accueil";
import { lienZone, lireZones, type ZoneChoisie } from "@/lib/site/zones";
import { FLECHE } from "./commun";

/** Nombre de quartiers montrés en tuiles : un aperçu, le répertoire complet vit sur /quartiers. */
const QUARTIERS_APERCU = 4;

function Epingle() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

/**
 * Explorer les localités : les communes enregistrées en puces (on peut chercher ailleurs que là où l'on est), puis quelques
 * quartiers en tuiles — ceux de la zone choisie, sinon les plus fournis — et l'accès au répertoire complet. Seuls les niveaux
 * réellement enregistrés (commune, quartier) sont proposés. Rien s'il n'y a aucune zone.
 */
export async function AccueilQuartiers({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [{ quartiers }, zones, t] = await Promise.all([lireAccueil(), lireZones(), lireTextes()]);
  if (zones.length === 0 && quartiers.length === 0) return null;

  const communeCible = zone ? (zone.niveau === "commune" ? zone.nom : zone.communeNom) : "";
  const base = communeCible ? quartiers.filter((q) => q.communeNom === communeCible) : quartiers;
  const apercu = base.slice(0, QUARTIERS_APERCU);
  const communesAvecQuartiers = new Set(quartiers.map((q) => q.communeNom).filter(Boolean)).size;

  return (
    <div className="pub-bloc">
      <section id="localites" className="pub-conteneur pub-rubrique" aria-labelledby="accueil-quartiers">
        <div className="pub-entete-rubrique">
          <p className="pub-kicker">{t["accueil.quartiers.kicker"]}</p>
          <h2 id="accueil-quartiers" className="pub-titre pub-h2">
            {t["accueil.quartiers.titre"]}
          </h2>
          <p className="apercu-quartiers-lead">{t["accueil.quartiers.texte"]}</p>
        </div>

        {zones.length > 0 ? (
          <nav className="pub-communes-index" aria-label="Communes">
            {zones.map((c) => (
              <Link
                key={c.slug}
                href={lienZone({ niveau: "commune", slug: c.slug })}
                className={`pub-communes-puce${c.restaurants === 0 ? " est-vide" : ""}`}
                aria-current={zone?.niveau === "commune" && zone.slug === c.slug ? "true" : undefined}
                title={c.restaurants === 0 ? "Pas encore de restaurant référencé" : undefined}
              >
                {c.nom}
                {c.restaurants > 0 ? <span className="pub-communes-nb">{c.restaurants}</span> : null}
              </Link>
            ))}
          </nav>
        ) : null}

        {apercu.length > 0 ? (
          <ul className="apercu-quartiers">
            {apercu.map((q, i) => (
              <li key={`${q.communeNom}-${q.slug}`} className={`apercu-quartiers-item apercu-ton-${i % 3}`}>
                <Link href={`/quartiers/${q.slug}`} className="apercu-tuile">
                  <span className="apercu-rang" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="apercu-epingle" aria-hidden="true">
                    <Epingle />
                  </span>
                  <span className="apercu-nom">{q.nom}</span>
                  {q.communeNom ? <span className="apercu-commune">{q.communeNom}</span> : null}
                  <span className="apercu-meta">
                    <span>
                      {q.restaurants} restaurant{q.restaurants > 1 ? "s" : ""}
                    </span>
                    {q.ouverts > 0 ? (
                      <span className="apercu-ouvert">
                        <span className="apercu-point" aria-hidden="true" />
                        {q.ouverts} ouvert{q.ouverts > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="apercu-fleche" aria-hidden="true">
                    {FLECHE}
                  </span>
                </Link>
              </li>
            ))}
            <li className="apercu-quartiers-item apercu-quartiers-tout">
              <Link href="/quartiers" className="apercu-tuile apercu-tuile-tout">
                <span className="apercu-tout-texte">
                  <span className="apercu-tout-titre">Toutes les localités</span>
                  <span className="apercu-tout-detail">
                    {quartiers.length} quartier{quartiers.length > 1 ? "s" : ""} avec restaurants
                    {communesAvecQuartiers > 0 ? ` · ${communesAvecQuartiers} commune${communesAvecQuartiers > 1 ? "s" : ""}` : ""}
                  </span>
                </span>
                <span className="apercu-fleche apercu-fleche-tout" aria-hidden="true">
                  {FLECHE}
                </span>
              </Link>
            </li>
          </ul>
        ) : null}
      </section>
    </div>
  );
}
