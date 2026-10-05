import type { Metadata } from "next";
import Link from "next/link";
import { CadreSite } from "@/components/CadreSite";
import { VecteurIntrouvable } from "@/components/site/vecteurs/VecteurIntrouvable";

export const metadata: Metadata = { title: "Page introuvable" };

/**
 * Page introuvable : dans le cadre du site (en-tête, pied de page, navigation) pour ne jamais laisser
 * l'utilisateur dans une impasse. Le message est neutre : il sert aussi bien à une adresse mal saisie
 * qu'à un restaurant retiré du catalogue (audit du 4 octobre 2026, M6).
 */
export default function NotFound() {
  return (
    <CadreSite focus>
      <main className="page-introuvable">
        <VecteurIntrouvable />
        <p className="page-introuvable-code" aria-hidden="true">404</p>
        <h1>Page introuvable</h1>
        <p>
          Cette page n&apos;existe pas ou n&apos;est plus disponible. Si vous cherchiez un restaurant, il a peut-être
          été retiré du catalogue.
        </p>
        <div className="page-introuvable-actions">
          <Link href="/restaurants" className="btn btn-primary">
            Découvrir les restaurants
          </Link>
          <Link href="/a-propos" className="btn btn-secondary">
            Comment ça marche
          </Link>
        </div>
      </main>
    </CadreSite>
  );
}
