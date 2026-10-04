"use client";

import { useActionState, useRef, useState } from "react";
import { modifierProfilAction, type EtatFormulaireProfil } from "@/lib/restaurant/actions";
import { Card } from "@/components/ui";
import { BarreEnregistrement, useSuiviModifications } from "@/components/admin/BarreEnregistrement";
import { SelecteurCouleur } from "./SelecteurCouleur";
import { MOYENS_PAIEMENT } from "@/lib/restaurant/paiement";

const etatInitial: EtatFormulaireProfil = {};

/**
 * Deux blocs (identité visuelle, puis horaires et consignes) dans un seul formulaire, avec une barre
 * d'enregistrement collée en bas de l'écran : on modifie ce qu'on veut, le bouton reste toujours à portée.
 */
export function FormulaireProfil({
  horaires,
  consignes,
  photoUrl,
  logoUrl,
  couleurAccent,
  moyensPaiement,
  carteActive,
  latitude,
  longitude,
}: {
  horaires: string;
  consignes: string;
  photoUrl: string | null;
  logoUrl: string | null;
  couleurAccent: string | null;
  moyensPaiement: string[];
  carteActive: boolean;
  latitude: number | null;
  longitude: number | null;
}) {
  const [etat, action, enCours] = useActionState(modifierProfilAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  const { modifie, mesurer, annuler } = useSuiviModifications(formulaire, Boolean(etat.succes));
  const [lat, setLat] = useState(latitude === null ? "" : String(latitude));
  const [lon, setLon] = useState(longitude === null ? "" : String(longitude));
  const [messagePosition, setMessagePosition] = useState("");

  // La position n'est demandée qu'au clic, jamais automatiquement ; elle reste modifiable avant l'enregistrement.
  function utiliserMaPosition() {
    if (!("geolocation" in navigator)) {
      setMessagePosition("Votre navigateur ne sait pas donner votre position : saisissez-la à la main.");
      return;
    }
    setMessagePosition("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (resultat) => {
        setLat(resultat.coords.latitude.toFixed(6));
        setLon(resultat.coords.longitude.toFixed(6));
        window.setTimeout(mesurer, 50);
        setMessagePosition("Position trouvée. Placez-vous dans votre établissement pour plus de précision, puis enregistrez.");
      },
      () => setMessagePosition("Position refusée ou indisponible : autorisez-la dans le navigateur, ou saisissez-la à la main."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <form ref={formulaire} action={action} className="profil-formulaire" onInput={mesurer} onChange={mesurer}>
      <Card>
        <h2 className="profil-bloc-titre">Identité visuelle</h2>
        <div className="champs-ligne profil-medias">
          <div className="field depot-photo">
            <label htmlFor="photo">Photo de couverture</label>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img src={photoUrl} alt="Photo de couverture actuelle" className="profil-media-couverture" />
            ) : null}
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="aide-champ">
              Affichée en haut de votre fiche publique. Format conseillé 3/2 (ex. 1200 × 800). JPEG, PNG ou WebP, 5 Mo
              maximum. Laissez vide pour garder la photo actuelle.
            </p>
          </div>
          <div className="field depot-photo">
            <label htmlFor="logo">Logo (votre emblème)</label>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img src={logoUrl} alt="Logo actuel" className="profil-media-logo" />
            ) : null}
            <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="aide-champ">
              Pastille sur le bord de votre bannière et sur votre carte du catalogue. Carré conseillé (ex. 512 × 512).
              Sans logo, votre initiale est affichée.
            </p>
          </div>
        </div>
        <div className="field">
          <span id="etiquette-couleur" className="etiquette-champ">
            Couleur d&apos;accent
          </span>
          <SelecteurCouleur valeurInitiale={couleurAccent} />
          <p className="aide-champ">
            Un liseré décoratif propre à votre restaurant, visible dans le catalogue et sur votre fiche. Facultatif.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="profil-bloc-titre">Horaires et consignes</h2>
        <div className="field">
          <label htmlFor="horaires">Horaires</label>
          <textarea
            id="horaires"
            name="horaires"
            rows={2}
            maxLength={500}
            defaultValue={horaires}
            placeholder="Ex. Lun-Sam 9h-21h"
          />
        </div>
        <div className="field">
          <label htmlFor="consignes">Consignes pour vos clients</label>
          <textarea
            id="consignes"
            name="consignes"
            rows={3}
            maxLength={1000}
            defaultValue={consignes}
            placeholder="Ex. Livraison uniquement dans un rayon de 5 km"
          />
        </div>
      </Card>

      <Card>
        <h2 className="profil-bloc-titre">Moyens de paiement acceptés</h2>
        <fieldset className="moyens-paiement">
          <legend className="aide-champ">
            Information affichée sur votre fiche. Speedfood n&apos;encaisse rien : le client règle directement avec vous.
          </legend>
          {MOYENS_PAIEMENT.map((moyen) => (
            <label key={moyen.valeur} className="moyen-paiement">
              <input type="checkbox" name="moyens_paiement" value={moyen.valeur} defaultChecked={moyensPaiement.includes(moyen.valeur)} />
              {moyen.libelle}
            </label>
          ))}
        </fieldset>
      </Card>

      {carteActive ? (
        <Card>
          <h2 className="profil-bloc-titre">Position sur la carte</h2>
          <p className="aide-champ">
            Facultatif. Vos clients verront des liens « Voir sur la carte » et « Itinéraire » sur votre fiche. Appuyez sur le
            bouton quand vous êtes dans votre établissement. Laissez les deux champs vides pour ne pas afficher de position.
          </p>
          <div className="champs-ligne">
            <div className="field">
              <label htmlFor="latitude">Latitude</label>
              <input id="latitude" name="latitude" type="text" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="9.5370" />
            </div>
            <div className="field">
              <label htmlFor="longitude">Longitude</label>
              <input id="longitude" name="longitude" type="text" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-13.6785" />
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={utiliserMaPosition}>
            Utiliser ma position
          </button>
          {messagePosition ? (
            <p className="aide-champ" role="status">
              {messagePosition}
            </p>
          ) : null}
        </Card>
      ) : null}

      <BarreEnregistrement
        variante="console"
        modifie={modifie}
        enCours={enCours}
        etat={etat}
        onAnnuler={annuler}
      />
    </form>
  );
}
