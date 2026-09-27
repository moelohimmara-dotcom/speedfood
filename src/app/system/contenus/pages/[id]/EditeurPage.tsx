"use client";

import { useActionState, useState } from "react";
import { modifierPageAction, type EtatActionContenu, type PageEditoriale } from "@/lib/system-admin/contenus";
import { Input, Button, Alert } from "@/components/ui";
import { BasculerPublicationPage } from "./BasculerPublicationPage";

const etatInitial: EtatActionContenu = {};

/**
 * Édition + aperçu mobile en direct (bloc 8c : « valider et prévisualiser sur
 * mobile »). L'aperçu reflète le texte en cours de frappe, pas seulement ce
 * qui est déjà enregistré — sinon ce ne serait pas un vrai aperçu avant
 * publication.
 */
export function EditeurPage({ page }: { page: PageEditoriale }) {
  const [etat, action, enCours] = useActionState(modifierPageAction, etatInitial);
  const [titre, setTitre] = useState(page.titre);
  const [contenu, setContenu] = useState(page.contenu);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-5)" }}>
      <form action={action}>
        <input type="hidden" name="id" value={page.id} />
        <Input
          label="Titre"
          name="titre"
          type="text"
          required
          maxLength={200}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
        />
        <div className="field">
          <label htmlFor="contenu">Contenu</label>
          <textarea
            id="contenu"
            name="contenu"
            rows={8}
            maxLength={20000}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
          />
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Modifications enregistrées.</Alert> : null}
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <div style={{ marginTop: "var(--space-4)" }}>
          <BasculerPublicationPage id={page.id} publie={page.statut === "publie"} />
        </div>
      </form>

      <div
        style={{
          maxWidth: 360,
          margin: "0 auto",
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
          background: "var(--creme)",
        }}
      >
        <p style={{ fontSize: "0.75rem", color: "var(--secondaire)", marginBottom: "var(--space-2)" }}>
          Aperçu mobile (375px)
        </p>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "var(--space-2)" }}>{titre}</h3>
        <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--encre)" }}>
          {contenu || <span style={{ color: "var(--secondaire)" }}>(contenu vide)</span>}
        </div>
      </div>
    </div>
  );
}
