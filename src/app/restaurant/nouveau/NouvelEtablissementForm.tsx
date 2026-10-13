"use client";

import { useActionState } from "react";
import { creerEtablissementAction, type EtatFormulaire } from "@/lib/auth/actions";
import { Button, Alert } from "@/components/ui";
import type { GroupeCommune } from "@/lib/geographie/quartiers";

const etatInitial: EtatFormulaire = {};

interface Option {
  id: string;
  nom: string;
}

export function NouvelEtablissementForm({
  categories,
  groupes,
}: {
  categories: Option[];
  groupes: GroupeCommune[];
}) {
  const [etat, action, enCours] = useActionState(creerEtablissementAction, etatInitial);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="nom">Nom de l&apos;établissement</label>
        <input id="nom" name="nom" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="categorie_id">Catégorie</label>
        <select id="categorie_id" name="categorie_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="quartier_id">Quartier</label>
        <select id="quartier_id" name="quartier_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {groupes.map((groupe) => (
            <optgroup key={groupe.communeId} label={groupe.communeNom}>
              {groupe.quartiers.map((quartier) => (
                <option key={quartier.id} value={quartier.id}>
                  {quartier.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Création…" : "Créer mon établissement"}
      </Button>
    </form>
  );
}
