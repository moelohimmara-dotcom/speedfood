"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as CarteLeaflet, Marker } from "leaflet";

export interface PointCarte {
  latitude: number;
  longitude: number;
}

interface Props {
  restaurant: PointCarte | null;
  destination: PointCarte | null;
  livreur: PointCarte | null;
  restaurantNom?: string;
  /** Texte alternatif de la carte pour les lecteurs d'écran (la carte seule n'est pas lisible à voix haute). */
  description: string;
}

/**
 * Carte de la livraison : restaurant, destination et livreur en direct (OpenStreetMap, Leaflet, léger pour les réseaux mobiles).
 * Les repères sont dessinés en CSS (pas d'image), la carte se charge à la demande côté navigateur. Les tuiles d'OpenStreetMap
 * conviennent à un usage léger : à l'échelle, prévoir un fournisseur de tuiles à compte (voir docs/LIVRAISON.md).
 */
export function CarteLivraison({ restaurant, destination, livreur, restaurantNom = "Restaurant", description }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const repereLivreur = useRef<Marker | null>(null);
  const ajuste = useRef(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      if (!conteneur.current || carte.current) return;
      const L = (await import("leaflet")).default;
      if (annule || !conteneur.current) return;

      const centre = livreur ?? restaurant ?? destination;
      if (!centre) return;
      const c = L.map(conteneur.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([centre.latitude, centre.longitude], 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(c);

      const repere = (classe: string, texte: string, titre: string) =>
        L.divIcon({ className: "", html: `<span class="carte-repere ${classe}" title="${titre}">${texte}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });

      const bornes: [number, number][] = [];
      if (restaurant) {
        L.marker([restaurant.latitude, restaurant.longitude], { icon: repere("carte-repere-resto", "R", restaurantNom), keyboard: false }).addTo(c);
        bornes.push([restaurant.latitude, restaurant.longitude]);
      }
      if (destination) {
        L.marker([destination.latitude, destination.longitude], { icon: repere("carte-repere-client", "C", "Votre adresse"), keyboard: false }).addTo(c);
        bornes.push([destination.latitude, destination.longitude]);
      }
      if (livreur) {
        repereLivreur.current = L.marker([livreur.latitude, livreur.longitude], { icon: repere("carte-repere-livreur", "L", "Livreur"), keyboard: false, zIndexOffset: 1000 }).addTo(c);
        bornes.push([livreur.latitude, livreur.longitude]);
      }
      if (bornes.length > 1) {
        c.fitBounds(bornes, { padding: [36, 36], maxZoom: 16 });
        ajuste.current = true;
      }
      carte.current = c;
    })();
    return () => {
      annule = true;
    };
    // La carte se crée une seule fois ; les mises à jour du livreur passent par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le livreur bouge : son repère suit, sans recharger la carte.
  useEffect(() => {
    const c = carte.current;
    if (!c || !livreur) return;
    if (repereLivreur.current) {
      repereLivreur.current.setLatLng([livreur.latitude, livreur.longitude]);
    } else {
      void import("leaflet").then(({ default: L }) => {
        if (!carte.current || repereLivreur.current) return;
        repereLivreur.current = L.marker([livreur.latitude, livreur.longitude], {
          icon: L.divIcon({ className: "", html: '<span class="carte-repere carte-repere-livreur" title="Livreur">L</span>', iconSize: [34, 34], iconAnchor: [17, 17] }),
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(carte.current);
      });
    }
  }, [livreur]);

  // Au démontage, la carte est détruite proprement.
  useEffect(
    () => () => {
      carte.current?.remove();
      carte.current = null;
      repereLivreur.current = null;
    },
    []
  );

  return (
    <div className="carte-livraison">
      <div ref={conteneur} className="carte-livraison-zone" role="img" aria-label={description} />
      <p className="carte-livraison-legende">
        <span className="carte-repere carte-repere-resto">R</span> {restaurantNom}
        {destination ? (
          <>
            {" · "}
            <span className="carte-repere carte-repere-client">C</span> Votre adresse
          </>
        ) : null}
        {" · "}
        <span className="carte-repere carte-repere-livreur">L</span> Livreur
      </p>
    </div>
  );
}
