"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Invite d'installation de Speedfood sur l'écran d'accueil (lot B), pour la console restaurateur.
 *
 * - Android (Chrome) : bouton natif d'installation quand le navigateur le propose (`beforeinstallprompt`),
 *   sinon rappel du menu du navigateur.
 * - iPhone et iPad : aucune invite possible, donc mode d'emploi (Partager, puis « Sur l'écran d'accueil »).
 *   C'est aussi la condition pour recevoir les notifications push sur iOS 16.4 ou plus.
 * - Déjà installée, ou ordinateur : rien n'est affiché.
 */

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Plateforme = "inconnue" | "installee" | "android" | "ios" | "autre";

function detecterPlateforme(): Plateforme {
  const autonome =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (autonome) {
    return "installee";
  }
  const agent = navigator.userAgent;
  // iPadOS 13+ se présente comme un Mac : on le reconnaît à son écran tactile.
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/.test(agent)) {
    return "android";
  }
  return "autre";
}

function abonnementNul(): () => void {
  return () => {};
}

export function InstallationApp() {
  // Lu côté navigateur seulement : « inconnue » au rendu serveur, puis la vraie valeur (sans setState dans un effet).
  const detectee = useSyncExternalStore(abonnementNul, detecterPlateforme, (): Plateforme => "inconnue");
  const [aInstalle, setAInstalle] = useState(false);
  const plateforme: Plateforme = aInstalle ? "installee" : detectee;
  const [invite, setInvite] = useState<EvenementInstallation | null>(null);

  useEffect(() => {
    const surInvite = (evenement: Event) => {
      evenement.preventDefault();
      setInvite(evenement as EvenementInstallation);
    };
    const surInstallee = () => {
      setInvite(null);
      setAInstalle(true);
    };
    window.addEventListener("beforeinstallprompt", surInvite);
    window.addEventListener("appinstalled", surInstallee);
    return () => {
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  if (plateforme === "inconnue" || plateforme === "installee" || plateforme === "autre") {
    return null;
  }

  async function installer() {
    if (!invite) {
      return;
    }
    await invite.prompt();
    await invite.userChoice;
    setInvite(null);
  }

  return (
    <details className="alerte-commandes">
      <summary className="alerte-commandes-resume">Installer l&apos;application</summary>
      {plateforme === "ios" ? (
        <>
          <p className="alerte-commandes-note">
            Sur iPhone et iPad, appuyez sur le bouton <strong>Partager</strong> de Safari, puis sur{" "}
            <strong>Sur l&apos;écran d&apos;accueil</strong>. Ouvrez ensuite Speedfood depuis cette icône : c&apos;est
            nécessaire pour recevoir les alertes page fermée (iOS 16.4 ou plus).
          </p>
        </>
      ) : (
        <>
          {invite ? (
            <div className="alerte-commandes-actions">
              <button type="button" className="btn btn-primary btn-compact" onClick={installer}>
                Installer Speedfood
              </button>
            </div>
          ) : (
            <p className="alerte-commandes-note">
              Dans Chrome, ouvrez le menu (trois points), puis <strong>Installer l&apos;application</strong> ou{" "}
              <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
            </p>
          )}
          <p className="alerte-commandes-note">
            <strong>Pour ne manquer aucune commande</strong> : dans les réglages Android, ouvrez Applications, Chrome (ou
            Speedfood une fois installée), Batterie, puis choisissez « Sans restriction » ou désactivez l&apos;économie de
            batterie. Certains téléphones (Xiaomi, Huawei, Samsung) coupent sinon les notifications quand l&apos;écran est
            éteint.
          </p>
        </>
      )}
    </details>
  );
}
