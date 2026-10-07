import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { lireTextes } from "@/lib/cms/textes";
import { FLECHE, pastille } from "./commun";

/** Bande « Espace restaurateurs » : invitation à devenir partenaire (emplacements `accueil.pro.*`). */
export async function AccueilPro() {
  const t = await lireTextes();
  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-pro">
      <div className="pub-bande-pro">
        <div className="pub-bande-contenu">
          {/* Toque : le pictogramme du restaurateur, en pastille comme les étapes. */}
          <span className="pub-bande-icone">
            <Illustration valeur={pastille("trait-toque")} nom="" decoratif />
          </span>
          <div>
            <p className="pub-kicker pub-kicker-encre">{t["accueil.pro.kicker"]}</p>
            <h2 id="accueil-pro" className="pub-titre pub-h2">
              {t["accueil.pro.titre_debut"]} <span className="pub-surligne-blanc">{t["accueil.pro.titre_surligne"]}</span>
            </h2>
            <p className="pub-accueil-lead pub-lead-encre">{t["accueil.pro.texte"]}</p>
          </div>
        </div>
        <Link href="/devenir-partenaire" className="pub-btn pub-btn-clair">
          {t["accueil.pro.bouton"]}
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
