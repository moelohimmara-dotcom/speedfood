"use client";

import { useEffect, useRef, useState } from "react";
import { estimerLivraisonAction, type EstimationPublique } from "@/lib/livraison/actions";
import { Alert } from "@/components/ui";
import { ListeChoix, type OptionChoix } from "@/components/ui/ListeChoix";

export interface DestinationChoisie {
  quartierId?: string;
  latitude?: number;
  longitude?: number;
}

interface Props {
  restaurantId: string;
  sousTotalGnf: number;
  quartiers: OptionChoix[];
  /** Frais et destination à jour, pour le total affiché et l'envoi (`fraisAffiches`). `null` tant que rien n'est calculé. */
  onChange: (etat: { destination: DestinationChoisie | null; estimation: EstimationPublique | null }) => void;
}

/**
 * Où livrer et combien ça coûte : le client choisit son quartier ou partage sa position, le serveur calcule distance et frais.
 * La position n'est demandée qu'après un clic et n'est jamais enregistrée par ce composant (arrondie à l'envoi).
 */
export function ChoixLivraison({ restaurantId, sousTotalGnf, quartiers, onChange }: Props) {
  const [quartierId, setQuartierId] = useState("");
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  // Résultat du calcul, avec la clé de la demande qui l'a produit : tant qu'il ne correspond pas à la demande courante, on calcule.
  const [resultat, setResultat] = useState<{ cle: string; estimation: EstimationPublique } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const numero = useRef(0);
  const rappel = useRef(onChange);
  useEffect(() => {
    rappel.current = onChange;
  });

  const destination: DestinationChoisie | null = position ? position : quartierId ? { quartierId } : null;
  const cle = JSON.stringify([destination, sousTotalGnf, restaurantId]);
  const estimation = destination && resultat?.cle === cle ? resultat.estimation : null;
  const calcul = destination !== null && resultat?.cle !== cle;

  useEffect(() => {
    if (!destination) {
      rappel.current({ destination: null, estimation: null });
      return;
    }
    const mien = ++numero.current;
    const minuteur = setTimeout(async () => {
      const calcule = await estimerLivraisonAction(restaurantId, destination, sousTotalGnf).catch(
        (): EstimationPublique => ({ statut: "erreur", message: "Le calcul de la livraison est momentanément indisponible." })
      );
      if (mien !== numero.current) return; // une réponse plus récente existe
      setResultat({ cle, estimation: calcule });
      rappel.current({ destination, estimation: calcule });
    }, 250);
    return () => clearTimeout(minuteur);
    // `cle` résume destination, sous-total et restaurant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  function utiliserMaPosition() {
    setMessage(null);
    if (!("geolocation" in navigator)) {
      setMessage("Votre appareil ne partage pas sa position : choisissez votre quartier.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setQuartierId("");
        setPosition({ latitude: Math.round(p.coords.latitude * 1e4) / 1e4, longitude: Math.round(p.coords.longitude * 1e4) / 1e4 });
      },
      () => setMessage("Position refusée ou indisponible : choisissez votre quartier."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="commande-livraison">
      <p className="commande-livraison-titre" id="commande-livraison-titre">
        Où livrer ?
      </p>
      <ListeChoix
        nom="quartier_livraison"
        options={quartiers}
        valeur={quartierId}
        onChange={(v) => {
          setPosition(null);
          setQuartierId(v);
        }}
        placeholder={position ? "Position partagée" : "Choisir mon quartier"}
        libelleAccessible="Quartier de livraison"
        idEtiquette="commande-livraison-titre"
      />
      <button type="button" className="commande-livraison-position" onClick={utiliserMaPosition}>
        Utiliser ma position
      </button>
      {message ? <p className="commande-livraison-aide">{message}</p> : null}
      <div className="commande-livraison-resultat" aria-live="polite">
        {calcul ? <p className="commande-livraison-aide">Calcul de la livraison…</p> : null}
        {!calcul && estimation?.statut === "ok" ? (
          <p className="commande-livraison-frais">
            <strong>{estimation.libelle}</strong>
            {estimation.dureeMinutes > 0 ? ` · environ ${estimation.dureeMinutes} min de trajet` : ""}
          </p>
        ) : null}
        {!calcul && estimation?.statut === "erreur" ? <Alert ton="danger">{estimation.message}</Alert> : null}
        {!calcul && estimation?.statut === "non_calcule" ? (
          <p className="commande-livraison-aide">Les frais de livraison sont à convenir avec le restaurant.</p>
        ) : null}
      </div>
    </div>
  );
}
