"use client";

import { useActionState, useState } from "react";
import { definirLivraisonRestaurantAction, type EtatLivraisonRestaurant } from "@/lib/restaurant/livraison";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatLivraisonRestaurant = {};

interface Props {
  mode: "aucune" | "propre" | "speedfood";
  latitude: number | null;
  longitude: number | null;
}

/** Qui livre, et où se trouve le restaurant : la position sert à calculer les frais de livraison d'après la distance. */
export function FormulaireLivraisonResto({ mode, latitude, longitude }: Props) {
  const [etat, action, enCours] = useActionState(definirLivraisonRestaurantAction, etatInitial);
  const [choix, setChoix] = useState<"aucune" | "propre">(mode === "aucune" ? "aucune" : "propre");
  const [lat, setLat] = useState(latitude === null ? "" : String(latitude));
  const [lon, setLon] = useState(longitude === null ? "" : String(longitude));
  const [avis, setAvis] = useState<string | null>(null);

  function prendreMaPosition() {
    setAvis(null);
    if (!("geolocation" in navigator)) {
      setAvis("Votre appareil ne partage pas sa position.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(Math.round(p.coords.latitude * 1e6) / 1e6));
        setLon(String(Math.round(p.coords.longitude * 1e6) / 1e6));
        setAvis("Position relevée. Cliquez sur « Enregistrer » pour la garder.");
      },
      () => setAvis("Position refusée ou indisponible."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <Card>
      <h2 className="profil-bloc-titre">Qui livre et où êtes-vous ?</h2>
      <form action={action}>
        <fieldset className="choix-groupe">
          <legend>Livraison de vos commandes</legend>
          <label className="choix-carte">
            <input type="radio" name="livraison_mode" value="propre" checked={choix === "propre"} onChange={() => setChoix("propre")} />
            <span className="choix-texte">
              <strong>Je livre avec mon personnel</strong>
              <small>Les clients peuvent choisir la livraison ; les frais sont calculés d&apos;après la distance.</small>
            </span>
          </label>
          <label className="choix-carte">
            <input type="radio" name="livraison_mode" value="aucune" checked={choix === "aucune"} onChange={() => setChoix("aucune")} />
            <span className="choix-texte">
              <strong>Pas de livraison</strong>
              <small>Retrait sur place seulement.</small>
            </span>
          </label>
          <label className="choix-carte restaurant-livraison-bientot">
            <input type="radio" name="livraison_mode_bientot" value="speedfood" disabled />
            <span className="choix-texte">
              <strong>Un livreur Speedfood</strong>
              <small>Bientôt : un livreur est affecté à la course et suit la commande jusqu&apos;au client.</small>
            </span>
          </label>
        </fieldset>

        <div className="field">
          <label htmlFor="resto-latitude">Latitude</label>
          <input id="resto-latitude" name="latitude" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="9.5370" />
        </div>
        <div className="field">
          <label htmlFor="resto-longitude">Longitude</label>
          <input id="resto-longitude" name="longitude" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-13.6785" />
        </div>
        <p className="aide-champ">
          Pour un calcul précis des frais, relevez la position depuis le restaurant (bouton ci-dessous, depuis votre téléphone). Sans position, le centre de
          votre quartier est utilisé.
        </p>
        <div className="restaurant-livraison-actions">
          <Button type="button" variante="secondary" onClick={prendreMaPosition}>
            Utiliser ma position actuelle
          </Button>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        {avis ? <p className="aide-champ">{avis}</p> : null}
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.message}</Alert> : null}
      </form>
    </Card>
  );
}
