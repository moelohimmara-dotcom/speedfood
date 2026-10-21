"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { creerEtablissementDepuisDemandeAction, type EtatCreationEtablissement } from "@/lib/system-admin/referencements";

const etatInitial: EtatCreationEtablissement = {};

/** Création de la fiche d'un établissement accepté : catégorie et quartier choisis dans les listes officielles ; l'établissement est créé NON publié. */
export function CreationEtablissement({
  demandeId,
  categories,
  groupes,
  categorieProposee,
}: {
  demandeId: string;
  categories: { id: string; nom: string }[];
  groupes: GroupeCommune[];
  categorieProposee: string | null;
}) {
  const [etat, action, enCours] = useActionState(creerEtablissementDepuisDemandeAction, etatInitial);
  return (
    <form action={action} className="referencement-admin-creation">
      <input type="hidden" name="demande_id" value={demandeId} />
      <div className="field">
        <label htmlFor={`categorie-${demandeId}`}>Catégorie</label>
        <select id={`categorie-${demandeId}`} name="categorie_id" required defaultValue={categorieProposee ?? ""}>
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
      <SelecteurQuartier nom="quartier_id" groupes={groupes} quartierInitial={null} />
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer l'établissement (non publié)"}
      </Button>
    </form>
  );
}
