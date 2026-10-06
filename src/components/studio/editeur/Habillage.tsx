"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createUsePuck } from "@puckeditor/core";
import { entreeRegistre, type ChampBloc } from "@/lib/studio/registre";
import { CONSIGNE_GLISSER, ROLE_GLISSER, TITRE_APERCU, libelleDepuisIdentifiant, traduireAnnonceGlisser } from "@/lib/studio/francisation";

/**
 * Habillage des éléments de Puck que son dictionnaire ne couvre pas (palier 3, tâche 7) : titre et langue de l'iframe
 * d'aperçu, étiquettes de champs (groupe nommé pour les boutons radio), aide de saisie et état « aucun bloc sélectionné ».
 */

const usePuck = createUsePuck();

/** Remplace dans un document les textes anglais posés par dnd-kit (rôle, consigne, annonces) et nomme les blocs muets. */
function franciserGlisser(racine: ParentNode) {
  for (const el of racine.querySelectorAll('[aria-roledescription="draggable"]')) el.setAttribute("aria-roledescription", ROLE_GLISSER);
  for (const el of racine.querySelectorAll('[id^="dnd-kit-description"]')) if (el.textContent !== CONSIGNE_GLISSER) el.textContent = CONSIGNE_GLISSER;
  for (const el of racine.querySelectorAll('[id^="dnd-kit-announcement"]')) {
    // On modifie le nœud texte en place : dnd-kit garde une référence vers lui pour ses annonces suivantes.
    const noeud = el.firstChild;
    if (noeud && noeud.nodeType === 3) {
      const francais = traduireAnnonceGlisser(noeud.nodeValue ?? "");
      if (francais !== noeud.nodeValue) noeud.nodeValue = francais;
    }
  }
  // Le bouton « + » d'une liste (questions de la FAQ) est une icône seule : on lui donne un nom.
  for (const el of racine.querySelectorAll('button[class*="ArrayField-addButton"]:not([aria-label])')) {
    el.setAttribute("aria-label", "Ajouter un élément à la liste");
    el.setAttribute("title", "Ajouter un élément à la liste");
  }
  // Un bloc sans texte (séparateur, espace) rendu déplaçable par dnd-kit n'aurait aucun nom : on lui donne son type.
  for (const el of racine.querySelectorAll('[data-puck-component][role="button"]:not([aria-label])')) {
    if (!(el as HTMLElement).innerText?.trim()) el.setAttribute("aria-label", libelleDepuisIdentifiant(el.getAttribute("data-puck-component") ?? ""));
  }
}

/**
 * Surveille un document (la page, puis l'iframe d'aperçu) : dnd-kit n'offre pas de traduction par Puck et repose ses
 * attributs et ses annonces à chaque glisser-déposer. Une seule passe par lot de mutations.
 */
export function useFrancisationGlisser(doc: Document | undefined) {
  useEffect(() => {
    if (!doc?.body) return;
    franciserGlisser(doc);
    let prevu = false;
    const observateur = new MutationObserver(() => {
      if (prevu) return;
      prevu = true;
      queueMicrotask(() => {
        prevu = false;
        franciserGlisser(doc);
      });
    });
    observateur.observe(doc.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-roledescription", "data-puck-component", "role"],
    });
    return () => observateur.disconnect();
  }, [doc]);
}

/** Iframe d'aperçu : Puck ne lui donne pas de titre ; on le pose, avec la langue et les polices de la page hôte. */
export function CadreApercu({ children, document: doc }: { children: ReactNode; document?: Document }) {
  useEffect(() => {
    if (!doc) return;
    const cadre = doc.defaultView?.frameElement;
    cadre?.setAttribute("title", TITRE_APERCU);
    doc.documentElement.setAttribute("lang", "fr");
    // Les variables des polices (next/font) sont portées par la classe de <html> de la page hôte.
    doc.documentElement.setAttribute("class", window.document.documentElement.className);
  }, [doc]);
  useFrancisationGlisser(doc);
  return <>{children}</>;
}

/**
 * Étiquette d'un champ. Puck l'affiche dans un `<label>` (champ simple) ou un `<div>` (boutons radio, sans nom de
 * groupe) : ce second cas devient un groupe nommé (`role="group"`), lu par les lecteurs d'écran avant chaque option.
 */
export function EtiquetteChamp({
  children,
  label,
  el = "label",
  readOnly,
  className,
}: {
  children?: ReactNode;
  icon?: ReactNode;
  label: string;
  el?: "label" | "div";
  readOnly?: boolean;
  className?: string;
}) {
  const id = useId();
  const libelle = (
    <span className="se-champ-libelle" id={id}>
      {label}
      {readOnly ? <span className="se-champ-lecture"> (lecture seule)</span> : null}
    </span>
  );
  if (el === "label") {
    return (
      <label className={`se-champ ${className ?? ""}`}>
        {libelle}
        {children}
      </label>
    );
  }
  return (
    <div className={`se-champ ${className ?? ""}`} role="group" aria-labelledby={id}>
      {libelle}
      {children}
    </div>
  );
}

/** Panneau des réglages : aide de saisie du bloc sélectionné, ou explication quand aucun bloc ne l'est. */
export function ChampsBloc({ children, itemSelector }: { children: ReactNode; isLoading: boolean; itemSelector?: { index: number; zone?: string } | null }) {
  const selection = usePuck((s) => s.selectedItem);
  if (!itemSelector || !selection) {
    return (
      <p className="se-aucun-bloc">
        Aucun bloc sélectionné. Choisissez un bloc dans l&apos;aperçu ou dans « Blocs de la page » pour modifier ses réglages.
      </p>
    );
  }
  const entree = entreeRegistre(selection.type);
  const aides = entree ? (Object.values(entree.champs) as ChampBloc[]).filter((c): c is ChampBloc & { aide: string } => "aide" in c && typeof c.aide === "string" && c.aide !== "") : [];
  return (
    <div className="se-champs">
      {children}
      {aides.map((c) => (
        <p key={c.libelle} className="se-aide">
          {c.aide}
        </p>
      ))}
    </div>
  );
}
