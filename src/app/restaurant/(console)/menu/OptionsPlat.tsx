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
    <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--bordure)" }}>
      <p style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>Suppléments</p>
      {options.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {options.map((option) => (
            <Badge key={option.id} ton="neutre" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {option.nom} (+{option.prix.toLocaleString("fr-FR")} GNF)
              <button
                type="button"
                aria-label={`Retirer le supplément ${option.nom}`}
                disabled={enTransition}
                onClick={() => demarrerTransition(() => retirerOptionAction(option.id))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "inherit",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Aucun supplément pour ce plat.
        </p>
      )}

      <form
        ref={formRef}
        action={(formData) => {
          action(formData);
          formRef.current?.reset();
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <input type="hidden" name="menu_item_id" value={menuItemId} />
        <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
          <label htmlFor={`option-nom-${menuItemId}`}>Nom</label>
          <input id={`option-nom-${menuItemId}`} name="nom" type="text" maxLength={80} placeholder="Ex. Fromage en plus" required />
        </div>
        <div className="field" style={{ marginBottom: 0, width: 120 }}>
          <label htmlFor={`option-prix-${menuItemId}`}>Prix (GNF)</label>
          <input id={`option-prix-${menuItemId}`} name="prix" type="number" min={0} step={1} required />
        </div>
        <Button type="submit" variante="secondary" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </form>
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginTop: 8 }}>
          {etat.erreur}
        </Alert>
      ) : null}
    </div>
  );
}
