import type { Metadata } from "next";
import { Suspense } from "react";
import { RetourApplication } from "./RetourApplication";

export const metadata: Metadata = {
  title: "Retour à l'application Speedfood",
  robots: { index: false, follow: false },
  // Le code à usage unique est dans l'adresse : aucune page tierce ne doit pouvoir le lire dans un en-tête de provenance.
  referrer: "no-referrer",
};

/**
 * Retour des connexions Google et Facebook faites depuis l'application Android (voir `RetourApplication`). Android ne rend pas la main à l'application
 * pour un lien web non vérifié : la page le fait elle-même avec le code reçu.
 */
export default function RetourApplicationPage() {
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <Suspense fallback={<h1>Retour dans l&apos;application Speedfood…</h1>}>
          <RetourApplication />
        </Suspense>
      </div>
    </main>
  );
}
