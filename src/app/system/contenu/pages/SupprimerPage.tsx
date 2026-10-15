"use client";

import { useState, useTransition } from "react";
import { supprimerPageAction } from "@/lib/system-admin/contenus";
import { Alert, Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

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
  const confirmer = useConfirmation();
  const notifier = useNotification();

  return (
    <span style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="danger"
        className="ad-action-discrete"
        disabled={enTransition || Boolean(indisponible)}
        aria-describedby={indisponible ? `page-${id}-limite` : undefined}
        onClick={async () => {
          const reponse = await confirmer({
            titre: `Supprimer la page « ${titre} » ?`,
            message: <p>{statut === "publie" ? "Elle est en ligne : son adresse ne fonctionnera plus. " : ""}Cette action est définitive.</p>,
            libelleAction: "Supprimer",
            danger: true,
          });
          if (!reponse.confirme) return;
          setErreur(null);
          demarrerTransition(async () => {
            try {
              const resultat = await supprimerPageAction(id);
              if (resultat.erreur) setErreur(resultat.erreur);
              else notifier("succes", `La page « ${titre} » a été supprimée.`);
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "Une erreur inattendue s'est produite. Rafraîchissez la page.");
            }
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
