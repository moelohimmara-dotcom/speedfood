"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { APERCU_RUBRIQUE, correspondRecherche, decisionMenu, platsMontres } from "@/lib/menu/affichage";

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
 * En-tête et filtres du menu : « À la carte », titre, tri par prix, recherche, pastilles de rubriques. Les vignettes arrivent déjà
 * rendues par le serveur (avec leur bouton d'ajout) ; ce composant ne fait que choisir ce qu'il montre et dans quel ordre.
 * Règles pour les longs menus (voir src/lib/menu/affichage.ts) : barre de rubriques défilante et collée dès 5 rubriques, recherche dès
 * 20 articles, rubrique de plus de 8 articles repliée (aperçu + « Voir les N autres ») quand tout le menu est affiché.
 * Sans JavaScript, tout le menu reste affiché dans l'ordre du restaurateur (rien n'est replié avant que la page soit active).
 */
export function MenuFiltre({ groupes, niveauSection }: { groupes: GroupeDuMenu[]; niveauSection: boolean }) {
  const [actif, setActif] = useState<string>("tout");
  const [tri, setTri] = useState<Tri>("menu");
  const [recherche, setRecherche] = useState("");
  const [etendues, setEtendues] = useState<string[]>([]);
  // Faux au rendu serveur et avant l'activation de la page (sans JavaScript, le menu reste entier), vrai ensuite.
  const pret = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const decision = decisionMenu(groupes.map((g) => ({ id: g.id, nom: g.nom, plats: g.plats.length })));
  const rechercheEnCours = recherche.trim().length > 0;

  const ordonner = (plats: PlatDuMenu[]) => {
    if (tri === "menu") return plats;
    return [...plats].sort((a, b) => (tri === "prix-asc" ? a.prix - b.prix : b.prix - a.prix) || a.nom.localeCompare(b.nom, "fr"));
  };

  const visibles = groupes
    .filter((g) => actif === "tout" || g.id === actif)
    .map((g) => ({ ...g, plats: g.plats.filter((p) => correspondRecherche(p.nom, recherche)) }))
    .filter((g) => g.plats.length > 0);
  const total = visibles.reduce((n, g) => n + g.plats.length, 0);

  return (
    <div className="fm">
      <header className="fm-entete">
        <div>
          <p className="fm-surtitre">À la carte</p>
          <h2 className="fm-titre">Le menu</h2>
        </div>
        {decision.nombrePlats > 3 ? (
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

      {decision.recherche ? (
        <label className="fm-recherche">
          <span className="sr-only">Chercher dans le menu</span>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un plat ou une boisson" autoComplete="off" />
        </label>
      ) : null}

      {decision.rubriques.length > 1 ? (
        <div className={`fm-chips${decision.barreRubriques ? " fm-chips-barre" : ""}`} role="group" aria-label="Sections du menu">
          <button type="button" className="fm-chip" aria-pressed={actif === "tout"} onClick={() => setActif("tout")}>
            Tout le menu
          </button>
          {decision.rubriques.map((r) => (
            <button key={r.id} type="button" className="fm-chip" aria-pressed={actif === r.id} onClick={() => setActif(r.id)}>
              {r.nom}
              {decision.barreRubriques ? <span className="fm-chip-n"> {r.plats}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {rechercheEnCours && total === 0 ? <p className="fm-aucun">Aucun article ne correspond à « {recherche.trim()} ».</p> : null}

      {visibles.map((g) => {
        const replie = pret && actif === "tout" && decision.repliees.includes(g.id) && !etendues.includes(g.id);
        const nb = platsMontres(g.plats.length, replie, rechercheEnCours);
        const liste = ordonner(g.plats);
        return (
          <section key={g.id} id={`section-${g.id}`} className="fm-section">
            {niveauSection && g.nom ? <h3 className="fm-section-titre">{g.nom}</h3> : null}
            <div className="vignettes">
              {liste.slice(0, nb).map((p, i) => (
                <div key={`${tri}-${p.id}`} className="fm-plat" style={{ ["--i" as string]: Math.min(i, 8) }}>
                  {p.noeud}
                </div>
              ))}
            </div>
            {nb < liste.length ? (
              <button type="button" className="fm-voir-plus" onClick={() => setEtendues((e) => [...e, g.id])}>
                Voir les {liste.length - APERCU_RUBRIQUE} autres
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
