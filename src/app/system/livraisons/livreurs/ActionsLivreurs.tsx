"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { basculerLivreurAction, creerLivreursDemoAction, supprimerLivreursDemoAction, type EtatActionLivraisonAdmin } from "@/lib/system-admin/livraisons";
import { Alert, Button } from "@/components/ui";

/** Création et suppression des livreurs de démonstration. */
export function ActionsLivreurs({ nombreSimules }: { nombreSimules: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<EtatActionLivraisonAdmin | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(travail: () => Promise<EtatActionLivraisonAdmin>) {
    setMessage(null);
    demarrer(async () => {
      setMessage(await travail());
      router.refresh();
    });
  }

  return (
    <div className="livraison-actions" style={{ marginBottom: "var(--space-4)" }}>
      <Button type="button" disabled={enCours} onClick={() => lancer(creerLivreursDemoAction)}>
        Créer 3 livreurs de démonstration
      </Button>
      {nombreSimules > 0 ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(supprimerLivreursDemoAction)}>
          Supprimer les livreurs de démonstration libres
        </Button>
      ) : null}
      {message?.erreur ? <Alert ton="danger">{message.erreur}</Alert> : null}
      {message?.succes ? <p className="ad-secondaire" role="status">{message.succes}</p> : null}
    </div>
  );
}

/** Mettre un livreur en ligne ou hors ligne. */
export function BoutonLivreur({ livreurId, nom, enLigne }: { livreurId: string; nom: string; enLigne: boolean }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Button
        type="button"
        variante="secondary"
        disabled={enCours}
        aria-label={`${enLigne ? "Mettre hors ligne" : "Mettre en ligne"} ${nom}`}
        onClick={() =>
          demarrer(async () => {
            const r = await basculerLivreurAction(livreurId, !enLigne);
            setErreur(r.erreur ?? null);
            router.refresh();
          })
        }
      >
        {enLigne ? "Mettre hors ligne" : "Mettre en ligne"}
      </Button>
      {erreur ? <p className="field-error">{erreur}</p> : null}
    </>
  );
}
