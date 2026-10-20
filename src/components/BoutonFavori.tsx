"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { basculerFavoriAction, etatFavoriAction } from "@/lib/client/actions-espace";

/**
 * Cœur « Favori » de la fiche d'un restaurant. La fiche publique est mise en cache et identique pour tous : l'état du compte se lit APRÈS
 * l'affichage. Un visiteur non connecté voit une invitation à se connecter, pas un bouton qui échoue.
 */
export function BoutonFavori({ restaurantId }: { restaurantId: string }) {
  const [etat, setEtat] = useState<{ connecte: boolean; favori: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let actif = true;
    etatFavoriAction(restaurantId)
      .then((e) => {
        if (actif) setEtat(e);
      })
      .catch(() => {
        if (actif) setEtat({ connecte: false, favori: false });
      });
    return () => {
      actif = false;
    };
  }, [restaurantId]);

  if (etat === null) return null;
  if (!etat.connecte) {
    return (
      <Link href={`/entrer?suite=${encodeURIComponent(`/restaurants/${restaurantId}`)}`} className="btn btn-secondary btn-compact bouton-favori">
        <span aria-hidden="true">♡</span> Enregistrer ce restaurant
      </Link>
    );
  }

  function basculer() {
    setMessage(null);
    demarrer(async () => {
      const r = await basculerFavoriAction(restaurantId);
      if (r.ok) setEtat({ connecte: true, favori: r.favori });
      else setMessage(r.message);
    });
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-compact bouton-favori" aria-pressed={etat.favori} disabled={enCours} onClick={basculer}>
        <span aria-hidden="true">{etat.favori ? "♥" : "♡"}</span> {etat.favori ? "Dans mes favoris" : "Ajouter aux favoris"}
      </button>
      {message ? (
        <span role="status" className="aide-champ">
          {message}
        </span>
      ) : null}
    </>
  );
}
