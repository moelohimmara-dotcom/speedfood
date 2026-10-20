"use client";

import { useActionState, useRef } from "react";
import { ajouterAdresseAction, type EtatEspaceClient } from "@/lib/client/actions-espace";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatEspaceClient = {};

/** Ajout d'une adresse au carnet : un nom court et l'adresse telle qu'on la dicterait à un livreur. */
export function FormulaireAdresse() {
  const formulaire = useRef<HTMLFormElement>(null);
  const [etat, action, enCours] = useActionState(async (precedent: EtatEspaceClient, donnees: FormData) => {
    const r = await ajouterAdresseAction(precedent, donnees);
    if (r.succes) formulaire.current?.reset();
    return r;
  }, etatInitial);

  return (
    <form ref={formulaire} action={action} className="espace-formulaire">
      <div className="field">
        <label htmlFor="adr-libelle">Nom de l&apos;adresse</label>
        <input id="adr-libelle" name="libelle" required minLength={2} maxLength={30} placeholder="Maison, Travail…" autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="adr-adresse">Adresse</label>
        <textarea id="adr-adresse" name="adresse" required minLength={5} maxLength={300} rows={3} placeholder="Quartier, rue, point de repère (à côté de…)" />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Ajouter cette adresse"}
      </Button>
    </form>
  );
}
