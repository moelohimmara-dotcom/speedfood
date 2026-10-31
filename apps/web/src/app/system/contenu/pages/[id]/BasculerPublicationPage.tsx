"use client";

import { useTransition } from "react";
import { basculerPublicationPageAction } from "@/lib/system-admin/contenus";
import { Button } from "@/components/ui";

/** `indisponible` : explication d'un palier insuffisant (bouton désactivé ; le serveur refuse de toute façon). */
export function BasculerPublicationPage({ id, publie, indisponible }: { id: string; publie: boolean; indisponible?: string }) {
  const [enTransition, demarrerTransition] = useTransition();

  const bouton = (
    <Button
      type="button"
      variante={publie ? "secondary" : "primary"}
      disabled={enTransition || Boolean(indisponible)}
      aria-describedby={indisponible ? `publication-${id}-limite` : undefined}
      onClick={() => demarrerTransition(() => basculerPublicationPageAction(id, !publie))}
    >
      {publie ? "Dépublier" : "Publier"}
    </Button>
  );
  if (!indisponible) return bouton;
  return (
    <>
      {bouton}
      <p className="ad-palier-note" id={`publication-${id}-limite`}>
        {indisponible}
      </p>
    </>
  );
}
