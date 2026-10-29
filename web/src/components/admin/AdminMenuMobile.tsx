"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { IconeAdmin } from "./icones";

/**
 * Tiroir de navigation sur téléphone et tablette. Repose sur l'élément natif `<dialog>` : focus piégé dans le tiroir,
 * fermeture par Échap, retour du focus au bouton. Il se referme tout seul après un changement de page.
 */
export function AdminMenuMobile({ children }: { children: React.ReactNode }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const chemin = usePathname();

  useEffect(() => {
    dialogue.current?.close();
  }, [chemin]);

  return (
    <>
      <button
        type="button"
        className="ad-bouton-menu"
        aria-haspopup="dialog"
        onClick={() => dialogue.current?.showModal()}
      >
        <IconeAdmin nom="menu" taille={22} />
        <span>Menu</span>
      </button>
      <dialog
        ref={dialogue}
        className="ad-tiroir"
        aria-label="Navigation de l'administration"
        onClick={(evenement) => {
          // Un clic sur le fond sombre (le dialogue lui-même, pas son contenu) ferme le tiroir.
          if (evenement.target === dialogue.current) {
            dialogue.current?.close();
          }
        }}
      >
        <div className="ad-tiroir-contenu">
          <button type="button" className="ad-tiroir-fermer" onClick={() => dialogue.current?.close()}>
            <IconeAdmin nom="fermer" taille={22} />
            <span className="sr-only">Fermer le menu</span>
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
