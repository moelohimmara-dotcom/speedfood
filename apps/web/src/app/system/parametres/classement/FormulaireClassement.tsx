"use client";

import { useActionState, useRef, useState } from "react";
import { modifierReglagesClassementAction, type EtatActionClassement, type ReglagesClassementAffiches } from "@/lib/system-admin/classement";
import { Panneau } from "@/components/admin/blocs";
import { BarreEnregistrement, useSuiviModifications } from "@/components/admin/BarreEnregistrement";

const etatInitial: EtatActionClassement = {};

/** Réglage des trois poids (somme 100) et de la période de fréquentation. La somme est affichée en direct ; le serveur revérifie. */
export function FormulaireClassement({ valeurs }: { valeurs: ReglagesClassementAffiches }) {
  const [etat, action, enCours] = useActionState(modifierReglagesClassementAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  const { modifie, mesurer, annuler } = useSuiviModifications(formulaire, Boolean(etat.succes));
  const [poids, setPoids] = useState(valeurs.poids);
  const somme = poids.note + poids.prix + poids.frequentation;

  const champ = (cle: keyof typeof poids, id: string, libelle: string, aide: string) => (
    <div className="field">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={`poids_${cle}`}
        inputMode="numeric"
        defaultValue={valeurs.poids[cle]}
        required
        onChange={(e) => setPoids((p) => ({ ...p, [cle]: Number.parseInt(e.target.value, 10) || 0 }))}
      />
      <p className="ad-aide-champ">{aide}</p>
    </div>
  );

  return (
    <form ref={formulaire} action={action} className="ad-formulaire" onInput={mesurer} onChange={mesurer}>
      {!valeurs.disponible ? (
        <p className="ad-aide-champ" role="note">
          La notation n&apos;est pas encore activée en base (migration non appliquée) : ces réglages ne peuvent pas être enregistrés pour le moment.
        </p>
      ) : null}
      <Panneau titre="Poids des critères">
        {champ("note", "cl-note", "Note des clients (%)", "Moyenne lissée des avis, comptée à partir de 5 avis ; neutre en dessous.")}
        {champ("prix", "cl-prix", "Prix des plats (%)", "Prix typique du restaurant (médiane de ses plats disponibles) : le moins cher est mieux placé.")}
        {champ("frequentation", "cl-freq", "Fréquentation (%)", "Nombre de commandes terminées sur la période ci-dessous.")}
        <p className={somme === 100 ? "ad-aide-champ" : "notation-erreur"} role="status">
          Total : {somme} % {somme === 100 ? "" : "(doit faire exactement 100)"}
        </p>
      </Panneau>
      <Panneau titre="Période de fréquentation">
        <div className="field">
          <label htmlFor="cl-fenetre">Jours pris en compte (7 à 180)</label>
          <input id="cl-fenetre" name="fenetre_frequentation_jours" inputMode="numeric" defaultValue={valeurs.fenetreJours} required />
        </div>
      </Panneau>
      {etat.erreur ? <p className="notation-erreur" role="alert">{etat.erreur}</p> : null}
      <BarreEnregistrement modifie={modifie} enCours={enCours} etat={etat} onAnnuler={annuler} messageSucces="Réglages du classement enregistrés" />
    </form>
  );
}
