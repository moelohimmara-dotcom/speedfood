"use client";

import { useActionState, useState } from "react";
import { supprimerCompteAction, type EtatSuppressionCompte } from "@/lib/system-admin/suppression-compte";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatSuppressionCompte = {};

interface Props {
  utilisateurId: string;
  email: string;
  nombreRestaurants: number;
}

/** Suppression irréversible d'un compte : confirmation par l'adresse e-mail retapée et motif obligatoire. */
export function SuppressionCompte({ utilisateurId, email, nombreRestaurants }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(supprimerCompteAction, etatInitial);

  if (!ouvert) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        <Button type="button" variante="danger" onClick={() => setOuvert(true)}>
          Supprimer ce compte
        </Button>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <input type="hidden" name="utilisateur_id" value={utilisateurId} />
      <Alert ton="danger">
        <strong>Suppression définitive.</strong> Le compte {email} disparaît et ne peut pas être récupéré. L&apos;historique
        d&apos;audit est conservé, sans lien vers le compte.
      </Alert>
      {nombreRestaurants > 0 ? (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.9rem" }}>
          <input type="checkbox" name="supprimer_restaurants" style={{ marginTop: 3 }} />
          <span>
            Supprimer aussi ses restaurants <strong>s&apos;il en est le seul membre et qu&apos;ils n&apos;ont aucune commande</strong>{" "}
            (menus et plats inclus). Un restaurant qui a des commandes n&apos;est jamais supprimé.
          </span>
        </label>
      ) : null}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor={`motif-${utilisateurId}`}>Motif (obligatoire, ex. « compte de test »)</label>
        <input id={`motif-${utilisateurId}`} name="motif" type="text" maxLength={500} required />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor={`confirmation-${utilisateurId}`}>Pour confirmer, retapez l&apos;adresse e-mail du compte</label>
        <input
          id={`confirmation-${utilisateurId}`}
          name="confirmation_email"
          type="text"
          autoComplete="off"
          placeholder={email}
          required
        />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" variante="danger" disabled={enCours}>
          {enCours ? "Suppression…" : "Supprimer définitivement"}
        </Button>
        <Button type="button" variante="secondary" onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
