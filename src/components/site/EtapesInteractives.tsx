"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface EtapeAffichee {
  titre: string;
  texte: string;
  detail: string;
  visuel: ReactNode;
}

const DUREE_MS = 6000;

/**
 * Quatre étapes cliquables. Les étapes défilent seules (barre de progression) sauf si la personne a choisi une étape ou réduit les
 * animations : on ne la prive jamais du contrôle. Sans JavaScript, la première étape et la liste complète (rendu serveur) restent lisibles.
 */
export function EtapesInteractives({ etapes }: { etapes: EtapeAffichee[] }) {
  const [actuelle, setActuelle] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActuelle((i) => (i + 1) % etapes.length), DUREE_MS);
    return () => clearTimeout(t);
  }, [actuelle, auto, etapes.length]);

  const e = etapes[actuelle];

  return (
    <div className="pub-etapes-inter">
      <div className="pub-etapes-onglets" role="tablist" aria-label="Les quatre étapes">
        {etapes.map((x, i) => (
          <button
            key={x.titre}
            type="button"
            role="tab"
            id={`etape-onglet-${i}`}
            aria-selected={i === actuelle}
            aria-controls="etape-panneau"
            className="pub-etape-onglet"
            onClick={() => {
              setAuto(false);
              setActuelle(i);
            }}
          >
            <span className="pub-etape-onglet-num">{i + 1}</span>
            <span>
              <strong>{x.titre}</strong>
              <span className="pub-etape-onglet-texte">{x.texte}</span>
            </span>
            {i === actuelle && auto ? <i className="pub-etape-progres" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div id="etape-panneau" role="tabpanel" aria-labelledby={`etape-onglet-${actuelle}`} className="pub-etape-panneau" aria-live="polite">
        <span className="pub-etape-grand">{e.visuel}</span>
        <p className="pub-kicker">Étape {String(actuelle + 1).padStart(2, "0")}</p>
        <h2 className="pub-titre">{e.titre}</h2>
        <p>{e.detail}</p>
      </div>
    </div>
  );
}
