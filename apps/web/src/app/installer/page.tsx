import type { Metadata } from "next";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { applicationRecommandee, presentationApkMobile } from "@/lib/application/installer-mobile";

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
  "Touchez « Télécharger Speedfood pour Android » ci-dessus.",
  "Ouvrez le fichier téléchargé (notification ou dossier Téléchargements).",
  "Si Android demande d'autoriser l'installation depuis cette source, acceptez pour ce navigateur seulement, puis revenez en arrière et confirmez l'installation.",
  "L'icône Speedfood apparaît sur votre écran d'accueil. Ouvrez-la : elle vous guide au premier lancement.",
];

/** Nouvelle appli (Expo, com.speedfood.mobile), application principale depuis la 3.0.1, à côté de l'ancienne. `null` : rien n'est publié ou le téléchargement n'est pas valide, la section n'apparaît pas. */
const MOBILE = presentationApkMobile();

/** Application recommandée : même source que l'accueil (version, taille, lien). */
const RECOMMANDEE = applicationRecommandee();

const ETAPES_MOBILE = [
  "Touchez « Télécharger Speedfood pour Android » ci-dessus.",
  "Ouvrez le fichier téléchargé (notification ou dossier Téléchargements).",
  "Si Android demande d'autoriser l'installation depuis cette source, acceptez pour ce navigateur seulement, puis revenez en arrière et confirmez l'installation.",
  "L'icône Speedfood apparaît sur votre écran d'accueil. Ouvrez-la et connectez-vous avec votre compte habituel.",
];

const ETAPES_IPHONE = [
  "Ouvrez le site Speedfood dans Safari (et non dans le navigateur intégré d'une autre application, qui n'offre pas cette option).",
  "Touchez le bouton Partager, le carré avec une flèche vers le haut.",
  "Choisissez « Sur l'écran d'accueil », puis touchez « Ajouter ».",
  "L'icône Speedfood apparaît sur votre écran d'accueil : touchez-la pour ouvrir le site en plein écran.",
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

function Atouts() {
  return (
    <>
      <h3 className="pub-titre pub-h3-page">Ce que vous gagnez</h3>
      <ul className="installer-atouts">
        <li>Un formulaire de commande déjà rempli, votre panier conservé même après la fermeture de l&apos;application.</li>
        <li>Les notifications de votre commande et, pour les restaurateurs et livreurs, les alertes de nouvelles commandes et de courses.</li>
        <li>Les restaurants consultables même avec une connexion lente ou coupée.</li>
      </ul>
    </>
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

      {MOBILE ? (
        <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-nouvelle">
          <h2 id="installer-nouvelle" className="pub-titre pub-h3-page">Speedfood pour Android</h2>
          <p className="installer-note">
            Gratuite · version {RECOMMANDEE.nom}
            {RECOMMANDEE.tailleMo > 0 ? ` · ${RECOMMANDEE.tailleMo} Mo` : ""}. L&apos;application Speedfood pour commander, suivre vos livraisons et, pour les
            restaurateurs et livreurs, recevoir commandes et courses.
          </p>
          <p>
            <a className="pub-btn" href={RECOMMANDEE.chemin} download="speedfood-mobile.apk">
              Télécharger Speedfood pour Android
            </a>
          </p>

          <Atouts />
          <h3 className="pub-titre pub-h3-page">Installer en quatre étapes</h3>
          <Etapes etapes={ETAPES_MOBILE} />
          <p className="installer-note">
            Quand une nouvelle version est publiée, l&apos;application vous la propose : touchez le bandeau pour l&apos;installer, sans revenir sur cette page. Comme pour
            toute application téléchargée hors Google Play, Android affiche un avertissement standard avant l&apos;installation, et les notifications nécessitent les
            services Google du téléphone.
          </p>
          <p className="installer-note">
            Empreinte SHA-256 du fichier : <code>{MOBILE.sha256}</code>
          </p>
        </section>
      ) : null}

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-android">
        <div className="installer-hero">
          <div className="installer-bloc">
            <h2 id="installer-android" className="pub-titre pub-h3-page">{MOBILE ? "Vous utilisez l’ancienne application ?" : "Application Android"}</h2>
            {MOBILE ? (
              <>
                <p className="installer-note">
                  L&apos;ancienne application (version {VERSION}{TAILLE_MO > 0 ? `, ${TAILLE_MO} Mo` : ""}) et la nouvelle sont deux applications distinctes : elles
                  peuvent être installées en même temps et portent toutes les deux le nom Speedfood. Pour les reconnaître, ouvrez les Paramètres du téléphone,
                  puis Applications : l&apos;ancienne affiche la version {VERSION}, la nouvelle la version {RECOMMANDEE.nom}.
                </p>
                <ol className="installer-etapes">
                  <li>Installez la nouvelle application avec le bouton « Télécharger Speedfood pour Android » ci-dessus.</li>
                  <li>Ouvrez-la et connectez-vous avec la même adresse e-mail que dans l&apos;ancienne : c&apos;est le même compte.</li>
                  <li>Le panier en cours et les réglages de l&apos;ancienne application ne sont pas transférés : vérifiez-les avant de désinstaller l&apos;ancienne.</li>
                </ol>
                <p className="installer-note">Si vous en avez encore besoin, l&apos;ancienne application reste téléchargeable :</p>
              </>
            ) : (
              <p className="installer-note">
                Gratuite · version {VERSION}
                {TAILLE_MO > 0 ? ` · ${TAILLE_MO} Mo` : ""}.
              </p>
            )}
            <p>
              <a className={MOBILE ? "pub-btn pub-btn-clair" : "pub-btn"} href={FICHIER_APK} download="speedfood.apk">
                {MOBILE ? `Télécharger l’ancienne application (${VERSION})` : "Télécharger Speedfood pour Android"}
              </a>
            </p>
          </div>
          <figure className="installer-qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code SVG généré par le site. */}
            <img src="/installer/qr" alt="QR code de cette page" width={148} height={148} />
            <figcaption>Sur ordinateur ? Scannez avec votre téléphone.</figcaption>
          </figure>
        </div>

        {/* Nouvelle appli publiée : ses atouts et ses étapes sont dans le bloc principal ; cette section ne parle plus que de l'ancienne. */}
        {MOBILE ? null : (
          <>
        <Atouts />

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
          </>
        )}
      </section>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-iphone">
        <h2 id="installer-iphone" className="pub-titre pub-h3-page">iPhone et iPad</h2>
        <p>
          L&apos;application iPhone est en préparation : elle sera disponible sur l&apos;App Store (Apple n&apos;autorise pas le téléchargement direct d&apos;un
          fichier comme sur Android). Ce bouton apparaîtra ici dès sa publication.
        </p>
        <h3 className="pub-titre pub-h3-page">En attendant : Speedfood sur votre écran d&apos;accueil</h3>
        <p>Le site Speedfood fonctionne dans Safari pour parcourir les restaurants et commander. Pour le retrouver en un geste, comme une application :</p>
        <Etapes etapes={ETAPES_IPHONE} />
      </section>
    </main>
  );
}
