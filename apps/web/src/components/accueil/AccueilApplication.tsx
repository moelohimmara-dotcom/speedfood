import Link from "next/link";
import { applicationRecommandee } from "@/lib/application/installer-mobile";
import { FLECHE } from "./commun";

/**
 * Bande « L'application Speedfood » de l'accueil : met en avant le téléchargement. Sur grand écran, un QR code mène à la page `/installer` depuis le téléphone ;
 * sur téléphone, le bouton y mène directement. Textes fixes (pas d'emplacement CMS : ils décrivent l'application publiée).
 */
export function AccueilApplication() {
  // Même source que la page /installer : la version et la taille annoncées sont celles du fichier recommandé.
  const app = applicationRecommandee();
  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-app">
      <div className="appaccueil">
        <div className="appaccueil-texte">
          <p className="pub-kicker pub-kicker-encre">Application Android</p>
          <h2 id="accueil-app" className="pub-titre pub-h2">
            Speedfood dans votre <span className="pub-surligne-blanc">poche</span>
          </h2>
          <ul className="appaccueil-atouts">
            <li>Commande plus rapide : votre panier et vos adresses sont déjà là.</li>
            <li>Suivi de commande et alertes sur votre téléphone.</li>
            <li>Mises à jour en un geste, restaurants consultables même avec un réseau lent.</li>
          </ul>
          <div className="appaccueil-actions">
            <Link href="/installer" className="pub-btn pub-btn-clair">
              Télécharger Speedfood pour Android
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
            <span className="appaccueil-detail">
              Gratuite · Android · version {app.nom}
              {app.tailleMo > 0 ? ` · ${app.tailleMo} Mo` : ""} · iPhone bientôt
            </span>
          </div>
        </div>
        <figure className="appaccueil-qr">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG généré par le site. */}
          <img src="/installer/qr" alt="QR code vers la page de téléchargement de l'application Speedfood" width={148} height={148} />
          <figcaption>Scannez avec votre téléphone</figcaption>
        </figure>
      </div>
    </section>
  );
}
