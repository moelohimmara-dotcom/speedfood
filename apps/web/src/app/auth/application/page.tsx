import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Retour à l'application Speedfood",
  robots: { index: false, follow: false },
};

/**
 * Retour de la connexion Facebook faite depuis l'application Android. Quand l'application est installée, Android intercepte ce lien (lien d'application)
 * et ne montre jamais cette page. Si elle s'affiche, c'est que l'application n'a pas pris le relais : on l'explique sans exposer le code reçu.
 */
export default function RetourApplicationPage() {
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <h1>Retournez dans l&apos;application Speedfood</h1>
        <p>
          Votre connexion se termine dans l&apos;application. Si elle ne s&apos;est pas ouverte, ouvrez Speedfood depuis votre téléphone et touchez de nouveau « Continuer avec Facebook ».
        </p>
        <p>
          <Link href="/restaurants">Voir les restaurants sur le site</Link>
        </p>
      </div>
    </main>
  );
}
