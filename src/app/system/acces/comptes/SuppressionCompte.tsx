"use client";

import { useActionState, useRef, useState } from "react";
import { supprimerCompteAction, type EtatSuppressionCompte } from "@/lib/system-admin/suppression-compte";
import { Alert, Button } from "@/components/ui";
import { IconeAdmin } from "@/components/admin/icones";

const etatInitial: EtatSuppressionCompte = {};

interface Props {
  utilisateurId: string;
  email: string;
  nombreRestaurants: number;
}

/**
 * Suppression irréversible d'un compte. Le bouton de la liste est discret (c'est une action rare) ; le style d'alerte fort
 * est réservé à la fenêtre de confirmation : adresse e-mail retapée et motif obligatoire. Le bouton nomme le compte pour
 * les lecteurs d'écran.
 */
export function SuppressionCompte({ utilisateurId, email, nombreRestaurants }: Props) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [etat, action, enCours] = useActionState(supprimerCompteAction, etatInitial);
  const idTitre = `suppression-titre-${utilisateurId}`;
  // Valeurs contrôlées : après une erreur, le motif saisi ne doit pas disparaître.
  const [motif, setMotif] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <>
      <button
        type="button"
        className="btn btn-danger ad-action-discrete"
        aria-haspopup="dialog"
        aria-label={`Supprimer le compte ${email}`}
        onClick={() => dialogue.current?.showModal()}
      >
        <IconeAdmin nom="corbeille" taille={18} />
        Supprimer
      </button>

      <dialog ref={dialogue} className="ad-dialogue" aria-labelledby={idTitre}>
        <form action={action} className="ad-dialogue-corps">
          <h2 id={idTitre}>Supprimer ce compte ?</h2>
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
            <input
              id={`motif-${utilisateurId}`}
              name="motif"
              type="text"
              maxLength={500}
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
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
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogue.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" variante="danger" disabled={enCours} style={{ borderColor: "var(--danger)" }}>
              {enCours ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
