"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface OptionChoix {
  valeur: string;
  libelle: string;
}

/** Au-delà de ce nombre d'options, le panneau propose un champ de recherche (communes d'une préfecture, par exemple). */
const SEUIL_RECHERCHE = 12;

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Liste de choix stylée selon le design système (les menus natifs du navigateur ne peuvent pas être
 * mis en forme). La valeur choisie part avec le formulaire via un champ caché `nom`.
 * Clavier : Entrée, Espace ou flèche bas ouvre ; flèches, Début, Fin, Page précédente/suivante parcourent (l'option active
 * défile dans la vue) ; Entrée valide ; Échap ferme ; Tab ferme et passe au champ suivant ; une lettre saute à la
 * prochaine option qui commence par elle. Au-delà de douze options, un champ de recherche (insensible aux accents) filtre la liste.
 */
export function ListeChoix({
  nom,
  options,
  valeur,
  onChange,
  placeholder,
  libelleAccessible,
  disabled = false,
  idEtiquette,
}: {
  nom: string;
  options: OptionChoix[];
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder: string;
  libelleAccessible: string;
  disabled?: boolean;
  /** Identifiant de l'étiquette visible du champ : relie le nom accessible à ce qui est affiché. */
  idEtiquette?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(0);
  const [recherche, setRecherche] = useState("");
  const racine = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const identifiant = useId();
  const choisi = options.find((o) => o.valeur === valeur);
  const avecRecherche = options.length > SEUIL_RECHERCHE;

  const visibles = useMemo(() => {
    const cherche = normaliser(recherche);
    return cherche ? options.filter((o) => normaliser(o.libelle).includes(cherche)) : options;
  }, [options, recherche]);

  const idOption = (index: number) => `${identifiant}-o${index}`;

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    function surClic(e: MouseEvent) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  // L'option active reste dans la zone visible du panneau (60 communes ou plus : sans cela, le clavier est aveugle).
  useEffect(() => {
    if (!ouvert) return;
    document.getElementById(idOption(survol))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idOption dépend seulement de `identifiant`, stable.
  }, [survol, ouvert, visibles]);

  // Le champ de recherche reçoit le focus à l'ouverture : on tape directement le début du nom.
  useEffect(() => {
    if (ouvert && avecRecherche) champRecherche.current?.focus();
  }, [ouvert, avecRecherche]);

  function ouvrir() {
    if (disabled || options.length === 0) return;
    setRecherche("");
    setSurvol(Math.max(0, options.findIndex((o) => o.valeur === valeur)));
    setOuvert(true);
  }

  function fermer(rendreLeFocus = false) {
    setOuvert(false);
    setRecherche("");
    if (rendreLeFocus) racine.current?.querySelector<HTMLButtonElement>(".liste-choix-declencheur")?.focus();
  }

  function choisir(index: number) {
    const option = visibles[index];
    if (!option) return;
    onChange(option.valeur);
    fermer(true);
  }

  function surClavier(e: React.KeyboardEvent<HTMLElement>) {
    const dansLaRecherche = e.target === champRecherche.current;
    if (!ouvert) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        ouvrir();
      }
      return;
    }
    const dernier = visibles.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSurvol((s) => Math.min(s + 1, dernier));
        return;
      case "ArrowUp":
        e.preventDefault();
        setSurvol((s) => Math.max(s - 1, 0));
        return;
      case "PageDown":
        e.preventDefault();
        setSurvol((s) => Math.min(s + 8, dernier));
        return;
      case "PageUp":
        e.preventDefault();
        setSurvol((s) => Math.max(s - 8, 0));
        return;
      case "Home":
        if (dansLaRecherche) return;
        e.preventDefault();
        setSurvol(0);
        return;
      case "End":
        if (dansLaRecherche) return;
        e.preventDefault();
        setSurvol(Math.max(dernier, 0));
        return;
      case "Enter":
        e.preventDefault();
        choisir(survol);
        return;
      case " ":
        if (dansLaRecherche) return;
        e.preventDefault();
        choisir(survol);
        return;
      case "Escape":
        e.preventDefault();
        fermer(true);
        return;
      case "Tab":
        // On referme sans bloquer : le focus continue vers le champ suivant du formulaire.
        fermer();
        return;
      default:
        // Sans champ de recherche : une lettre saute à la prochaine option qui commence par elle.
        if (!avecRecherche && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const lettre = normaliser(e.key);
          const apres = visibles.findIndex((o, k) => k > survol && normaliser(o.libelle).startsWith(lettre));
          const index = apres >= 0 ? apres : visibles.findIndex((o) => normaliser(o.libelle).startsWith(lettre));
          if (index >= 0) setSurvol(index);
        }
    }
  }

  const idActif = ouvert && visibles.length > 0 ? idOption(Math.min(survol, visibles.length - 1)) : undefined;

  return (
    <div ref={racine} className="liste-choix">
      <input type="hidden" name={nom} value={valeur} />
      <button
        type="button"
        className="liste-choix-declencheur"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? `${identifiant}-liste` : undefined}
        aria-activedescendant={ouvert && !avecRecherche ? idActif : undefined}
        aria-labelledby={idEtiquette}
        aria-label={idEtiquette ? undefined : libelleAccessible}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          if (ouvert) fermer();
          else ouvrir();
        }}
        onKeyDown={disabled ? undefined : surClavier}
      >
        <span className={choisi ? "liste-choix-valeur" : "liste-choix-vide"}>{choisi ? choisi.libelle : placeholder}</span>
        <svg className="liste-choix-fleche" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {ouvert ? (
        <div className="liste-choix-panneau" onKeyDown={avecRecherche ? surClavier : undefined}>
          {avecRecherche ? (
            <div className="liste-choix-recherche">
              <input
                ref={champRecherche}
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${identifiant}-liste`}
                aria-activedescendant={idActif}
                aria-label={`Rechercher : ${libelleAccessible}`}
                autoComplete="off"
                placeholder="Rechercher…"
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setSurvol(0);
                }}
              />
              <p className="sr-only" role="status" aria-live="polite">
                {visibles.length === 0 ? "Aucun résultat" : `${visibles.length} résultat${visibles.length > 1 ? "s" : ""}`}
              </p>
            </div>
          ) : null}
          <ul id={`${identifiant}-liste`} role="listbox" className="liste-choix-liste" aria-label={libelleAccessible}>
            {visibles.length === 0 ? (
              <li role="presentation" className="liste-choix-aucun">
                Aucun résultat pour « {recherche} ».
              </li>
            ) : (
              visibles.map((option, index) => (
                <li
                  key={option.valeur}
                  id={idOption(index)}
                  role="option"
                  aria-selected={option.valeur === valeur}
                  className={`liste-choix-option${index === survol ? " est-survol" : ""}${option.valeur === valeur ? " est-choisi" : ""}`}
                  onMouseEnter={() => setSurvol(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choisir(index);
                  }}
                >
                  <span>{option.libelle}</span>
                  {option.valeur === valeur ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
