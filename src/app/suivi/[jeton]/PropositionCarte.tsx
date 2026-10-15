"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PropositionRevisee } from "@/lib/contracts/commande";
import { repondrePropositionAction } from "@/lib/commande/actions";
import { repondrePropositionSessionAction } from "@/lib/commande/actions-session";
import { Button, Card, Alert } from "@/components/ui";
import { useConfirmation } from "@/components/console/ConsoleProviders";

interface Props {
  jeton?: string;
  session?: boolean;
  proposition: PropositionRevisee;
  sousTotalInitial: number;
  fraisInitial: number;
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Proposition révisée du restaurant, avec réponse du client (accepter/refuser).
 * Réponse idempotente : rejouer la même réponse ne change rien ; seule la
 * version courante est acceptée (côté serveur, lib/commande/propositions.ts).
 */
export function PropositionCarte({ jeton, session = false, proposition, sousTotalInitial, fraisInitial }: Props) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const confirmer = useConfirmation();

  const totalInitial = sousTotalInitial + fraisInitial;
  const totalPropose = proposition.nouveauSousTotal + proposition.nouveauxFraisLivraison;

  async function repondre(reponse: "acceptee" | "refusee") {
    if (reponse === "refusee") {
      const choix = await confirmer({
        titre: "Refuser cette modification ?",
        message: <p>Refuser annule votre commande. Voulez-vous continuer ?</p>,
        libelleAction: "Refuser et annuler",
        danger: true,
      });
      if (!choix.confirme) {
        return;
      }
    }
    setErreur(null);
    demarrer(async () => {
      const resultat = session
        ? await repondrePropositionSessionAction(proposition.id, reponse)
        : jeton
          ? await repondrePropositionAction(jeton, proposition.id, reponse)
          : { ok: false as const, erreur: { code: "INTROUVABLE" as const, message: "Lien de suivi introuvable." } };
      if (!resultat.ok) {
        setErreur(resultat.erreur.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card style={{ marginTop: "var(--space-4)", border: "2px solid var(--orange)" }}>
      <p style={{ marginTop: 0, fontWeight: 700, fontSize: "1.1rem" }}>
        Le restaurant propose une modification
      </p>
      <p style={{ margin: "0 0 var(--space-3)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
        Votre commande reste en attente : elle ne sera ni préparée ni confirmée tant que vous n&apos;avez
        pas accepté cette version. Si vous refusez, ou si personne ne répond avant l&apos;échéance,
        la commande est annulée sans frais.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-3)" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 0" }}> </th>
            <th style={{ textAlign: "right", padding: "4px 0" }}>Votre commande</th>
            <th style={{ textAlign: "right", padding: "4px 0" }}>Proposé</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "4px 0" }}>Sous-total</td>
            <td style={{ textAlign: "right" }}>{formaterGNF(sousTotalInitial)}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>
              {formaterGNF(proposition.nouveauSousTotal)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 0" }}>Frais de livraison</td>
            <td style={{ textAlign: "right" }}>{formaterGNF(fraisInitial)}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>
              {formaterGNF(proposition.nouveauxFraisLivraison)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px 0", fontWeight: 700 }}>Total</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formaterGNF(totalInitial)}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formaterGNF(totalPropose)}</td>
          </tr>
        </tbody>
      </table>

      {proposition.conditionsModifiees ? (
        <p style={{ margin: "0 0 var(--space-3)" }}>
          <strong>Conditions proposées : </strong>
          {proposition.conditionsModifiees}
        </p>
      ) : null}

      <p style={{ margin: "0 0 var(--space-3)", color: "var(--secondaire)", fontSize: "0.85rem" }}>
        {proposition.expireLe
          ? `À répondre avant le ${formaterDate(proposition.expireLe)}.`
          : "À répondre dans les meilleurs délais."}
        {" "}Règlement toujours directement avec le restaurant.
      </p>

      {erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
          {erreur}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="button" disabled={enCours} onClick={() => repondre("acceptee")}>
          {enCours ? "Traitement…" : "Accepter la modification"}
        </Button>
        <Button
          type="button"
          variante="danger"
          disabled={enCours}
          onClick={() => repondre("refusee")}
        >
          Refuser et annuler
        </Button>
      </div>
    </Card>
  );
}
