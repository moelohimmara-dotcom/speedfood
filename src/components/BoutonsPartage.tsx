"use client";

import { useState } from "react";
import { lienWhatsApp } from "@/lib/partage/liens";

interface Props {
  /** Texte prérempli pour WhatsApp (contient déjà le lien Speedfood). */
  texte: string;
  /** Lien absolu à copier. */
  url: string;
  /** Variante compacte pour une ligne de menu. */
  compact?: boolean;
}

/**
 * « Partager sur WhatsApp » (la personne choisit le destinataire et envoie elle-même) et
 * « Copier le lien ». Rien n'est envoyé par Speedfood.
 */
export function BoutonsPartage({ texte, url, compact = false }: Props) {
  const [copie, setCopie] = useState<"non" | "oui" | "echec">("non");

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie("oui");
    } catch {
      setCopie("echec");
    }
    setTimeout(() => setCopie("non"), 3000);
  }

  const classe = compact ? "btn btn-secondary btn-compact" : "btn btn-secondary";
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <a href={lienWhatsApp(texte)} target="_blank" rel="noopener noreferrer" className={classe}>
        Partager sur WhatsApp
      </a>
      <button type="button" onClick={copier} className={classe}>
        {copie === "oui" ? "Lien copié" : copie === "echec" ? "Copie impossible" : "Copier le lien"}
      </button>
    </span>
  );
}
