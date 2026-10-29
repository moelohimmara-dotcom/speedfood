"use client";

import { useEffect, useRef, useState } from "react";
import { creerContexteAudio, jouerCarillon } from "@/components/AlerteCommandes";

/**
 * Alerte de l'équipe Speedfood sur le poste de répartition : un carillon à chaque NOUVELLE commande à confirmer (la première lecture de la page ne sonne pas), le
 * nombre de commandes en attente dans le titre de l'onglet, et un carillon de rappel toutes les 60 s tant qu'il en reste. Le navigateur n'autorise le son qu'après un
 * geste de la personne : d'où le bouton « Activer le son », à cliquer une fois par ouverture de la page. L'actualisation des données est faite par `ActualisationAuto`.
 */
export function AlerteEquipe({ aConfirmer }: { aConfirmer: string[] }) {
  const contexte = useRef<AudioContext | null>(null);
  const connues = useRef<Set<string> | null>(null);
  const titreInitial = useRef<string | null>(null);
  const nombre = useRef(0);
  const [sonActif, setSonActif] = useState(false);
  const [nouvelles, setNouvelles] = useState(0);

  function sonner() {
    if (contexte.current) {
      void contexte.current.resume().catch(() => undefined);
      jouerCarillon(contexte.current);
    }
  }

  function activerSon() {
    contexte.current ??= creerContexteAudio();
    setSonActif(contexte.current !== null);
    sonner();
  }

  useEffect(() => {
    nombre.current = aConfirmer.length;
    if (titreInitial.current === null) titreInitial.current = document.title;
    document.title = aConfirmer.length > 0 ? `(${aConfirmer.length}) À confirmer · ${titreInitial.current}` : titreInitial.current;
    if (connues.current === null) {
      connues.current = new Set(aConfirmer);
      return;
    }
    const arrivees = aConfirmer.filter((id) => !connues.current!.has(id));
    connues.current = new Set(aConfirmer);
    if (arrivees.length > 0) {
      setNouvelles((n) => n + arrivees.length);
      sonner();
    }
  }, [aConfirmer]);

  useEffect(() => {
    const rappel = window.setInterval(() => {
      if (nombre.current > 0 && contexte.current) sonner();
    }, 60_000);
    return () => {
      window.clearInterval(rappel);
      if (titreInitial.current !== null) document.title = titreInitial.current;
    };
  }, []);

  return (
    <div className="repartition-alerte" role="status" aria-live="polite">
      {sonActif ? (
        <p className="aide-champ">
          Son activé : un carillon retentit à chaque nouvelle commande à confirmer{nouvelles > 0 ? ` (${nouvelles} arrivée${nouvelles > 1 ? "s" : ""} depuis l'ouverture de la page)` : ""}.
        </p>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={activerSon}>
          Activer le son des nouvelles commandes
        </button>
      )}
    </div>
  );
}
