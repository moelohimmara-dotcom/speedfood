import { Pastille } from "@/components/admin/blocs";
import { LIBELLES_PROBLEME, type ProblemeQualite, type TypeProbleme } from "@/lib/system-admin/geographie-outils";
import { LienElement } from "./LienElement";

/** Au-delà, la liste d'un groupe se replie derrière « Afficher les N autres » : jamais un mur de lignes. */
const VISIBLES = 12;

const GROUPES: { type: TypeProbleme; titre: string; consigne: string; ton: "danger" | "attention"; ouvert: boolean }[] = [
  { type: "doublon", titre: "Noms en double", consigne: "Deux lieux se disputent la recherche : fusionnez-les (volet « Fusionner deux quartiers ») ou renommez-en un.", ton: "danger", ouvert: true },
  { type: "alias_ambigu", titre: "Noms alternatifs ambigus", consigne: "Un nom alternatif est aussi le nom d'un autre lieu : la personne peut être envoyée au mauvais endroit.", ton: "danger", ouvert: true },
  {
    type: "sans_point",
    titre: "Points centraux à compléter",
    consigne:
      "Ce n'est pas bloquant : la localisation les trouve par leur nom ou par leur commune, mais pas par proximité. Complétez-les à votre rythme, en lot avec l'export CSV ou un par un avec « Suggérer un point ».",
    ton: "attention",
    ouvert: false,
  },
];

function Element({ p }: { p: ProblemeQualite }) {
  return (
    // Pastille courte (nom + niveau) ; seul le détail propre à la ligne (nom alternatif ambigu) s'écrit, sur sa propre ligne.
    <li className={p.type === "alias_ambigu" ? "est-ligne" : undefined}>
      <LienElement cibleId={p.id}>
        {p.nom} <span className="geo-probleme-niveau">({p.niveau === "commune" ? "commune" : "quartier"})</span>
      </LienElement>
      {p.type === "alias_ambigu" ? <span className="geo-probleme-detail">{p.detail}</span> : null}
    </li>
  );
}

/**
 * Qualité des données, regroupée par nature de problème : ce qui est à corriger (doublons, ambiguïtés) s'affiche d'emblée, ce qui est à
 * compléter (points centraux manquants, souvent des dizaines d'un coup) reste replié avec son compte. La consigne est écrite une fois
 * par groupe, jamais répétée sur chaque ligne.
 */
export function PanneauQualite({ problemes, nomRegion, lienExport }: { problemes: ProblemeQualite[]; nomRegion: string; lienExport: string }) {
  if (problemes.length === 0) {
    return <p className="geo-ok">Rien à corriger dans la région de {nomRegion} : tous les lieux actifs ont un point central, aucun nom en double.</p>;
  }
  return (
    <div className="geo-qualite">
      {GROUPES.map((g) => {
        const liste = problemes.filter((p) => p.type === g.type);
        if (liste.length === 0) return null;
        const debut = liste.slice(0, VISIBLES);
        const reste = liste.slice(VISIBLES);
        return (
          <details key={g.type} className="geo-qualite-groupe" open={g.ouvert}>
            <summary>
              <Pastille ton={g.ton}>{liste.length}</Pastille>
              <span className="geo-qualite-titre">{g.titre}</span>
              <span className="sr-only"> ({LIBELLES_PROBLEME[g.type]})</span>
            </summary>
            <div className="geo-qualite-corps">
              <p className="geo-details-aide">{g.consigne}</p>
              <ul className="geo-qualite-liste">
                {debut.map((p) => (
                  <Element key={`${p.id}-${p.detail}`} p={p} />
                ))}
              </ul>
              {reste.length > 0 ? (
                <details className="geo-qualite-suite">
                  <summary>Afficher les {reste.length} autres</summary>
                  <ul className="geo-qualite-liste">
                    {reste.map((p) => (
                      <Element key={`${p.id}-${p.detail}`} p={p} />
                    ))}
                  </ul>
                </details>
              ) : null}
              {g.type === "sans_point" ? (
                <p>
                  <a href={lienExport} className="btn btn-secondary" download>
                    Exporter la région pour compléter les points (CSV)
                  </a>
                </p>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
