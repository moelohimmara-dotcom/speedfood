"use client";

import { useTransition } from "react";
import { basculerPublicationPageAction } from "@/lib/system-admin/contenus";
import { Button } from "@/components/ui";

export function BasculerPublicationPage({ id, publie }: { id: string; publie: boolean }) {
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <Button
      type="button"
      variante={publie ? "secondary" : "primary"}
      disabled={enTransition}
      onClick={() => demarrerTransition(() => basculerPublicationPageAction(id, !publie))}
    >
      {publie ? "Dépublier" : "Publier"}
    </Button>
  );
}
