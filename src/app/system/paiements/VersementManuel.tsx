"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marquerVersementEffectueAction, revelerNumeroVersementAction } from "@/lib/system-admin/paiements";
import { Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

interface Props {
  versementId: string;
  beneficiaire: "restaurant" | "livreur";
  montantLibelle: string;
}

/**
 * Versement MANUEL (le prestataire ne verse pas automatiquement) : le super administrateur affiche le numéro du bénéficiaire (action
 * journalisée), verse depuis le compte du prestataire, puis déclare le versement avec sa référence. Le numéro n'est gardé ni dans la page
 * ni ailleurs : il disparaît au rafraîchissement.
 */
export function VersementManuel({ versementId, beneficiaire, montantLibelle }: Props) {
  const router = useRouter();
  const notifier = useNotification();
  const [numero, setNumero] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [enCours, demarrer] = useTransition();

  function reveler() {
    demarrer(async () => {
      const r = await revelerNumeroVersementAction(versementId);
      if (r.erreur) notifier("erreur", r.erreur);
      else setNumero(r.affichage ?? null);
    });
  }

  function declarer() {
    demarrer(async () => {
      const r = await marquerVersementEffectueAction(versementId, reference);
      if (r.erreur) notifier("erreur", r.erreur);
      else {
        notifier("succes", r.succes ?? "Versement enregistré.");
        setNumero(null);
        setReference("");
      }
      router.refresh();
    });
  }

  return (
    <div className="paiement-admin-actions">
      <p className="ad-secondaire u-d-block-fs-0-8rem">
        À verser à la main : {beneficiaire === "restaurant" ? "restaurant" : "livreur"}, {montantLibelle}
      </p>
      {numero ? <p className="paiement-numero">{numero}</p> : null}
      <Button type="button" variante="secondary" disabled={enCours} onClick={reveler}>
        Afficher le numéro
      </Button>
      <label className="sr-only" htmlFor={`ref-${versementId}`}>
        Référence du versement
      </label>
      <input id={`ref-${versementId}`} type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence du transfert" maxLength={80} autoComplete="off" />
      <Button type="button" disabled={enCours || reference.trim().length < 4} onClick={declarer}>
        Marquer versé
      </Button>
    </div>
  );
}
