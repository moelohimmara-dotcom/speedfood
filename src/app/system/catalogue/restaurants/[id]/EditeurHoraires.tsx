"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, Button } from "@/components/ui";
import { enregistrerHorairesRestaurantAction, type EtatActionRestaurant } from "@/lib/system-admin/restaurants";

const etatInitial: EtatActionRestaurant = {};

export function EditeurHoraires({ restaurantId, horaires }: { restaurantId: string; horaires: string }) {
  const [etat, action, enCours] = useActionState(enregistrerHorairesRestaurantAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) formulaire.current?.reset();
  }, [etat.succes]);

  return (
    <form ref={formulaire} action={action} className="ad-horaires-editeur">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <div className="field">
        <label htmlFor="horaires-admin">Horaires d&apos;ouverture</label>
        <textarea
          id="horaires-admin"
          name="horaires"
          rows={3}
          maxLength={500}
          required
          defaultValue={horaires}
          placeholder="Ex. Lun-Sam 9h-21h, dimanche fermé"
        />
        <p className="aide-champ">Ce texte est affiché sur la fiche publique et débloque la validation.</p>
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Horaires enregistrés. Le dossier est actualisé.</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer les horaires"}
      </Button>
    </form>
  );
}
