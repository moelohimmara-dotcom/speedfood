"use client";

import { Button } from "@/components/ui";

export function BoutonImprimerTables() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Imprimer les QR (A4)
    </Button>
  );
}
