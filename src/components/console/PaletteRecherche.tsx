"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { filtrerEntrees, type EntreeRecherche } from "@/lib/console/recherche";

/**
 * Recherche rapide des consoles (refonte, phase 3) : Ctrl+K (ou ⌘K), ou le bouton `BoutonRecherche`, ouvre une fenêtre où quelques lettres
 * suffisent pour atteindre une page. Les entrées arrivent du serveur déjà filtrées par permission : on ne propose que ce que le menu montre.
 * Monté UNE fois par console (le menu existe en double, bureau et mobile) ; le bouton le déclenche par un évènement de la fenêtre.
 * Motif ARIA « combobox + listbox » : le focus reste dans le champ, `aria-activedescendant` désigne le résultat actif.
 */
const EVENEMENT_OUVERTURE = "sx-ouvrir-recherche";

export function BoutonRecherche() {
  return (
    <button type="button" className="sx-recherche-bouton" onClick={() => window.dispatchEvent(new Event(EVENEMENT_OUVERTURE))}>
      <span>Rechercher…</span>
      <kbd className="sx-kbd" aria-hidden="true">
        Ctrl K
      </kbd>
    </button>
  );
}

export function PaletteRecherche({ entrees }: { entrees: readonly EntreeRecherche[] }) {
  const router = useRouter();
  const dialogue = useRef<HTMLDialogElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState("");
  const [actif, setActif] = useState(0);
  const idListe = useId();

  const resultats = filtrerEntrees(entrees, requete);
  const indexActif = Math.min(actif, Math.max(resultats.length - 1, 0));

  useEffect(() => {
    const ouvrir = () => {
      setRequete("");
      setActif(0);
      setOuvert(true);
    };
    const surClavier = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        // L'éditeur de pages réserve Ctrl+K (lien) : le bouton reste disponible partout.
        if (document.querySelector(".studio-editeur")) return;
        e.preventDefault();
        if (dialogue.current?.open) setOuvert(false);
        else ouvrir();
      }
    };
    window.addEventListener("keydown", surClavier);
    window.addEventListener(EVENEMENT_OUVERTURE, ouvrir);
    return () => {
      window.removeEventListener("keydown", surClavier);
      window.removeEventListener(EVENEMENT_OUVERTURE, ouvrir);
    };
  }, []);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) {
      d.showModal();
      champ.current?.focus();
    }
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  const aller = (entree: EntreeRecherche | undefined) => {
    if (!entree) return;
    setOuvert(false);
    router.push(entree.href);
  };

  const surTouche = (e: React.KeyboardEvent) => {
    const n = Math.max(resultats.length, 1);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((indexActif + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((indexActif - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      aller(resultats[indexActif]);
    }
  };

  return (
    <dialog
      ref={dialogue}
      className="sx-palette"
      aria-label="Recherche rapide"
      onCancel={(e) => {
        e.preventDefault();
        setOuvert(false);
      }}
      onClick={(e) => {
        // Un clic sur le fond (le <dialog> lui-même, hors du cadre) ferme.
        if (e.target === e.currentTarget) setOuvert(false);
      }}
    >
      <div className="sx-palette-cadre">
        <input
          ref={champ}
          type="text"
          className="sx-palette-champ"
          role="combobox"
          aria-expanded="true"
          aria-controls={idListe}
          aria-activedescendant={resultats.length > 0 ? `${idListe}-${indexActif}` : undefined}
          aria-autocomplete="list"
          aria-label="Rechercher une page"
          placeholder="Rechercher une page…"
          autoComplete="off"
          value={requete}
          onChange={(e) => {
            setRequete(e.target.value);
            setActif(0);
          }}
          onKeyDown={surTouche}
        />
        <ul id={idListe} role="listbox" aria-label="Pages" className="sx-palette-liste">
          {resultats.map((entree, i) => (
            <li
              key={entree.href}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === indexActif}
              className={`sx-palette-option${i === indexActif ? " actif" : ""}`}
              onMouseMove={() => setActif(i)}
              onClick={() => aller(entree)}
            >
              <span className="sx-palette-libelle">{entree.libelle}</span>
              <span className="sx-palette-famille">{entree.famille}</span>
            </li>
          ))}
        </ul>
        {resultats.length === 0 ? <p className="sx-palette-vide">Rien ne correspond. Essayez un autre mot.</p> : null}
        <p className="sx-palette-aide">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</p>
      </div>
    </dialog>
  );
}
