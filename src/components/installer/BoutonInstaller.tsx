"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function enModeApplication(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const abonnementNul = () => () => {};

/**
 * Bouton « Installer Speedfood » de la page d'installation : déclenche l'invite native du navigateur (Chrome, Edge, Android) quand elle est
 * disponible. Sinon (Safari, Firefox, ou déjà installée) il le dit simplement et renvoie aux consignes de la page. Rien n'est envoyé nulle part.
 */
export function BoutonInstaller() {
  const installee = useSyncExternalStore(abonnementNul, enModeApplication, () => false);
  const [invite, setInvite] = useState<EvenementInstallation | null>(null);
  const [resultat, setResultat] = useState<"installee" | "refusee" | null>(null);

  useEffect(() => {
    const surInvite = (e: Event) => {
      e.preventDefault();
      setInvite(e as EvenementInstallation);
    };
    const surInstallee = () => {
      setInvite(null);
      setResultat("installee");
    };
    window.addEventListener("beforeinstallprompt", surInvite);
    window.addEventListener("appinstalled", surInstallee);
    return () => {
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  if (installee || resultat === "installee") {
    return <p className="installer-etat" role="status">Speedfood est installée sur cet appareil.</p>;
  }
  if (!invite) {
    return (
      <p className="installer-etat" role="status">
        Votre navigateur ne propose pas l&apos;installation en un clic : suivez les étapes ci-dessous pour votre appareil.
      </p>
    );
  }
  return (
    <div className="installer-action">
      <button
        type="button"
        className="btn btn-primary"
        onClick={async () => {
          await invite.prompt();
          const choix = await invite.userChoice;
          setInvite(null);
          setResultat(choix.outcome === "accepted" ? "installee" : "refusee");
        }}
      >
        Installer Speedfood sur cet appareil
      </button>
      {resultat === "refusee" ? <p className="installer-etat">Pas de souci : vous pourrez l&apos;installer plus tard depuis cette page.</p> : null}
    </div>
  );
}
