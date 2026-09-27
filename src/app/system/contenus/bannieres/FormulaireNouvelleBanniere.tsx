"use client";

import { useActionState, useRef, useEffect } from "react";
import { creerBanniereAction, type EtatActionContenu } from "@/lib/system-admin/contenus";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatActionContenu = {};

export function FormulaireNouvelleBanniere() {
  const [etat, action, enCours] = useActionState(creerBanniereAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) {
      formRef.current?.reset();
    }
  }, [etat]);

  return (
    <form action={action} ref={formRef}>
      <Input label="Titre" name="titre" type="text" required maxLength={200} />
      <Input label="Texte" name="texte" type="text" maxLength={500} />
      <Input label="Lien (optionnel)" name="lien" type="text" placeholder="/restaurants" />
      <Input label="Ordre d'affichage" name="ordre" type="number" defaultValue={0} />
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer la bannière (brouillon)"}
      </Button>
    </form>
  );
}
