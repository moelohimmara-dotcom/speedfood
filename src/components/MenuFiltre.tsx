"use client";

import { useState, type ReactNode } from "react";

export interface PlatDuMenu {
  id: string;
  nom: string;
  /** Prix réellement demandé (promo comprise) : sert uniquement au tri. */
  prix: number;
  /** Vignette déjà rendue côté serveur. */
  noeud: ReactNode;
}

export interface GroupeDuMenu {
  id: string;
  nom: string;
  plats: PlatDuMenu[];
}

type Tri = "menu" | "prix-asc" | "prix-desc";

/**
 * En-tête et filtres du menu : « À la carte », titre, tri par prix, pastilles de sections. Les vignettes arrivent déjà
 * rendues par le serveur (avec leur bouton d'ajout) ; ce composant ne fait que choisir ce qu'il montre et dans quel ordre.
 * Sans JavaScript, tout le menu reste affiché dans l'ordre du restaurateur.
 */
export function MenuFiltre({ groupes, niveauSection }: { groupes: GroupeDuMenu[]; niveauSection: boolean }) {
  const [actif, setActif] = useState<string>("tout");
  const [tri, setTri] = useState<Tri>("menu");
  const nombrePlats = groupes.reduce((n, g) => n + g.plats.length, 0);

  const visibles = groupes.filter((g) => actif === "tout" || g.id === actif);
  const ordonner = (plats: PlatDuMenu[]) => {
    if (tri === "menu") return plats;
    return [...plats].sort((a, b) => (tri === "prix-asc" ? a.prix - b.prix : b.prix - a.prix) || a.nom.localeCompare(b.nom, "fr"));
  };

  return (
    <div className="fm">
      <header className="fm-entete">
        <div>
          <p className="fm-surtitre">À la carte</p>
          <h2 className="fm-titre">Le menu</h2>
        </div>
        {nombrePlats > 3 ? (
          <label className="fm-tri">
            <span>Trier par</span>
            <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
              <option value="menu">Ordre du menu</option>
              <option value="prix-asc">Prix croissant</option>
              <option value="prix-desc">Prix décroissant</option>
            </select>
          </label>
        ) : null}
      </header>

      {groupes.length > 1 ? (
        <div className="fm-chips" role="group" aria-label="Sections du menu">
          <button type="button" className="fm-chip" aria-pressed={actif === "tout"} onClick={() => setActif("tout")}>
            Tout le menu
          </button>
          {groupes.map((g) => (
            <button key={g.id} type="button" className="fm-chip" aria-pressed={actif === g.id} onClick={() => setActif(g.id)}>
              {g.nom}
            </button>
          ))}
        </div>
      ) : null}

      {visibles.map((g) => (
        <section key={g.id} id={`section-${g.id}`} className="fm-section">
          {niveauSection && g.nom ? <h3 className="fm-section-titre">{g.nom}</h3> : null}
          <div className="vignettes">
            {ordonner(g.plats).map((p) => (
              <div key={p.id} className="fm-plat">
                {p.noeud}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
