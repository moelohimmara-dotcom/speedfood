"use client";

import { useActionState, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import {
  enregistrerCommuneAction,
  enregistrerQuartierAction,
  type CommuneSysteme,
  type EtatGeographie,
  type QuartierSysteme,
} from "@/lib/system-admin/geographie";

const etatInitial: EtatGeographie = {};

/** Une commune : nom, activation. Désactiver retire la commune des choix, sans rien supprimer. */
export function FormulaireCommuneSysteme({ commune }: { commune: CommuneSysteme }) {
  const [etat, action, enCours] = useActionState(enregistrerCommuneAction, etatInitial);

  return (
    <form action={action} className="geo-ligne">
      <input type="hidden" name="id" value={commune.id} />
      <input
        name="nom"
        defaultValue={commune.nom}
        required
        minLength={2}
        maxLength={80}
        aria-label={`Nom de la commune ${commune.nom}`}
      />
      <label className="geo-case">
        <input type="checkbox" name="actif" defaultChecked={commune.actif} /> Active
      </label>
      {commune.codeOfficiel ? <span className="geo-code">{commune.codeOfficiel}</span> : null}
      <button type="submit" className="btn btn-secondary" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
      {etat.erreur ? <span role="alert" className="geo-erreur">{etat.erreur}</span> : null}
    </form>
  );
}

/** Un quartier existant (avec `quartier`) ou la création d'un nouveau (sans `quartier`). */
export function FormulaireQuartierSysteme({
  quartier,
  communes,
}: {
  quartier?: QuartierSysteme;
  communes: CommuneSysteme[];
}) {
  const [etat, action, enCours] = useActionState(enregistrerQuartierAction, etatInitial);
  const [communeId, setCommuneId] = useState(quartier?.communeId ?? "");
  const libelleNom = quartier ? `Nom du quartier ${quartier.nom}` : "Nom du nouveau quartier";

  return (
    <form action={action} className="geo-ligne">
      {quartier ? <input type="hidden" name="id" value={quartier.id} /> : null}
      <input
        name="nom"
        defaultValue={quartier?.nom ?? ""}
        required
        minLength={2}
        maxLength={80}
        placeholder="Nom du quartier"
        aria-label={libelleNom}
      />
      <div className="geo-commune">
        <ListeChoix
          nom="commune_id"
          options={communes.map((c) => ({ valeur: c.id, libelle: c.actif ? c.nom : `${c.nom} (inactive)` }))}
          valeur={communeId}
          onChange={setCommuneId}
          placeholder="Commune…"
          libelleAccessible="Commune du quartier"
        />
      </div>
      <label className="geo-case">
        <input type="checkbox" name="actif" defaultChecked={quartier ? quartier.actif : true} /> Actif
      </label>
      <button type="submit" className="btn btn-secondary" disabled={enCours}>
        {enCours ? "Enregistrement…" : quartier ? "Enregistrer" : "Ajouter"}
      </button>
      {etat.erreur ? <span role="alert" className="geo-erreur">{etat.erreur}</span> : null}
    </form>
  );
}
