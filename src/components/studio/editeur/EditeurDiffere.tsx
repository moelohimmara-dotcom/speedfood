"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import type { ProprietesEditeur } from "./types";

/**
 * Point d'entrée de l'éditeur de pages à blocs (palier 3, tâche 7). Import DIFFÉRÉ sans rendu serveur (`ssr: false`) :
 * le code de Puck n'entre ni dans le Worker ni dans les autres pages. Sous 768 px de large, l'éditeur n'est ni affiché
 * ni téléchargé : un message renvoie à la liste. Seuil relevé de 768 à 1024 px (audit du 15 octobre, ED-2) : à 768 px, l'aperçu central ne mesurait que
 * 288 px, le contenu était coupé. Le glisser-déposer tactile n'est de toute façon pas validé (essai de la tâche 5).
 *
 * Une fois l'éditeur ouvert, il reste affiché même si la fenêtre rétrécit ensuite (sinon le travail non enregistré
 * serait perdu sans prévenir).
 */
const Editeur = dynamic(() => import("./Editeur"), {
  ssr: false,
  loading: () => <p role="status">Chargement de l&apos;éditeur…</p>,
});

const REQUETE_LARGEUR = "(min-width: 1024px)";
let editeurDejaAffiche = false;

function abonner(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_LARGEUR);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

/** `null` côté serveur (largeur inconnue), puis vrai/faux dans le navigateur. */
function largeurSuffisante(): boolean | null {
  return editeurDejaAffiche || window.matchMedia(REQUETE_LARGEUR).matches;
}

export function EditeurPageBlocs(props: ProprietesEditeur) {
  const large = useSyncExternalStore(abonner, largeurSuffisante, () => null);
  useEffect(() => {
    if (large) editeurDejaAffiche = true;
  }, [large]);

  if (large) return <Editeur {...props} />;

  return (
    <div className="se-hors-editeur">
      <h1>{props.page.titre}</h1>
      {large === null ? (
        <p role="status">Chargement de l&apos;éditeur…</p>
      ) : (
        <div className="se-message-mobile" role="note">
          <p>L&apos;éditeur de pages demande un écran plus large : ordinateur, ou tablette tenue en largeur (1 024 pixels au moins).</p>
          <Link href="/system/contenu/pages" className="btn btn-secondary">
            Retour à la liste des pages
          </Link>
        </div>
      )}
    </div>
  );
}
