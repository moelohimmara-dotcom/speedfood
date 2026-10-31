"use client";

import { useActionState } from "react";
import { activerCompteLivreurAction, type EtatActivation } from "@/lib/livraison/actions-activation";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatActivation = {};

interface Props {
  jeton: string;
  pieceRequise: boolean;
  urgenceRequise: boolean;
  approbation: boolean;
}

/** Dossier du livreur : seulement les champs que Speedfood exige (réglés dans la console), puis consentement. */
export function FormulaireActivation({ jeton, pieceRequise, urgenceRequise, approbation }: Props) {
  const [etat, action, enCours] = useActionState(activerCompteLivreurAction, etatInitial);
  return (
    <form action={action} className="livreurs-formulaire">
      <input type="hidden" name="jeton" value={jeton} />

      {pieceRequise ? (
        <fieldset className="livreurs-groupe">
          <legend>Pièce d&apos;identité</legend>
          <div className="field">
            <label htmlFor="piece-type">Type de pièce</label>
            <select id="piece-type" name="piece_type" required defaultValue="">
              <option value="" disabled>
                Choisir
              </option>
              <option value="carte_identite">Carte d&apos;identité</option>
              <option value="passeport">Passeport</option>
              <option value="permis">Permis de conduire</option>
              <option value="autre">Autre pièce officielle</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="piece-numero">Numéro de la pièce</label>
            <input id="piece-numero" name="piece_numero" required minLength={4} maxLength={40} autoComplete="off" />
          </div>
        </fieldset>
      ) : null}

      {urgenceRequise ? (
        <fieldset className="livreurs-groupe">
          <legend>Personne à prévenir en cas de problème</legend>
          <div className="field">
            <label htmlFor="urgence-nom">Nom</label>
            <input id="urgence-nom" name="urgence_nom" required minLength={2} maxLength={80} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="urgence-tel">Téléphone</label>
            <input id="urgence-tel" name="urgence_telephone" required inputMode="tel" maxLength={20} autoComplete="off" />
          </div>
        </fieldset>
      ) : null}

      <label className="consentement">
        <input type="checkbox" name="consentement" />
        <span>
          J&apos;accepte que Speedfood utilise ces informations pour gérer mon activité de livreur.{" "}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer">
            Voir comment mes données sont utilisées
          </a>
        </span>
      </label>
      {approbation ? <p className="aide-champ">Après l&apos;activation, l&apos;équipe Speedfood doit approuver votre fiche avant que vous puissiez recevoir des courses.</p> : null}
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Activation…" : "Activer mon compte livreur"}
      </Button>
    </form>
  );
}
