import type { Metadata } from "next";
import { BoutonInstaller } from "@/components/installer/BoutonInstaller";

export const metadata: Metadata = {
  title: "Installer Speedfood",
  description: "Installez Speedfood sur votre téléphone Android, votre iPhone ou votre ordinateur.",
};

/** Nom du fichier APK servi depuis `public/`. Voir docs/APPLICATION-ANDROID.md pour le reconstruire. */
const FICHIER_APK = "/speedfood.apk";

const ETAPES_ANDROID_APK = [
  "Touchez « Télécharger l'application Android » ci-dessus.",
  "Ouvrez le fichier téléchargé (notification ou dossier Téléchargements).",
  "Si Android demande d'autoriser l'installation depuis cette source, acceptez pour ce navigateur seulement, puis revenez en arrière et confirmez l'installation.",
  "L'icône Speedfood apparaît sur votre écran d'accueil.",
];

const ETAPES_ANDROID_NAVIGATEUR = [
  "Ouvrez Speedfood dans Chrome.",
  "Touchez le menu ⋮ puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).",
  "Confirmez : l'icône Speedfood apparaît sur votre écran d'accueil.",
];

const ETAPES_IPHONE = [
  "Ouvrez Speedfood dans Safari (pas dans un autre navigateur).",
  "Touchez le bouton Partager (le carré avec une flèche vers le haut).",
  "Choisissez « Sur l'écran d'accueil », puis « Ajouter ».",
];

const ETAPES_ORDINATEUR = [
  "Ouvrez Speedfood dans Chrome ou Edge.",
  "Cliquez sur l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche), ou sur le bouton ci-dessus.",
  "Confirmez : Speedfood s'ouvre dans sa propre fenêtre et se lance depuis votre menu Démarrer ou votre bureau.",
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

export default function InstallerPage() {
  return (
    <main className="pub-conteneur pub-rubrique installer-page">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Application</p>
        <h1 className="pub-titre pub-h1-page">
          Speedfood sur votre <span className="pub-surligne">écran d&apos;accueil</span>
        </h1>
        <p className="pub-accueil-lead">
          Une icône, un lancement en un geste, les notifications de vos commandes. Choisissez votre appareil.
        </p>
      </div>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-android">
        <h2 id="installer-android" className="pub-titre pub-h3-page">Téléphone Android</h2>
        <p>Le plus simple : l&apos;application Android (fichier APK), qui s&apos;ouvre en plein écran comme n&apos;importe quelle autre.</p>
        <p>
          <a className="pub-btn" href={FICHIER_APK} download="speedfood.apk">
            Télécharger l&apos;application Android
          </a>
        </p>
        <Etapes etapes={ETAPES_ANDROID_APK} />
        <p className="installer-note">
          L&apos;application n&apos;est pas (encore) sur Google Play : Android affiche donc un avertissement standard avant d&apos;installer un fichier. Elle
          ne contient que Speedfood et se met à jour toute seule, car elle affiche le site.
        </p>
        <details className="installer-detail">
          <summary>Sans fichier : installer depuis Chrome</summary>
          <Etapes etapes={ETAPES_ANDROID_NAVIGATEUR} />
        </details>
      </section>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-iphone">
        <h2 id="installer-iphone" className="pub-titre pub-h3-page">iPhone et iPad</h2>
        <p>Apple n&apos;accepte pas les fichiers APK. Speedfood s&apos;installe depuis Safari, avec la même icône et le même plein écran.</p>
        <Etapes etapes={ETAPES_IPHONE} />
      </section>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-ordinateur">
        <h2 id="installer-ordinateur" className="pub-titre pub-h3-page">Ordinateur (Windows, Mac, Linux)</h2>
        <p>Pas de fichier à télécharger : le navigateur installe Speedfood comme un programme.</p>
        <BoutonInstaller />
        <Etapes etapes={ETAPES_ORDINATEUR} />
      </section>
    </main>
  );
}
