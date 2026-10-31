"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marquerPaieLivreurAction } from "@/lib/system-admin/paie-livreurs-actions";
import { Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

export function ActionsPaieLivreur({ versementId, montant }: { versementId: string; montant: number }) {
  const [reference, setReference] = useState("");
  const [enCours, demarrer] = useTransition();
  const notifier = useNotification();
  const router = useRouter();
  function envoyer() {
    demarrer(async () => {
      const resultat = await marquerPaieLivreurAction(versementId, reference);
      if (resultat.erreur) notifier("erreur", resultat.erreur);
      else { notifier("succes", resultat.succes ?? "Versement enregistré."); setReference(""); router.refresh(); }
    });
  }
  return <div className="paiement-admin-actions"><span className="ad-secondaire">Versement manuel simulé : {montant.toLocaleString("fr-FR")} GNF</span><label className="sr-only" htmlFor={`reference-paie-${versementId}`}>Référence du versement</label><input id={`reference-paie-${versementId}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence du transfert" maxLength={80} /><Button type="button" disabled={enCours || reference.trim().length < 4} onClick={envoyer}>Marquer versé</Button></div>;
}
