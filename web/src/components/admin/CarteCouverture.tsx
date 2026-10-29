import type { PointCarte } from "@/lib/system-admin/couverture";

/**
 * Carte de la couverture : un point par commune, placé d'après son point central (projection simple, échelle égale en largeur et en
 * hauteur). Pas de fond de carte : la position relative des communes suffit à voir où Speedfood est présent, où l'on attend, où l'on
 * annonce. Le tableau « Couverture par région » ci-dessous donne les mêmes informations en texte.
 */
const LON_MIN = -15.2;
const LON_MAX = -7.5;
const LAT_MIN = 7.1;
const LAT_MAX = 12.7;
const LARGEUR = 720;
const COS = Math.cos((((LAT_MIN + LAT_MAX) / 2) * Math.PI) / 180);
const ECHELLE = LARGEUR / ((LON_MAX - LON_MIN) * COS);
const HAUTEUR = Math.round((LAT_MAX - LAT_MIN) * ECHELLE);

function position(p: PointCarte): { x: number; y: number } {
  return { x: (p.longitude - LON_MIN) * COS * ECHELLE, y: (LAT_MAX - p.latitude) * ECHELLE };
}

type Etat = "restaurant" | "attente" | "annonce" | "aucun";
function etatDe(p: PointCarte): Etat {
  if (p.restaurants > 0) return "restaurant";
  if (p.attente > 0) return "attente";
  if (p.annonce) return "annonce";
  return "aucun";
}

function titre(p: PointCarte): string {
  const morceaux = [`${p.nom}${p.prefecture ? ` (${p.prefecture})` : ""}`];
  morceaux.push(p.restaurants > 0 ? `${p.restaurants} restaurant${p.restaurants > 1 ? "s" : ""}` : "aucun restaurant");
  if (p.attente > 0) morceaux.push(`${p.attente} en attente`);
  if (p.annonce) morceaux.push(p.annonce === "pilote" ? "pilote annoncé" : "bientôt annoncé");
  return morceaux.join(" · ");
}

export function CarteCouverture({ points }: { points: PointCarte[] }) {
  const compte = (e: Etat) => points.filter((p) => etatDe(p) === e).length;
  // Les points « sans rien » d'abord : ceux qui comptent restent dessinés par-dessus.
  const ordre: Etat[] = ["aucun", "annonce", "attente", "restaurant"];
  const tries = [...points].sort((a, b) => ordre.indexOf(etatDe(a)) - ordre.indexOf(etatDe(b)));

  if (points.length === 0) return <p className="ad-aide-champ">Aucune commune n&apos;a encore de point central : ajoutez-en depuis la page Géographie.</p>;

  return (
    <figure className="carte-couverture">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        role="img"
        aria-label={`Carte de la Guinée : ${compte("restaurant")} communes avec restaurants, ${compte("attente")} avec des personnes en attente, ${compte("annonce")} annoncées, ${compte("aucun")} sans rien`}
      >
        <rect x="0.5" y="0.5" width={LARGEUR - 1} height={HAUTEUR - 1} className="carte-couverture-cadre" />
        {[8, 9, 10, 11, 12].map((lat) => (
          <line key={lat} x1="0" x2={LARGEUR} y1={(LAT_MAX - lat) * ECHELLE} y2={(LAT_MAX - lat) * ECHELLE} className="carte-couverture-grille" />
        ))}
        {[-15, -14, -13, -12, -11, -10, -9, -8].map((lon) => (
          <line key={lon} y1="0" y2={HAUTEUR} x1={(lon - LON_MIN) * COS * ECHELLE} x2={(lon - LON_MIN) * COS * ECHELLE} className="carte-couverture-grille" />
        ))}
        {tries.map((p) => {
          const { x, y } = position(p);
          const etat = etatDe(p);
          return (
            <circle key={`${p.nom}-${p.latitude}-${p.longitude}`} cx={x} cy={y} r={etat === "aucun" ? 3.5 : 8} className={`carte-couverture-point carte-couverture-${etat}`}>
              <title>{titre(p)}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption>
        <ul className="carte-couverture-legende">
          <li>
            <span className="carte-couverture-pastille carte-couverture-restaurant" aria-hidden="true" /> Avec restaurants ({compte("restaurant")})
          </li>
          <li>
            <span className="carte-couverture-pastille carte-couverture-attente" aria-hidden="true" /> Des personnes attendent ({compte("attente")})
          </li>
          <li>
            <span className="carte-couverture-pastille carte-couverture-annonce" aria-hidden="true" /> Annoncée « Bientôt » ou « Pilote » ({compte("annonce")})
          </li>
          <li>
            <span className="carte-couverture-pastille carte-couverture-aucun" aria-hidden="true" /> Rien pour l&apos;instant ({compte("aucun")})
          </li>
        </ul>
        <p className="ad-aide-champ">Chaque point est une commune, placée à son point central. Conakry regroupe dix communes très proches. Survolez un point pour le détail.</p>
      </figcaption>
    </figure>
  );
}
