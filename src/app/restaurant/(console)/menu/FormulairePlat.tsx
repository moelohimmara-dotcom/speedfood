"use client";

import { useActionState, useRef, useEffect } from "react";
import { creerPlatAction, type EtatFormulaireMenu } from "@/lib/menu/actions";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatFormulaireMenu = {};

export function FormulairePlat() {
  const [etat, action, enCours] = useActionState(creerPlatAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!etat.erreur) {
      formRef.current?.reset();
    }
  }, [etat]);

  return (
    <form action={action} ref={formRef}>
      <Input label="Nom du plat" name="nom" type="text" required maxLength={120} />
      <Input label="Description" name="description" type="text" maxLength={500} />
      <Input label="Prix (GNF)" name="prix" type="number" min={0} max={5_000_000} step={1} required />
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Ajout…" : "Ajouter le plat"}
      </Button>
    </form>
  );
}
