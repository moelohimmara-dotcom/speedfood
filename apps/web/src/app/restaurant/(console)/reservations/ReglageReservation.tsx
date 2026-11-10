"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { ecrireReglageReservationAction, type EtatReservation } from "@/lib/reservation/actions";
import { CAPACITE_COUVERTS_MAX, CAPACITE_COUVERTS_MIN } from "@/lib/contracts/reservation";

const etatInitial: EtatReservation = {};

/** Réglages des réservations : accepter ou non, et le nombre de couverts (personnes) acceptés par créneau. Champ vide = sans plafond. */
export function ReglageReservation({ accepte, capacite }: { accepte: boolean; capacite: number | null }) {
  const [etat, action, enCours] = useActionState(ecrireReglageReservationAction, etatInitial);
  return (
    <form action={action} className="console-reservation-reglage">
      <div className="console-reservation-reglage-ligne">
        <input id="console-reservation-accepte" type="checkbox" name="accepte" value="oui" defaultChecked={accepte} />
        <label htmlFor="console-reservation-accepte">Accepter les réservations</label>
      </div>
      <div className="field">
        <label htmlFor="console-reservation-capacite">Capacité par créneau (nombre de personnes)</label>
        <input id="console-reservation-capacite" name="capacite" inputMode="numeric" defaultValue={capacite === null ? "" : String(capacite)} placeholder="Sans plafond" />
        <span className="console-reservation-secondaire">
          Laissez vide pour ne pas limiter. Sinon, de {CAPACITE_COUVERTS_MIN} à {CAPACITE_COUVERTS_MAX}.
        </span>
      </div>
      {etat.erreur ? <Alert ton={etat.incertain ? "info" : "danger"}>{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
      </div>
    </form>
  );
}
