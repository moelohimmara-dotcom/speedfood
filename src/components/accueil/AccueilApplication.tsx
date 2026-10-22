import Link from "next/link";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { FLECHE } from "./commun";

/**
 * Bande « L'application Speedfood » de l'accueil : met en avant le téléchargement. Sur grand écran, un QR code mène à la page `/installer` depuis le téléphone ;
 * sur téléphone, le bouton y mène directement. Textes fixes (pas d'emplacement CMS : ils décrivent l'application publiée).
 */
export function AccueilApplication() {
  const mo = Math.round(VERSION_APPLICATION.apkTaille / 1_000_000);
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
              Télécharger l&apos;application
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
            <span className="appaccueil-detail">
              Gratuite · Android · version {VERSION_APPLICATION.nom}
              {mo > 0 ? ` · ${mo} Mo` : ""} · iPhone bientôt
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
