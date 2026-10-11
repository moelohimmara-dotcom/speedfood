"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, Button } from "@/components/ui";
import { MOYENS_PAIEMENT } from "@/lib/restaurant/paiement";
import { modifierProfilRestaurantAdminAction, type EtatActionRestaurant } from "@/lib/system-admin/restaurants";

const etatInitial: EtatActionRestaurant = {};

export function EditeurProfilRestaurant({
  restaurantId,
  horaires,
  consignes,
  moyensPaiement,
}: {
  restaurantId: string;
  horaires: string;
  consignes: string;
  moyensPaiement: string[];
}) {
  const [etat, action, enCours] = useActionState(modifierProfilRestaurantAdminAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) formulaire.current?.reset();
  }, [etat.succes]);

  return (
    <form ref={formulaire} action={action} className="ad-profil-editeur">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <div className="ad-profil-editeur-grid">
        <div className="field">
          <label htmlFor="horaires-admin-profil">Horaires d&apos;ouverture</label>
          <textarea id="horaires-admin-profil" name="horaires" rows={3} maxLength={500} required defaultValue={horaires} placeholder="Ex. Lun-Sam 9h-21h, dimanche fermé" />
        </div>
        <div className="field">
          <label htmlFor="consignes-admin-profil">Consignes pour les clients</label>
          <textarea id="consignes-admin-profil" name="consignes" rows={3} maxLength={1000} defaultValue={consignes} placeholder="Ex. Livraison dans un rayon de 5 km" />
        </div>
      </div>
      <fieldset className="ad-profil-paiements">
        <legend>Moyens de paiement acceptés</legend>
        <div className="ad-profil-paiements-liste">
          {MOYENS_PAIEMENT.map((moyen) => (
            <label key={moyen.valeur}>
              <input type="checkbox" name="moyens_paiement" value={moyen.valeur} defaultChecked={moyensPaiement.includes(moyen.valeur)} />
              {moyen.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Informations enregistrées. Le restaurant reste publié.</Alert> : null}
      <Button type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer les informations"}</Button>
    </form>
  );
}
