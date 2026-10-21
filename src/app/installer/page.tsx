import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Télécharger l'application Speedfood",
  description: "Téléchargez l'application Speedfood pour Android directement depuis le site, sans passer par un magasin.",
};

/** Fichiers servis depuis `public/`. Voir docs/APPLICATION-ANDROID.md pour reconstruire l'application et mettre à jour l'empreinte. */
const FICHIER_APK = "/speedfood.apk";
const FICHIER_EMPREINTE = "/speedfood.apk.sha256";
const VERSION = "2.3.0";

const ETAPES_ANDROID = [
  "Touchez « Télécharger l'application Android » ci-dessus.",
  "Ouvrez le fichier téléchargé (notification ou dossier Téléchargements).",
  "Si Android demande d'autoriser l'installation depuis cette source, acceptez pour ce navigateur seulement, puis revenez en arrière et confirmez l'installation.",
  "L'icône Speedfood apparaît sur votre écran d'accueil.",
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
        <p className="pub-accueil-lead">Téléchargez-la directement ici : choisissez votre espace et parcourez les restaurants de Conakry.</p>
      </div>

      <section className="pub-carte pub-carte-pad installer-bloc" aria-labelledby="installer-android">
        <h2 id="installer-android" className="pub-titre pub-h3-page">Téléphone Android</h2>
        <p>
          Version {VERSION}. Une vraie application Android, pas un raccourci vers le site. Si l&apos;ancienne application Speedfood est déjà installée,
          installez simplement celle-ci par-dessus : elle la remplace.
        </p>
        <p>
          <a className="pub-btn" href={FICHIER_APK} download="speedfood.apk">
            Télécharger l&apos;application Android
          </a>
        </p>
        <Etapes etapes={ETAPES_ANDROID} />
        <p className="installer-note">
          L&apos;application n&apos;est pas encore sur Google Play : Android affiche donc un avertissement standard avant d&apos;installer un fichier téléchargé.
          Cette version permet de parcourir les restaurants, de créer un compte, de commander (retrait ou livraison), de suivre votre commande et de retrouver votre historique.
          Les livreurs ont leur espace (compte ouvert par l&apos;équipe Speedfood). Les notifications arrivent dans une prochaine version.
        </p>
        <p className="installer-note">
          Pour vérifier le fichier, comparez son empreinte avec <a className="lien-texte" href={FICHIER_EMPREINTE}>l&apos;empreinte SHA-256 publiée</a>.
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
