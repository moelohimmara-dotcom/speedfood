"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { annulerReservationAction, type EtatReservation } from "@/lib/reservation/actions";

const etatInitial: EtatReservation = {};

/** Annulation d'une réservation par le client, avec confirmation explicite avant tout envoi. Un seul envoi à la fois ; un résultat incertain renvoie vers la liste, sans rejeu. */
export function BoutonAnnulerReservation({ reservationId, resume }: { reservationId: string; resume: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const [etat, action, enCours] = useActionState(annulerReservationAction, etatInitial);

  if (etat.succes) return <Alert ton="succes">{etat.succes}</Alert>;

  if (!confirmation) {
    return (
      <Button type="button" variante="secondary" onClick={() => setConfirmation(true)}>
        Annuler cette réservation
      </Button>
    );
  }

  return (
    <form action={action} className="reservation-confirmation">
      <input type="hidden" name="reservationId" value={reservationId} />
      <p>
        <strong>Annuler cette réservation ?</strong>
      </p>
      <p>{resume}</p>
      <p>Le restaurant sera informé. Cette action est définitive.</p>
      {etat.erreur ? <Alert ton={etat.incertain ? "info" : "danger"}>{etat.erreur}</Alert> : null}
      <div className="reservation-actions">
        {etat.incertain ? (
          <Link href="/compte/reservations" className="btn btn-primary">
            Voir mes réservations
          </Link>
        ) : (
          <>
            <Button type="submit" variante="danger" disabled={enCours}>
              {enCours ? "Annulation…" : "Oui, annuler la réservation"}
            </Button>
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => setConfirmation(false)}>
              Non, la garder
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
