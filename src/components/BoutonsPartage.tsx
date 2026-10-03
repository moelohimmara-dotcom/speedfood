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
  /**
   * `boutons` (défaut) : boutons secondaires, pour les endroits où le partage EST l'action —
   * la console restaurateur, « Votre lien et votre QR code ».
   *
   * `liens` : actions de texte discrètes avec icône, pour la fiche publique. Le partage y
   * reste visible sur téléphone (la colonne de droite y est masquée) mais ne doit pas
   * concurrencer le parcours de commande avec deux gros boutons.
   */
  variante?: "boutons" | "liens";
}

/** Icône de partage : flèche sortant d'un plateau. Famille du design system (grille 24, tracé 2). */
function IconePartage() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
      <path d="M12 3v11" />
      <path d="M8 7l4-4 4 4" />
    </svg>
  );
}

/** Icône de copie : deux feuillets superposés. */
function IconeLien() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </svg>
  );
}

/**
 * « Partager sur WhatsApp » (la personne choisit le destinataire et envoie elle-même) et
 * « Copier le lien ». Rien n'est envoyé par Speedfood.
 */
export function BoutonsPartage({ texte, url, compact = false, variante = "boutons" }: Props) {
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

  const libelleCopie = copie === "oui" ? "Lien copié" : copie === "echec" ? "Copie impossible" : "Copier le lien";

  if (variante === "liens") {
    return (
      <span className="partage-liens">
        <a href={lienWhatsApp(texte)} target="_blank" rel="noopener noreferrer" className="partage-lien">
          <IconePartage />
          Partager sur WhatsApp
        </a>
        <button type="button" onClick={copier} className="partage-lien">
          <IconeLien />
          {libelleCopie}
        </button>
      </span>
    );
  }

  const classe = compact ? "btn btn-secondary btn-compact" : "btn btn-secondary";
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <a href={lienWhatsApp(texte)} target="_blank" rel="noopener noreferrer" className={classe}>
        Partager sur WhatsApp
      </a>
      <button type="button" onClick={copier} className={classe}>
        {libelleCopie}
      </button>
    </span>
  );
}
