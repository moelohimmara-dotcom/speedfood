"use client";

import { useState, useTransition } from "react";
import { definirServiceATableAction } from "@/lib/restaurant/tables-actions";
import { Alert, Button } from "@/components/ui";

export function BasculeServiceTable({ actif }: { actif: boolean }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div>
      <p style={{ margin: "0 0 var(--space-2)" }}>
        Service à table : <strong>{actif ? "activé" : "désactivé"}</strong>
      </p>
      <p className="ad-aide-champ" style={{ margin: "0 0 var(--space-3)" }}>
        {actif
          ? "Vos clients qui scannent un QR de table peuvent commander à leur table. Le désactiver bloque aussitôt ces commandes, même avec des QR déjà imprimés."
          : "Activez-le pour que le QR d'une table ouvre votre menu avec le numéro de table déjà choisi."}
      </p>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante={actif ? "secondary" : "primary"}
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          demarrer(async () => {
            const r = await definirServiceATableAction(!actif);
            if (!r.ok) setErreur(r.erreur ?? "Enregistrement impossible.");
          });
        }}
      >
        {enCours ? "Enregistrement…" : actif ? "Désactiver le service à table" : "Activer le service à table"}
      </Button>
    </div>
  );
}
