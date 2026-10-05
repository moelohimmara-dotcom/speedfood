"use client";

import { useState } from "react";

/**
 * Actions du reçu, toutes facultatives et choisies par le client : imprimer ou enregistrer en PDF (fenêtre d'impression du
 * navigateur), partager par WhatsApp (message prêt, la personne choisit le destinataire et envoie elle-même), copier le lien.
 */
export function ActionsRecu({ lienWhatsApp, lien }: { lienWhatsApp: string; lien: string }) {
  const [message, setMessage] = useState("");

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setMessage("Lien copié.");
    } catch {
      setMessage("Copie impossible : sélectionnez l'adresse de la page.");
    }
  }

  return (
    <div className="recu-actions">
      <a href={lienWhatsApp} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
        Envoyer sur WhatsApp
      </a>
      <button type="button" className="btn btn-secondary" onClick={copier}>
        Copier le lien
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
        Imprimer ou enregistrer en PDF
      </button>
      <p role="status" style={{ flexBasis: "100%", margin: 0, color: "var(--secondaire)", fontSize: "0.85rem" }}>
        {message}
      </p>
    </div>
  );
}
