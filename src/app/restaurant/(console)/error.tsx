"use client";

import Link from "next/link";

/**
 * Frontière d'erreur de la console du restaurateur (audit du 15 octobre 2026) : sur un réseau variable, une page qui échoue doit
 * proposer de réessayer au lieu de laisser un écran d'erreur sans issue. Le message technique n'est jamais affiché.
 */
export default function ErreurConsoleRestaurant({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ad-panneau" role="alert">
      <div className="ad-panneau-corps">
        <h1 className="ad-erreur-titre">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p>Vérifiez votre connexion, puis réessayez. Vos commandes et votre menu n&apos;ont pas été modifiés.</p>
        <div className="ad-actions-ligne">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Réessayer
          </button>
          <Link href="/restaurant/commandes" className="btn btn-secondary">
            Voir les commandes
          </Link>
        </div>
        {error.digest ? <p className="ad-aide-champ">Référence : {error.digest}</p> : null}
      </div>
    </div>
  );
}
