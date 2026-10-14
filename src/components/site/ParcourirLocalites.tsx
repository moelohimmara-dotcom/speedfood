import Link from "next/link";
import { lienZone, type ZoneRegion } from "@/lib/site/zones";

function pluriel(n: number, singulier: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : singulier}`;
}

/** « 3 restaurants », « 1 restaurant » ou « pas encore de restaurant » : un vrai décompte, jamais une estimation. */
function bilan(restaurants: number): string {
  return restaurants > 0 ? pluriel(restaurants, "restaurant", "restaurants") : "pas encore de restaurant";
}

/**
 * Toute la Guinée, du plus large au plus précis : régions, préfectures, puis communes (ou sous-préfectures). Chaque ligne ouvre
 * l'accueil sur cette zone. Éléments `<details>` natifs : clavier, lecteurs d'écran et lecture sans JavaScript. Les zones qui
 * comptent des restaurants s'ouvrent d'emblée ; les autres restent repliées mais atteignables (liste d'attente).
 */
export function ParcourirLocalites({ hierarchie }: { hierarchie: ZoneRegion[] }) {
  return (
    <section className="localites" aria-labelledby="localites-titre">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Toute la Guinée</p>
        <h2 id="localites-titre" className="pub-titre pub-h2">
          Régions, préfectures et communes
        </h2>
        <p className="pub-accueil-lead">
          Choisissez une zone pour voir ses restaurants. Là où aucun restaurant n&apos;est encore référencé, vous pouvez demander à être prévenu à
          l&apos;ouverture du premier.
        </p>
      </div>
      <div className="localites-liste">
        {hierarchie.map((region) => (
          <details key={region.id} className="localites-region" open={region.restaurants > 0}>
            <summary>
              <span className="localites-nom">{region.nom}</span>
              <span className="localites-bilan">
                {pluriel(region.prefectures.length, "préfecture", "préfectures")} · {bilan(region.restaurants)}
              </span>
            </summary>
            <p className="localites-acces">
              <Link href={lienZone({ niveau: "region", slug: region.slug })} className="lien-texte">
                Voir la région de {region.nom}
              </Link>
            </p>
            {region.prefectures.map((pref) => (
              <details key={pref.id} className="localites-prefecture" open={pref.restaurants > 0}>
                <summary>
                  <span className="localites-nom">{pref.nom}</span>
                  <span className="localites-bilan">
                    {pluriel(pref.communes.length, "commune", "communes")} · {bilan(pref.restaurants)}
                  </span>
                </summary>
                <p className="localites-acces">
                  <Link href={lienZone({ niveau: "prefecture", slug: pref.slug })} className="lien-texte">
                    Voir la préfecture de {pref.nom}
                  </Link>
                </p>
                <ul className="localites-communes">
                  {pref.communes.map((c) => (
                    <li key={c.id}>
                      <Link href={lienZone({ niveau: "commune", slug: c.slug })} className={`localites-commune${c.restaurants === 0 ? " est-vide" : ""}`}>
                        <span>{c.nom}</span>
                        <span className="localites-commune-bilan">{c.restaurants > 0 ? pluriel(c.restaurants, "restaurant", "restaurants") : "—"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}
