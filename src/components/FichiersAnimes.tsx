"use client";

import { useEffect } from "react";

/**
 * Retour visuel des champs de fichiers : dès qu'un fichier est choisi, le champ reçoit `data-choisi` (fantaisie.css le fait passer en vert avec
 * une coche, en animant). Un seul écouteur délégué pour tout le site ; aucune donnée lue, aucun fichier envoyé, aucune image affichée.
 */
export function FichiersAnimes() {
  useEffect(() => {
    function surChangement(e: Event) {
      const cible = e.target;
      if (!(cible instanceof HTMLInputElement) || cible.type !== "file") return;
      if (cible.files && cible.files.length > 0) {
        // Retirer puis remettre l'attribut relance l'animation si la personne change de fichier.
        cible.removeAttribute("data-choisi");
        void cible.offsetWidth;
        cible.setAttribute("data-choisi", "1");
      } else {
        cible.removeAttribute("data-choisi");
      }
    }
    document.addEventListener("change", surChangement, true);
    return () => document.removeEventListener("change", surChangement, true);
  }, []);
  return null;
}
