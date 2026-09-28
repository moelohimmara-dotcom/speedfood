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
      <div className="field">
        <label htmlFor="photo">Photo du plat</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          JPEG, PNG ou WebP, 5 Mo maximum. Facultatif.
        </p>
      </div>
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
