"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changerReglageEspecesAction } from "@/lib/system-admin/remboursement-decisions";
import type { LigneJournalReglage } from "@/lib/paiement/en-ligne/remboursement-lecture";
import { Alert, Button } from "@/components/ui";
import { Panneau } from "@/components/admin/blocs";
import { useNotification } from "@/components/console/ConsoleProviders";

/**
 * Réglage de plateforme « remboursement en espèces autorisé » : désactivé par défaut (règle produit du 3 novembre : pas d'espèces). Le serveur
 * refuse un remboursement en espèces tant que le réglage est faux, même si cette page est modifiée. Chaque changement est journalisé.
 */
export function ReglageEspeces({ autorise, journal }: { autorise: boolean; journal: LigneJournalReglage[] }) {
  const router = useRouter();
  const notifier = useNotification();
  const [motif, setMotif] = useState("");
  const [enCours, demarrer] = useTransition();
  const cible = !autorise;

  function changer() {
    demarrer(async () => {
      const r = await changerReglageEspecesAction(cible, motif);
      if (r.erreur) notifier("erreur", r.erreur);
      else if (r.succes) {
        notifier("succes", r.succes);
        setMotif("");
      }
      router.refresh();
    });
  }

  return (
    <Panneau titre="Remboursement en espèces">
      <Alert ton="info" className="u-mb-s2">
        Règle produit : Speedfood ne manipule pas d&apos;espèces. Ce réglage est <strong>{autorise ? "activé" : "désactivé"}</strong>.{" "}
        {autorise ? "Un super administrateur peut enregistrer un remboursement en espèces, en dernier recours, avec la référence de l'avis juridique." : "Aucun remboursement en espèces ne peut être enregistré, ni proposé."}
      </Alert>
      <label htmlFor="reglage-especes-motif">Motif du changement (obligatoire)</label>
      <input id="reglage-especes-motif" type="text" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} autoComplete="off" />
      <div className="u-mt-s2">
        <Button type="button" variante="secondary" disabled={enCours || motif.trim().length < 5} onClick={changer}>
          {cible ? "Autoriser les remboursements en espèces" : "Interdire les remboursements en espèces"}
        </Button>
      </div>
      <h3 className="u-mt-s4">Derniers changements</h3>
      {journal.length === 0 ? (
        <p className="ad-secondaire">Aucun changement depuis la création du réglage.</p>
      ) : (
        <ul className="dossier-remb-liste">
          {journal.map((l) => (
            <li key={`${l.le}-${l.motif}`}>
              {l.le.slice(0, 16).replace("T", " ")} UTC : {l.nouvelleValeur ? "autorisé" : "interdit"} — {l.motif}
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  );
}
