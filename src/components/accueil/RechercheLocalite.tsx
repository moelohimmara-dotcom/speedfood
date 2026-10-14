"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface OptionLocalite {
  niveau: "commune" | "quartier";
  nom: string;
  slug: string;
  /** Commune d'un quartier ; vide pour une commune. */
  communeNom: string;
  restaurants: number;
}

const MAX_SUGGESTIONS = 8;

/** Compare sans tenir compte des accents ni de la casse (« kenien » trouve « Kénien »). */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function lien(o: OptionLocalite): string {
  const cle = o.niveau === "commune" ? "commune" : "quartier";
  return `/?${cle}=${encodeURIComponent(o.slug)}#zone`;
}

/**
 * Recherche d'une localité par saisie : la zone se choisit à la main, sans géolocalisation. Les suggestions viennent des
 * zones réellement enregistrées (communes et quartiers) ; une saisie sans correspondance le dit au lieu d'inventer une zone.
 */
export function RechercheLocalite({
  options,
  libelle,
  placeholder,
  boutonLibelle,
}: {
  options: OptionLocalite[];
  libelle: string;
  placeholder: string;
  boutonLibelle: string;
}) {
  const routeur = useRouter();
  const identifiant = useId();
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const [aucune, setAucune] = useState(false);

  const suggestions = useMemo(() => {
    const cherche = normaliser(saisie);
    if (!cherche) return options.filter((o) => o.niveau === "commune").slice(0, MAX_SUGGESTIONS);
    const correspond = options.filter((o) => normaliser(o.nom).includes(cherche) || normaliser(o.communeNom).includes(cherche));
    // Les communes d'abord, puis les quartiers qui commencent par la saisie, puis le reste.
    return correspond
      .sort((a, b) => {
        if (a.niveau !== b.niveau) return a.niveau === "commune" ? -1 : 1;
        const debutA = normaliser(a.nom).startsWith(cherche) ? 0 : 1;
        const debutB = normaliser(b.nom).startsWith(cherche) ? 0 : 1;
        return debutA - debutB || a.nom.localeCompare(b.nom, "fr");
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [saisie, options]);

  function aller(option: OptionLocalite | undefined) {
    if (!option) {
      setAucune(true);
      return;
    }
    setAucune(false);
    setOuvert(false);
    routeur.push(lien(option));
  }

  function surClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  }

  const idListe = `${identifiant}-liste`;

  return (
    <form
      className="recherche-localite"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        aller(ouvert ? suggestions[actif] : suggestions[0]);
      }}
    >
      <label htmlFor={`${identifiant}-champ`} className="recherche-localite-etiquette">
        {libelle}
      </label>
      <div className="recherche-localite-ligne">
        <div className="recherche-localite-champ">
          <input
            id={`${identifiant}-champ`}
            type="text"
            role="combobox"
            aria-expanded={ouvert}
            aria-controls={idListe}
            aria-activedescendant={ouvert && suggestions[actif] ? `${identifiant}-opt-${actif}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={saisie}
            placeholder={placeholder}
            onChange={(e) => {
              setSaisie(e.target.value);
              setOuvert(true);
              setActif(0);
              setAucune(false);
            }}
            onFocus={() => setOuvert(true)}
            onBlur={() => window.setTimeout(() => setOuvert(false), 120)}
            onKeyDown={surClavier}
          />
          {ouvert && suggestions.length > 0 ? (
            <ul id={idListe} role="listbox" className="recherche-localite-liste" aria-label={libelle}>
              {suggestions.map((o, i) => (
                <li
                  key={`${o.niveau}-${o.communeNom}-${o.slug}`}
                  id={`${identifiant}-opt-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  className={`recherche-localite-option${i === actif ? " est-actif" : ""}`}
                  onMouseEnter={() => setActif(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aller(o);
                  }}
                >
                  <span className="recherche-localite-nom">{o.nom}</span>
                  <span className="recherche-localite-sous">
                    {o.niveau === "commune" ? "Commune" : `Quartier · ${o.communeNom}`}
                    {o.restaurants > 0 ? ` · ${o.restaurants} restaurant${o.restaurants > 1 ? "s" : ""}` : " · pas encore de restaurant"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="pub-btn recherche-localite-bouton">
          {boutonLibelle}
        </button>
      </div>
      {aucune || (saisie.trim() !== "" && suggestions.length === 0) ? (
        <p className="recherche-localite-vide" role="status">
          Aucune localité ne correspond à « {saisie.trim()} ». Essayez le nom d&apos;une commune ou d&apos;un quartier de la liste.
        </p>
      ) : null}
    </form>
  );
}
