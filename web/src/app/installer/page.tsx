import type { Metadata } from "next";
import { VERSION_APPLICATION } from "@/lib/application/version";

export const metadata: Metadata = {
  title: "Télécharger l'application Speedfood",
  description: "Téléchargez l'application Speedfood pour Android : commandez plus vite, suivez votre livraison et recevez les mises à jour automatiquement.",
  alternates: { canonical: "/installer" },
};

/** Fichiers servis depuis `public/`. Voir docs/APPLICATION-ANDROID.md pour reconstruire l'application et mettre à jour l'empreinte. */
const FICHIER_APK = "/speedfood.apk";
const FICHIER_EMPREINTE = "/speedfood.apk.sha256";
const VERSION = VERSION_APPLICATION.nom;
const TAILLE_MO = Math.round(VERSION_APPLICATION.apkTaille / 1_000_000);

const ETAPES_ANDROID = [
  "Touchez « Télécharger l'application Android » ci-dessus.",
  "Ouvrez le fichier téléchargé (notification ou dossier Téléchargements).",
  "Si Android demande d'autoriser l'installation depuis cette source, acceptez pour ce navigateur seulement, puis revenez en arrière et confirmez l'installation.",
  "L'icône Speedfood apparaît sur votre écran d'accueil. Ouvrez-la : elle vous guide au premier lancement.",
];

function Etapes({ etapes }: { etapes: string[] }) {
  return (
    <ol className="installer-etapes">
      {etapes.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ol>
  );
}

/**
 * Page de téléchargement de l'application native (Kotlin Multiplatform, ADR-019). Elle remplace l'ancienne enveloppe qui ne faisait qu'afficher le
 * site (« mode webview », supprimée le 21 octobre 2026) : plus d'installation du site sur l'écran d'accueil, plus de bouton d'installation du navigateur.
 */
export default function InstallerPage() {
  return (
    <main className="pub-conteneur pub-rubrique installer-page">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Application</p>
        <h1 className="pub-titre pub-h1-page">
          L&apos;application <span className="pub-surligne">Speedfood</span>
        </h1>
        <p className="pub-accueil-lead">Les restaurants de Conakry dans votre poche : commandez, suivez votre livraison, retrouvez vos commandes.</p>
      </div>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-android">
        <div className="installer-hero">
          <div className="installer-bloc">
            <h2 id="installer-android" className="pub-titre pub-h3-page">Téléphone Android</h2>
            <p className="installer-note">
              Gratuite · version {VERSION}
              {TAILLE_MO > 0 ? ` · ${TAILLE_MO} Mo` : ""}. Si l&apos;ancienne application Speedfood est déjà installée, installez simplement celle-ci par-dessus : elle la remplace.
            </p>
            <p>
              <a className="pub-btn" href={FICHIER_APK} download="speedfood.apk">
                Télécharger l&apos;application Android
              </a>
            </p>
          </div>
          <figure className="installer-qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG généré par le site. */}
            <img src="/installer/qr" alt="QR code de cette page" width={148} height={148} />
            <figcaption>Sur ordinateur ? Scannez avec votre téléphone.</figcaption>
          </figure>
        </div>

        <h3 className="pub-titre pub-h3-page">Ce que vous gagnez</h3>
        <ul className="installer-atouts">
          <li>Un formulaire de commande déjà rempli, votre panier conservé même après la fermeture de l&apos;application.</li>
          <li>Les notifications de votre commande et, pour les restaurateurs et livreurs, les alertes de nouvelles commandes et de courses.</li>
          <li>Les restaurants consultables même avec une connexion lente ou coupée.</li>
        </ul>

        <h3 className="pub-titre pub-h3-page">Toujours à jour</h3>
        <p>
          Dès qu&apos;une amélioration ou un correctif est publié, l&apos;application vous prévient et la nouvelle version s&apos;installe en un geste, sans revenir
          sur cette page. La première fois, Android demande d&apos;autoriser Speedfood à installer ses mises à jour.
        </p>

        <h3 className="pub-titre pub-h3-page">Installer en quatre étapes</h3>
        <Etapes etapes={ETAPES_ANDROID} />
        <p className="installer-note">
          L&apos;application n&apos;est pas encore sur Google Play : Android affiche donc un avertissement standard avant d&apos;installer un fichier téléchargé.
          Les notifications nécessitent les services Google du téléphone.
        </p>
        <p className="installer-note">
          Pour vérifier le fichier, comparez son empreinte avec <a className="lien-texte" href={FICHIER_EMPREINTE}>l&apos;empreinte SHA-256 publiée</a>.
          L&apos;application contrôle elle-même cette empreinte avant chaque mise à jour.
        </p>
      </section>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-iphone">
        <h2 id="installer-iphone" className="pub-titre pub-h3-page">iPhone et iPad</h2>
        <p>
          L&apos;application iPhone est en préparation : elle sera disponible sur l&apos;App Store. En attendant, le site Speedfood fonctionne dans Safari
          pour parcourir les restaurants et commander.
        </p>
      </section>
    </main>
  );
}
