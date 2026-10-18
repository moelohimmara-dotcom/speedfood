"use client";

import { useActionState, useRef } from "react";
import { modifierReglagesAideChoixAction, type EtatActionAideChoix } from "@/lib/system-admin/aide-choix";
import type { ReglagesAideChoix } from "@/lib/decouverte/aide-choix-service";
import { Panneau } from "@/components/admin/blocs";
import { BarreEnregistrement, useSuiviModifications } from "@/components/admin/BarreEnregistrement";

const etatInitial: EtatActionAideChoix = {};

function Aide({ children }: { children: React.ReactNode }) {
  return <p className="ad-aide-champ">{children}</p>;
}

/** Réglages de l'aide au choix. La validation fait foi côté serveur. */
export function FormulaireAideChoix({ valeurs }: { valeurs: ReglagesAideChoix }) {
  const [etat, action, enCours] = useActionState(modifierReglagesAideChoixAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  const { modifie, mesurer, annuler } = useSuiviModifications(formulaire, Boolean(etat.succes));

  return (
    <form ref={formulaire} action={action} className="ad-formulaire" onInput={mesurer} onChange={mesurer}>
      {!valeurs.disponible ? (
        <p className="ad-aide-champ" role="note">
          Les réglages ne sont pas encore activés en base (migration non appliquée) : les valeurs affichées sont celles par défaut et ne peuvent pas être enregistrées.
        </p>
      ) : null}
      <Panneau titre="Seuils des gammes (prix typique d'un restaurant)">
        <Aide>Le prix typique est la médiane des prix des plats disponibles. Bornes hautes incluses, en GNF.</Aide>
        <div className="field">
          <label htmlFor="ac-eco">Économique jusqu&apos;à (GNF)</label>
          <input id="ac-eco" name="seuil_economique_gnf" inputMode="numeric" defaultValue={valeurs.seuils.economiqueJusqua} required />
        </div>
        <div className="field">
          <label htmlFor="ac-inter">Intermédiaire jusqu&apos;à (GNF)</label>
          <input id="ac-inter" name="seuil_intermediaire_gnf" inputMode="numeric" defaultValue={valeurs.seuils.intermediaireJusqua} required />
        </div>
        <div className="field">
          <label htmlFor="ac-haut">Haut de gamme jusqu&apos;à (GNF)</label>
          <input id="ac-haut" name="seuil_haut_de_gamme_gnf" inputMode="numeric" defaultValue={valeurs.seuils.hautDeGammeJusqua} required />
          <Aide>Au-delà : Premium. Revoyez ces seuils quand les prix évoluent (inflation) ou quand les restaurants se diversifient.</Aide>
        </div>
      </Panneau>
      <Panneau titre="Recherche">
        <div className="field">
          <label htmlFor="ac-rayon">Rayon par défaut (km)</label>
          <input id="ac-rayon" name="rayon_defaut_km" inputMode="decimal" defaultValue={valeurs.rayonDefautKm} required />
        </div>
        <div className="field">
          <label htmlFor="ac-marge">Marge « un peu au-dessus du budget » (%)</label>
          <input id="ac-marge" name="marge_au_dessus_pct" inputMode="numeric" defaultValue={valeurs.margeAuDessusPct} required />
          <Aide>Un restaurant dont le plat le moins cher dépasse le budget de moins que cette marge est proposé à part, clairement annoncé.</Aide>
        </div>
        <div className="field">
          <label htmlFor="ac-nb">Nombre de propositions (1 à 10)</label>
          <input id="ac-nb" name="nb_propositions" inputMode="numeric" defaultValue={valeurs.nbPropositions} required />
        </div>
      </Panneau>
      {etat.erreur ? <p className="notation-erreur" role="alert">{etat.erreur}</p> : null}
      <BarreEnregistrement modifie={modifie} enCours={enCours} etat={etat} onAnnuler={annuler} messageSucces="Réglages de l'aide au choix enregistrés" />
    </form>
  );
}
