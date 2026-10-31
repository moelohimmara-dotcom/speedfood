"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { MOYENS_PAIEMENT } from "@/lib/restaurant/paiement";
import { modifierProfilRestaurantAdminAction, type EtatActionRestaurant } from "@/lib/system-admin/restaurants";
import { MODELES_CONSIGNES, MODELES_HORAIRES, PROFILS_PAIEMENT, moyensDuProfil } from "@/lib/system-admin/profil-pre-remplissage";

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
  const [horairesValeur, setHorairesValeur] = useState(horaires);
  const [consignesValeur, setConsignesValeur] = useState(consignes);
  const [profilPaiement, setProfilPaiement] = useState("");
  const [moyensSelectionnes, setMoyensSelectionnes] = useState(moyensPaiement);

  useEffect(() => {
    if (etat.succes) formulaire.current?.reset();
  }, [etat.succes]);

  function appliquerProfilPaiement(valeur: string) {
    setProfilPaiement(valeur);
    const moyens = moyensDuProfil(valeur);
    if (moyens) setMoyensSelectionnes(moyens);
  }

  return (
    <form ref={formulaire} action={action} className="ad-profil-editeur">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <div className="ad-profil-editeur-grid">
        <div className="field">
          <label htmlFor="modele-horaires-admin">Modèle d&apos;horaires</label>
          <select id="modele-horaires-admin" value={MODELES_HORAIRES.some((modele) => modele.valeur === horairesValeur) ? horairesValeur : ""} onChange={(e) => e.target.value && setHorairesValeur(e.target.value)}>
            {MODELES_HORAIRES.map((modele) => <option key={modele.libelle} value={modele.valeur}>{modele.libelle}</option>)}
          </select>
          <label htmlFor="horaires-admin-profil">Horaires d&apos;ouverture</label>
          <textarea id="horaires-admin-profil" name="horaires" rows={3} maxLength={500} required value={horairesValeur} onChange={(e) => setHorairesValeur(e.target.value)} placeholder="Ex. Lun-Sam 9h-21h, dimanche fermé" />
        </div>
        <div className="field">
          <label htmlFor="modele-consignes-admin">Modèle de consignes</label>
          <select id="modele-consignes-admin" value={MODELES_CONSIGNES.some((modele) => modele.valeur === consignesValeur) ? consignesValeur : ""} onChange={(e) => e.target.value && setConsignesValeur(e.target.value)}>
            {MODELES_CONSIGNES.map((modele) => <option key={modele.libelle} value={modele.valeur}>{modele.libelle}</option>)}
          </select>
          <label htmlFor="consignes-admin-profil">Consignes pour les clients</label>
          <textarea id="consignes-admin-profil" name="consignes" rows={3} maxLength={1000} value={consignesValeur} onChange={(e) => setConsignesValeur(e.target.value)} placeholder="Ex. Livraison dans un rayon de 5 km" />
        </div>
      </div>
      <fieldset className="ad-profil-paiements">
        <legend>Moyens de paiement acceptés</legend>
        <label htmlFor="profil-paiement-admin">Préremplissage</label>
        <select id="profil-paiement-admin" value={profilPaiement} onChange={(e) => appliquerProfilPaiement(e.target.value)}>
          {PROFILS_PAIEMENT.map((profil) => <option key={profil.libelle} value={profil.valeur}>{profil.libelle}</option>)}
        </select>
        <div className="ad-profil-paiements-liste">
          {MOYENS_PAIEMENT.map((moyen) => (
            <label key={moyen.valeur}>
              <input type="checkbox" name="moyens_paiement" value={moyen.valeur} checked={moyensSelectionnes.includes(moyen.valeur)} onChange={(e) => setMoyensSelectionnes((actuels) => e.target.checked ? [...actuels, moyen.valeur] : actuels.filter((valeur) => valeur !== moyen.valeur))} />
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
