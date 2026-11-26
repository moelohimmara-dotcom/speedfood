"use client";

import { useActionState, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { deciderReservationAction, type EtatReservation } from "@/lib/reservation/actions";
import { libelleAction, ordonnerActions } from "@/lib/reservation/console";
import { actionExigeMotif, MOTIF_RESERVATION_MAX, MOTIF_RESERVATION_MIN, type ActionReservationRestaurant } from "@/lib/contracts/reservation";

const etatInitial: EtatReservation = {};

/**
 * Boutons d'une réservation : EXACTEMENT les actions renvoyées par l'API (`actionsPossibles`), jamais déduites du statut ici. « Refuser » et « Annuler » demandent un motif
 * (3 à 200 caractères, lu par le client) et une confirmation ; les autres actions partent en un geste. Un seul envoi à la fois ; un résultat incertain n'est jamais rejoué.
 */
export function ActionsReservation({ reservationId, actions, resume }: { reservationId: string; actions: ActionReservationRestaurant[]; resume: string }) {
  const [ouverte, setOuverte] = useState<ActionReservationRestaurant | null>(null);
  const [etat, action, enCours] = useActionState(deciderReservationAction, etatInitial);
  const liste = ordonnerActions(actions);

  if (etat.succes) return <Alert ton="succes">{etat.succes}</Alert>;
  if (liste.length === 0) return null;

  if (ouverte !== null && actionExigeMotif(ouverte)) {
    return (
      <form action={action} className="console-reservation-decision">
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="action" value={ouverte} />
        <p>
          <strong>{ouverte === "refuser" ? "Refuser cette réservation ?" : "Annuler cette réservation ?"}</strong>
        </p>
        <p className="console-reservation-secondaire">{resume}</p>
        <div className="field">
          <label htmlFor={`motif-${reservationId}`}>Motif (le client le lira)</label>
          <textarea id={`motif-${reservationId}`} name="motif" required minLength={MOTIF_RESERVATION_MIN} maxLength={MOTIF_RESERVATION_MAX} rows={3} placeholder="Par exemple : nous sommes complets ce soir." />
        </div>
        {etat.erreur ? <Alert ton={etat.incertain ? "info" : "danger"}>{etat.erreur}</Alert> : null}
        <div className="console-reservation-actions">
          {etat.incertain ? null : (
            <Button type="submit" variante="danger" disabled={enCours}>
              {enCours ? "Envoi…" : ouverte === "refuser" ? "Oui, refuser" : "Oui, annuler"}
            </Button>
          )}
          <Button type="button" variante="secondary" disabled={enCours} onClick={() => setOuverte(null)}>
            {etat.incertain ? "Fermer" : "Non, revenir"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {etat.erreur ? <Alert ton={etat.incertain ? "info" : "danger"}>{etat.erreur}</Alert> : null}
      <div className="console-reservation-actions">
        {liste.map((a) =>
          actionExigeMotif(a) ? (
            <Button key={a} type="button" variante="secondary" disabled={enCours} onClick={() => setOuverte(a)}>
              {libelleAction(a)}
            </Button>
          ) : (
            <form key={a} action={action}>
              <input type="hidden" name="reservationId" value={reservationId} />
              <input type="hidden" name="action" value={a} />
              <Button type="submit" disabled={enCours || etat.incertain === true}>
                {libelleAction(a)}
              </Button>
            </form>
          ),
        )}
      </div>
    </div>
  );
}
