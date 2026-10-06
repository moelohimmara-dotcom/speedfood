"use client";

import { useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
// Variante sans import externe : la feuille par défaut charge https://rsms.me/inter/inter.css (police Inter), ce que la politique de sécurité interdit.
import "@puckeditor/core/no-external.css";
import { configBlocs, donneesExemple } from "@/lib/studio/blocs/config";

/** Éditeur Puck (navigateur seulement, importé en différé). Rien n'est enregistré : l'état est affiché en JSON à la demande. */
export default function Editeur() {
  const [donnees, setDonnees] = useState<Data>(donneesExemple);
  const [json, setJson] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <button type="button" className="btn" onClick={() => setJson((v) => !v)} aria-expanded={json}>
          {json ? "Masquer le JSON" : "Afficher le JSON"}
        </button>
      </div>
      {json && (
        <pre data-testid="json-etat" style={{ overflow: "auto", maxHeight: 240, background: "var(--surface)", padding: "var(--space-3)" }}>
          {JSON.stringify(donnees, null, 2)}
        </pre>
      )}
      <div style={{ height: "80vh" }}>
        <Puck config={configBlocs} data={donnees} onChange={setDonnees} onPublish={setDonnees} />
      </div>
    </div>
  );
}
