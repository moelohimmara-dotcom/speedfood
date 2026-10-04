"use client";

import { useState } from "react";
import { PALETTE_MARQUE } from "@/lib/design/paletteMarque";

/**
 * Palette fermée (pas d'`<input type="color">`) : chaque teinte est déjà
 * vérifiée en contraste AA — voir src/lib/design/paletteMarque.ts. Purement
 * décorative sur l'affichage public (liseré de carte, cadre de photo).
 */
export function SelecteurCouleur({ valeurInitiale }: { valeurInitiale: string | null }) {
  const [selection, setSelection] = useState<string | null>(valeurInitiale);

  return (
    <div>
      <input type="hidden" name="couleur_accent" value={selection ?? ""} />
      <div
        role="group"
        aria-label="Couleur d'accent"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <button
          type="button"
          onClick={() => setSelection(null)}
          aria-pressed={selection === null}
          title="Aucune couleur d'accent"
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-pill)",
            border: selection === null ? "2px solid var(--encre)" : "1px solid var(--bordure)",
            background: "var(--surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            color: "var(--secondaire)",
          }}
        >
          ✕
        </button>
        {PALETTE_MARQUE.map((couleur) => (
          <button
            key={couleur.valeur}
            type="button"
            onClick={() => setSelection(couleur.valeur)}
            aria-label={couleur.nom}
            aria-pressed={selection === couleur.valeur}
            title={couleur.nom}
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-pill)",
              border:
                selection === couleur.valeur ? "2px solid var(--encre)" : "1px solid var(--bordure)",
              background: couleur.valeur,
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
