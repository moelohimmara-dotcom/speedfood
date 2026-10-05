"use client";

import { startTransition, useActionState, useState } from "react";
import { enregistrerIdentiteDocumentsAction, type EtatFormulaireDocuments } from "@/lib/restaurant/documents-actions";
import type { RegimeDocument } from "@/lib/paiement/documents-regles";
import { Alert, Button } from "@/components/ui";

export interface ValeursIdentite {
  raisonSociale: string;
  adresse: string;
  telephone: string;
  nif: string;
  rccm: string;
  regime: RegimeDocument;
  tvaTaux: string;
  mention: string;
}

const etatInitial: EtatFormulaireDocuments = {};

/** Identité qui s'imprime sur les reçus et factures. Non fiscal par défaut ; « fiscal déclaré » n'ajoute que les mentions saisies ici. */
export function FormulaireIdentite({ valeurs }: { valeurs: ValeursIdentite }) {
  const [etat, action, enCours] = useActionState(enregistrerIdentiteDocumentsAction, etatInitial);
  // Champs contrôlés : React vide un formulaire non contrôlé après chaque action, ce qui effacerait la saisie en cas d'erreur.
  const [v, setV] = useState<ValeursIdentite>(valeurs);
  const regime = v.regime;
  const setRegime = (r: RegimeDocument) => setV((x) => ({ ...x, regime: r }));
  const champ = (cle: keyof ValeursIdentite) => ({
    value: v[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [cle]: e.target.value })),
  });

  return (
    <form
      className="doc-formulaire"
      onSubmit={(e) => {
        // Soumission sans `action={...}` : React remet un formulaire à zéro après une action, ce qui ferait revenir les cases à leur état de départ.
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => action(donnees));
      }}
    >
      <div className="field">
        <label htmlFor="raison_sociale">Nom sur les documents</label>
        <input id="raison_sociale" name="raison_sociale" type="text" maxLength={120} {...champ("raisonSociale")} placeholder="Par défaut : le nom de votre restaurant" />
      </div>
      <div className="field">
        <label htmlFor="adresse">Adresse</label>
        <input id="adresse" name="adresse" type="text" maxLength={200} {...champ("adresse")} placeholder="Ex. Kaloum, près du marché" />
      </div>
      <div className="field">
        <label htmlFor="telephone">Téléphone affiché</label>
        <input id="telephone" name="telephone" type="tel" maxLength={30} {...champ("telephone")} placeholder="Ex. +224 6xx xx xx xx" />
      </div>

      <fieldset className="doc-regime">
        <legend>Type de documents</legend>
        <label className="doc-radio">
          <input type="radio" name="regime" value="non_fiscal" checked={regime === "non_fiscal"} onChange={() => setRegime("non_fiscal")} />
          <span>
            <strong>Non fiscaux</strong> (par défaut) : justificatif de commande et de paiement, sans valeur fiscale.
          </span>
        </label>
        <label className="doc-radio">
          <input type="radio" name="regime" value="fiscal_declare" checked={regime === "fiscal_declare"} onChange={() => setRegime("fiscal_declare")} />
          <span>
            <strong>Fiscal déclaré</strong> : j&apos;affiche mon NIF, mon RCCM et ma TVA, sous ma responsabilité. Faites valider ce choix par votre comptable.
          </span>
        </label>
      </fieldset>

      {regime === "fiscal_declare" ? (
        <div className="doc-fiscal">
          <div className="field">
            <label htmlFor="nif">NIF (obligatoire)</label>
            <input id="nif" name="nif" type="text" maxLength={30} {...champ("nif")} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="rccm">RCCM</label>
            <input id="rccm" name="rccm" type="text" maxLength={30} {...champ("rccm")} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="tva_taux">TVA incluse dans vos prix (%)</label>
            <input id="tva_taux" name="tva_taux" type="text" inputMode="numeric" maxLength={2} {...champ("tvaTaux")} placeholder="Ex. 18, ou vide si aucune" />
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="mention">Message en bas des documents (facultatif)</label>
        <input id="mention" name="mention" type="text" maxLength={200} {...champ("mention")} placeholder="Ex. Merci de votre confiance !" />
      </div>

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Enregistré. Les prochains documents utiliseront ces informations.</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
