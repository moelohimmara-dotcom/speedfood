"use client";

import { useActionState, useRef, useEffect } from "react";
import { creerPlatAction, type EtatFormulaireMenu } from "@/lib/menu/actions";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatFormulaireMenu = {};

interface Section {
  id: string;
  nom: string;
}

export function FormulairePlat({ sections = [] }: { sections?: Section[] }) {
  const [etat, action, enCours] = useActionState(creerPlatAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!etat.erreur) {
      formRef.current?.reset();
    }
  }, [etat]);

  return (
    <form action={action} ref={formRef}>
      <div className="field depot-photo">
        <label htmlFor="photo">Photo du plat</label>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          JPEG, PNG ou WebP, 5 Mo maximum. Facultatif.
        </p>
      </div>
      <Input label="Nom du plat" name="nom" type="text" required maxLength={120} />
      <Input label="Description" name="description" type="text" maxLength={500} />
      <div className="champs-ligne">
        <Input label="Prix (GNF)" name="prix" type="number" min={0} max={5_000_000} step={1} required />
        <div className="field">
          <label htmlFor="prix_promo">Prix promo (GNF)</label>
          <input id="prix_promo" name="prix_promo" type="number" min={0} step={1} />
        </div>
      </div>
      <p className="aide-champ">Prix promo : facultatif, inférieur ou égal au prix normal. Laissez vide pour ne pas proposer de promo.</p>
      {sections.length > 0 ? (
        <div className="field">
          <label htmlFor="section_id">Section du menu</label>
          <select id="section_id" name="section_id" defaultValue="">
            <option value="">Aucune section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.nom}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Ajout…" : "Ajouter le plat"}
      </Button>
    </form>
  );
}
