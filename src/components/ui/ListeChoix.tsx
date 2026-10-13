"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface OptionChoix {
  valeur: string;
  libelle: string;
}

/**
 * Liste de choix stylée selon le design système (les menus natifs du navigateur ne peuvent pas être
 * mis en forme). La valeur choisie part avec le formulaire via un champ caché `nom`.
 * Clavier : Entrée ou Espace ouvre ; flèches pour parcourir ; Entrée valide ; Échap ferme.
 */
export function ListeChoix({
  nom,
  options,
  valeur,
  onChange,
  placeholder,
  libelleAccessible,
  disabled = false,
}: {
  nom: string;
  options: OptionChoix[];
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder: string;
  libelleAccessible: string;
  disabled?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  const identifiant = useId();
  const choisi = options.find((o) => o.valeur === valeur);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    function surClic(e: MouseEvent) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  function ouvrir() {
    if (disabled || options.length === 0) return;
    const index = Math.max(0, options.findIndex((o) => o.valeur === valeur));
    setSurvol(index);
    setOuvert(true);
  }

  function choisir(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.valeur);
    setOuvert(false);
  }

  function surClavier(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!ouvert) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        ouvrir();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurvol((s) => Math.min(s + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurvol((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choisir(survol);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
    }
  }

  return (
    <div ref={racine} className="liste-choix">
      <input type="hidden" name={nom} value={valeur} />
      <button
        type="button"
        className="liste-choix-declencheur"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={`${identifiant}-liste`}
        aria-label={libelleAccessible}
        disabled={disabled}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={surClavier}
      >
        <span className={choisi ? "liste-choix-valeur" : "liste-choix-vide"}>{choisi ? choisi.libelle : placeholder}</span>
        <span aria-hidden="true" className="liste-choix-fleche">▾</span>
      </button>
      {ouvert ? (
        <ul id={`${identifiant}-liste`} role="listbox" className="liste-choix-panneau" aria-label={libelleAccessible}>
          {options.map((option, index) => (
            <li
              key={option.valeur}
              role="option"
              aria-selected={option.valeur === valeur}
              className={`liste-choix-option${index === survol ? " est-survol" : ""}${option.valeur === valeur ? " est-choisi" : ""}`}
              onMouseEnter={() => setSurvol(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(index);
              }}
            >
              {option.libelle}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
