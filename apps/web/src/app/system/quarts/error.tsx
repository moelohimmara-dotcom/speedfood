"use client";

import Link from "next/link";

/**
 * Frontière d'erreur de l'écran « Quarts et affectation » : une lecture qui échoue affiche un
 * écran d'erreur avec un moyen de réessayer. Le message technique n'est jamais affiché : seule la
 * référence aide le support à retrouver la trace.
 */
export default function ErreurQuarts({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ad-panneau" role="alert">
      <div className="ad-panneau-corps">
        <h1 className="ad-erreur-titre">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p>Une erreur est survenue en chargeant les quarts. Aucune affectation n&apos;a été modifiée. Réessayez.</p>
        <div className="ad-actions-ligne">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Réessayer
          </button>
          <Link href="/system" className="btn btn-secondary">
            Tableau de bord
          </Link>
        </div>
        {error.digest ? <p className="ad-aide-champ">Référence : {error.digest}</p> : null}
      </div>
    </div>
  );
}
