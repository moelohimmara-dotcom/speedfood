"use client";

import { useActionState, useState, useTransition } from "react";
import {
  modifierPlatAction,
  basculerDisponibiliteAction,
  archiverPlatAction,
  type EtatFormulaireMenu,
} from "@/lib/menu/actions";
import { Card, Badge, Button, Input, Alert } from "@/components/ui";

interface Plat {
  id: string;
  nom: string;
  description: string;
  prix: number;
  disponible: boolean;
}

const etatInitial: EtatFormulaireMenu = {};

export function PlatItem({ plat }: { plat: Plat }) {
  const [enEdition, setEnEdition] = useState(false);
  const [etat, action, enCours] = useActionState(modifierPlatAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();

  if (enEdition) {
    return (
      <Card>
        <form
          action={(formData) => {
            action(formData);
            setEnEdition(false);
          }}
        >
          <input type="hidden" name="id" value={plat.id} />
          <Input label="Nom du plat" name="nom" type="text" required maxLength={120} defaultValue={plat.nom} />
          <Input
            label="Description"
            name="description"
            type="text"
            maxLength={500}
            defaultValue={plat.description}
          />
          <Input
            label="Prix (GNF)"
            name="prix"
            type="number"
            min={0}
            max={5_000_000}
            step={1}
            required
            defaultValue={plat.prix}
          />
          {etat.erreur ? (
            <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
              {etat.erreur}
            </Alert>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variante="secondary" onClick={() => setEnEdition(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <strong>{plat.nom}</strong>
          <Badge ton={plat.disponible ? "succes" : "neutre"}>
            {plat.disponible ? "Disponible" : "Indisponible"}
          </Badge>
        </div>
        {plat.description ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>{plat.description}</p>
        ) : null}
        <p style={{ margin: 0, fontWeight: 700 }}>{plat.prix.toLocaleString("fr-FR")} GNF</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
        <Button
          type="button"
          variante="secondary"
          disabled={enTransition}
          onClick={() =>
            demarrerTransition(() => {
              basculerDisponibiliteAction(plat.id, !plat.disponible);
            })
          }
        >
          {plat.disponible ? "Marquer indisponible" : "Marquer disponible"}
        </Button>
        <Button type="button" variante="secondary" onClick={() => setEnEdition(true)}>
          Modifier
        </Button>
        <Button
          type="button"
          variante="danger"
          disabled={enTransition}
          onClick={() => {
            if (confirm(`Archiver « ${plat.nom} » ? Ce plat ne sera plus visible dans votre menu.`)) {
              demarrerTransition(() => {
                archiverPlatAction(plat.id);
              });
            }
          }}
        >
          Archiver
        </Button>
      </div>
    </Card>
  );
}
