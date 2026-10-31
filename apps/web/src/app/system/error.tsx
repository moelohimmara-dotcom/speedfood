"use client";

import Link from "next/link";

/**
 * Frontière d'erreur de la console d'administration (audit du 15 octobre 2026) : une lecture qui échoue (requête, droit) affichait l'écran
 * d'erreur par défaut, sans moyen de réessayer ni de revenir. Le message d'erreur n'est jamais affiché (il peut contenir des détails
 * techniques) : seule la référence aide le support à retrouver la trace.
 */
export default function ErreurConsoleSysteme({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ad-panneau" role="alert">
      <div className="ad-panneau-corps">
        <h1 className="ad-erreur-titre">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p>Une erreur est survenue en chargeant cet écran. Vos données n&apos;ont pas été modifiées. Réessayez, ou revenez au tableau de bord.</p>
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
