"use client";

import { useActionState, useRef, useEffect } from "react";
import { creerPageAction, type EtatActionContenu } from "@/lib/system-admin/contenus";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatActionContenu = {};

export function FormulaireNouvellePage() {
  const [etat, action, enCours] = useActionState(creerPageAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) {
      formRef.current?.reset();
    }
  }, [etat]);

  return (
    <form action={action} ref={formRef}>
      <Input label="Slug (URL)" name="slug" type="text" required maxLength={100} placeholder="comment-commander" />
      <Input label="Titre" name="titre" type="text" required maxLength={200} />
      <div className="field">
        <label htmlFor="contenu">Contenu</label>
        <textarea id="contenu" name="contenu" rows={4} maxLength={20000} />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer la page (brouillon)"}
      </Button>
    </form>
  );
}
