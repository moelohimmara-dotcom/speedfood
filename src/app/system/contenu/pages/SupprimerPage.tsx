"use client";

import { useState, useTransition } from "react";
import { supprimerPageAction } from "@/lib/system-admin/contenus";
import { Alert, Button } from "@/components/ui";

/**
 * Suppression d'une page depuis sa liste : confirmation nommée (une page publiée perd son
 * adresse publique), puis action serveur journalisée. `indisponible` porte l'explication d'un
 * palier insuffisant — le bouton reste visible et désactivé, le serveur refuse de toute façon.
 */
export function SupprimerPage({
  id,
  titre,
  statut,
  indisponible,
}: {
  id: string;
  titre: string;
  statut: "brouillon" | "publie";
  indisponible?: string;
}) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="danger"
        className="ad-action-discrete"
        disabled={enTransition || Boolean(indisponible)}
        aria-describedby={indisponible ? `page-${id}-limite` : undefined}
        onClick={() => {
          const enLigne = statut === "publie" ? " Elle est en ligne : son adresse ne fonctionnera plus." : "";
          if (!confirm(`Supprimer la page « ${titre} » ?${enLigne} Cette action est définitive.`)) return;
          setErreur(null);
          demarrerTransition(async () => {
            const resultat = await supprimerPageAction(id);
            if (resultat.erreur) setErreur(resultat.erreur);
          });
        }}
      >
        {enTransition ? "Suppression…" : "Supprimer"}
      </Button>
      {indisponible ? (
        <span className="ad-palier-note" id={`page-${id}-limite`}>
          {indisponible}
        </span>
      ) : null}
    </span>
  );
}
