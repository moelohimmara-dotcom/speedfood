"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reprendreVersementsAction, trancherLitigeAction, type EtatActionPaiementAdmin } from "@/lib/system-admin/paiements";
import { Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

interface Props {
  paiementId: string;
  etat: string;
  versementsEnAttente: boolean;
  litigeAHumain: string | null;
}

/** Actions d'une ligne de paiement : reprendre des versements, ou trancher un litige confié à un humain (motif obligatoire). */
export function ActionsPaiement({ paiementId, etat, versementsEnAttente, litigeAHumain }: Props) {
  const router = useRouter();
  const notifier = useNotification();
  const [motif, setMotif] = useState("");
  const [enCours, demarrer] = useTransition();

  function lancer(travail: () => Promise<EtatActionPaiementAdmin>) {
    demarrer(async () => {
      const r = await travail();
      if (r.erreur) notifier("erreur", r.erreur);
      else if (r.succes) {
        notifier("succes", r.succes);
        setMotif("");
      }
      router.refresh();
    });
  }

  const rien = !(etat === "libere" && versementsEnAttente) && !litigeAHumain;
  if (rien) return <span className="ad-secondaire">—</span>;

  return (
    <div className="paiement-admin-actions">
      {etat === "libere" && versementsEnAttente ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => reprendreVersementsAction(paiementId))}>
          Reprendre les versements
        </Button>
      ) : null}
      {litigeAHumain ? (
        <>
          <label className="sr-only" htmlFor={`motif-${litigeAHumain}`}>
            Motif de la décision
          </label>
          <input id={`motif-${litigeAHumain}`} type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de la décision" maxLength={300} />
          <div className="paiement-admin-boutons">
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => trancherLitigeAction(paiementId, litigeAHumain, "rembourser", motif))}>
              Rembourser le client
            </Button>
            <Button type="button" disabled={enCours} onClick={() => lancer(() => trancherLitigeAction(paiementId, litigeAHumain, "liberer", motif))}>
              Libérer l&apos;argent
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
