"use client";

import { useActionState, useRef, useTransition } from "react";
import {
  ajouterOptionAction,
  retirerOptionAction,
  type EtatFormulaireOption,
} from "@/lib/menu/actions";
import { Badge, Button, Alert } from "@/components/ui";

interface Option {
  id: string;
  nom: string;
  prix: number;
}

const etatInitial: EtatFormulaireOption = {};

/**
 * Suppléments au choix du client pour un plat (extras optionnels
 * cumulables — pas de choix unique obligatoire, hors périmètre). Liste des
 * suppléments existants + petit formulaire d'ajout.
 */
export function OptionsPlat({ menuItemId, options }: { menuItemId: string; options: Option[] }) {
  const [etat, action, enCours] = useActionState(ajouterOptionAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="u-mt-s3-pt-s3-bt-1px-solid-bordure">
      <p className="u-m-0-0-6px-fs-0-85rem-fw-700">Suppléments</p>
      {options.length > 0 ? (
        <div className="u-d-flex-fwrap-wrap-g-6px-mb-8px">
          {options.map((option) => (
            <Badge key={option.id} ton="neutre" className="u-d-inline-flex-ai-center-g-6px">
              {option.nom} (+{option.prix.toLocaleString("fr-FR")} GNF)
              <button
                type="button"
                aria-label={`Retirer le supplément ${option.nom}`}
                disabled={enTransition}
                onClick={() => demarrerTransition(() => retirerOptionAction(option.id))}
                className="retirer-supplement"
              >
                ✕
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="u-m-0-0-8px-fs-0-8rem-c-secondaire">
          Aucun supplément pour ce plat.
        </p>
      )}

      <form
        ref={formRef}
        action={(formData) => {
          action(formData);
          formRef.current?.reset();
        }}
        className="option-formulaire"
      >
        <input type="hidden" name="menu_item_id" value={menuItemId} />
        <div className="field option-champ-nom">
          <label htmlFor={`option-nom-${menuItemId}`}>Nom</label>
          <input id={`option-nom-${menuItemId}`} name="nom" type="text" maxLength={80} placeholder="Ex. Fromage en plus" required />
        </div>
        <div className="field option-champ-prix">
          <label htmlFor={`option-prix-${menuItemId}`}>Prix (GNF)</label>
          <input id={`option-prix-${menuItemId}`} name="prix" type="number" min={0} step={1} required />
        </div>
        <Button type="submit" variante="secondary" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </form>
      {etat.erreur ? (
        <Alert ton="danger" className="u-mt-8px">
          {etat.erreur}
        </Alert>
      ) : null}
    </div>
  );
}
