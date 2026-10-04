"use client";

import { useActionState, useState, useTransition } from "react";
import {
  creerElementTaxonomieAction,
  modifierElementTaxonomieAction,
  supprimerElementTaxonomieAction,
  type ElementTaxonomie,
  type EtatActionTaxonomie,
} from "@/lib/system-admin/taxonomie";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatActionTaxonomie = {};

type Table = "menu_categories" | "neighborhoods";

export function ListeTaxonomie({ table, elements }: { table: Table; elements: ElementTaxonomie[] }) {
  const actionCreer = creerElementTaxonomieAction.bind(null, table);
  const [etatCreation, creer] = useActionState(actionCreer, etatInitial);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "var(--space-4)" }}>
        {elements.map((e) => (
          <LigneElement key={e.id} table={table} element={e} />
        ))}
      </div>

      <form action={creer} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
          <label htmlFor={`nom-${table}`}>Nouveau nom</label>
          <input id={`nom-${table}`} name="nom" type="text" required maxLength={100} />
        </div>
        <div className="field" style={{ marginBottom: 0, width: 100 }}>
          <label htmlFor={`ordre-${table}`}>Ordre</label>
          <input id={`ordre-${table}`} name="ordre" type="number" defaultValue={elements.length} />
        </div>
        <Button type="submit">Ajouter</Button>
      </form>
      {etatCreation.erreur ? (
        <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
          {etatCreation.erreur}
        </Alert>
      ) : null}
    </div>
  );
}

function LigneElement({ table, element }: { table: Table; element: ElementTaxonomie }) {
  const [enEdition, setEnEdition] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [enTransition, demarrerTransition] = useTransition();

  const actionModifier = modifierElementTaxonomieAction.bind(null, table);
  const [etat, modifier] = useActionState(actionModifier, etatInitial);

  if (enEdition) {
    return (
      <form
        action={(formData) => {
          modifier(formData);
          setEnEdition(false);
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <input type="hidden" name="id" value={element.id} />
        <Input label="Nom" name="nom" type="text" required maxLength={100} defaultValue={element.nom} />
        <Input label="Ordre" name="ordre" type="number" defaultValue={element.ordre} style={{ width: 100 }} />
        <Button type="submit">Enregistrer</Button>
        <Button type="button" variante="secondary" onClick={() => setEnEdition(false)}>
          Annuler
        </Button>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      </form>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span>
        {element.nom} <span style={{ color: "var(--secondaire)", fontSize: "0.85rem" }}>(ordre {element.ordre})</span>
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Button type="button" variante="secondary" onClick={() => setEnEdition(true)}>
          Modifier
        </Button>
        <Button
          type="button"
          variante="danger"
          className="ad-action-discrete"
          disabled={enTransition}
          onClick={() => {
            if (confirm(`Supprimer « ${element.nom} » ?`)) {
              demarrerTransition(async () => {
                const resultat = await supprimerElementTaxonomieAction(table, element.id);
                setErreurSuppression(resultat.erreur ?? null);
              });
            }
          }}
        >
          Supprimer
        </Button>
      </div>
      {erreurSuppression ? (
        <Alert ton="danger" style={{ width: "100%" }}>
          {erreurSuppression}
        </Alert>
      ) : null}
    </div>
  );
}
