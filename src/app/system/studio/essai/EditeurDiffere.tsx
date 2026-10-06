"use client";

import dynamic from "next/dynamic";

/** Import différé sans rendu serveur : le code de l'éditeur n'entre ni dans le bundle serveur ni dans les autres pages. */
const Editeur = dynamic(() => import("./Editeur"), {
  ssr: false,
  loading: () => <p role="status">Chargement de l&apos;éditeur…</p>,
});

export function EditeurDiffere() {
  return <Editeur />;
}
