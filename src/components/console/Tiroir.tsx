"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Tiroir latéral d'édition (fondations de la refonte, phase 1) : édite un élément sans quitter la liste, comme le panneau d'un tableau de
 * bord. Repose sur `<dialog>` modal (focus piégé, Échap, retour du focus à l'élément qui l'a ouvert : tout vient du navigateur).
 * Ancré à droite sur grand écran, plein écran sur téléphone.
 *
 * Le composant est contrôlé : `ouvert` et `onFermer`. Il ne décide pas d'une perte de modifications (c'est le contenu qui sait s'il y en a) :
 * `peutFermer` permet de refuser la fermeture (par exemple si des modifications ne sont pas enregistrées) ; Échap et le bouton « Fermer »
 * passent par lui.
 */
export function Tiroir({
  ouvert,
  titre,
  onFermer,
  peutFermer,
  children,
}: {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  peutFermer?: () => boolean;
  children: ReactNode;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const idTitre = useId();

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  const demanderFermeture = () => {
    if (peutFermer && !peutFermer()) return;
    onFermer();
  };

  return (
    <dialog
      ref={dialogue}
      className="sx-tiroir"
      aria-labelledby={idTitre}
      onCancel={(e) => {
        e.preventDefault();
        demanderFermeture();
      }}
    >
      <header className="sx-tiroir-entete">
        <h2 id={idTitre} className="sx-tiroir-titre">
          {titre}
        </h2>
        <button type="button" className="sx-btn" onClick={demanderFermeture}>
          Fermer
        </button>
      </header>
      <div className="sx-tiroir-corps">{ouvert ? children : null}</div>
    </dialog>
  );
}
