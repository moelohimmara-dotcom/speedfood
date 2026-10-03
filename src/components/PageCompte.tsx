import type { ReactNode } from "react";

/**
 * Cadre des pages de compte (connexion, inscription, récupération). Sur téléphone : titre puis carte.
 * Sur ordinateur : un panneau de réassurance à gauche (si fourni) et la carte à droite, au lieu d'une
 * petite carte perdue au milieu d'un grand vide.
 */
export function PageCompte({
  titre,
  sousTitre,
  panneau,
  children,
  pied,
}: {
  titre: string;
  sousTitre?: string;
  /** Points rassurants affichés à gauche sur grand écran (masqués sur téléphone). */
  panneau?: { titre: string; points: string[] };
  children: ReactNode;
  pied?: ReactNode;
}) {
  return (
    <main className={`page-compte${panneau ? " page-compte-avec-panneau" : ""}`}>
      {panneau ? (
        <aside className="page-compte-panneau" aria-label="À propos de l'espace restaurateur">
          <p className="page-compte-panneau-titre">{panneau.titre}</p>
          <ul>
            {panneau.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </aside>
      ) : null}
      <div className="page-compte-colonne">
        <h1 className="page-compte-titre">{titre}</h1>
        {sousTitre ? <p className="page-compte-sous">{sousTitre}</p> : null}
        {children}
        {pied ? <div className="page-compte-pied">{pied}</div> : null}
      </div>
    </main>
  );
}
