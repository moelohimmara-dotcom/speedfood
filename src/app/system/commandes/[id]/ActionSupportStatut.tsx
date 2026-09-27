"use client";

import { useActionState } from "react";
import {
  changerStatutSupportAction,
  type EtatActionCommandeSupport,
} from "@/lib/system-admin/commandes";
import { STATUTS_COMMANDE, transitionAutorisee, type StatutCommande } from "@/lib/contracts/statuts";
import { Button, Alert } from "@/components/ui";

const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

const etatInitial: EtatActionCommandeSupport = {};

export function ActionSupportStatut({
  commandeId,
  statutActuel,
}: {
  commandeId: string;
  statutActuel: StatutCommande;
}) {
  const [etat, action, enCours] = useActionState(changerStatutSupportAction, etatInitial);
  const statutsPossibles = STATUTS_COMMANDE.filter((s) => transitionAutorisee(statutActuel, s));

  if (statutsPossibles.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--secondaire)" }}>
        Aucune transition possible depuis « {LIBELLES_STATUT[statutActuel]} ».
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="commande_id" value={commandeId} />
      <div className="field">
        <label htmlFor="vers_statut">Nouveau statut</label>
        <select id="vers_statut" name="vers_statut" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {statutsPossibles.map((s) => (
            <option key={s} value={s}>
              {LIBELLES_STATUT[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="motif-support">Motif de l&apos;intervention</label>
        <textarea id="motif-support" name="motif" rows={2} maxLength={500} required />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Transition appliquée et journalisée.</Alert> : null}
      <Button type="submit" variante="danger" disabled={enCours}>
        {enCours ? "Application…" : "Appliquer la transition"}
      </Button>
    </form>
  );
}
