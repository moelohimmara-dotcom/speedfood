"use client";

import { Button } from "@/components/ui";

/** Ouvre la fenêtre d'impression du navigateur : l'affiche est la seule chose qui s'imprime (voir `affiche.css`). */
export function BoutonImprimer() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Imprimer l&apos;affiche (A4)
    </Button>
  );
}
