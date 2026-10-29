"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { etatService } from "@/lib/alertes/mode-service";

/**
 * Bouton « Mode service » : garde l'écran allumé (Screen Wake Lock) pendant le service. Le navigateur retire la garde quand l'onglet passe en
 * arrière-plan : elle est redemandée au retour. Le texte dit toujours l'état RÉEL (voir `etatService`). Le choix du restaurateur (activé ou non)
 * est mémorisé sur cet appareil ; la garde elle-même ne l'est jamais, elle est redemandée à chaque ouverture.
 */
const CLE = "speedfood.mode-service";
const abonnes = new Set<() => void>();
const abonner = (notifier: () => void) => {
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
  };
};
function lireChoix(): boolean {
  try {
    return window.localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}
function ecrireChoix(actif: boolean): void {
  try {
    window.localStorage.setItem(CLE, actif ? "1" : "0");
  } catch {
    // Stockage indisponible : le choix vaut pour cette page seulement.
  }
  for (const notifier of abonnes) notifier();
}

const abonnerReseau = (notifier: () => void) => {
  window.addEventListener("online", notifier);
  window.addEventListener("offline", notifier);
  return () => {
    window.removeEventListener("online", notifier);
    window.removeEventListener("offline", notifier);
  };
};
const abonnerVisibilite = (notifier: () => void) => {
  document.addEventListener("visibilitychange", notifier);
  return () => document.removeEventListener("visibilitychange", notifier);
};

export function ModeService() {
  const voulu = useSyncExternalStore(abonner, lireChoix, () => false);
  const enLigne = useSyncExternalStore(abonnerReseau, () => navigator.onLine, () => true);
  const visible = useSyncExternalStore(abonnerVisibilite, () => document.visibilityState === "visible", () => true);
  const supporte = useSyncExternalStore(
    () => () => {},
    () => "wakeLock" in navigator,
    () => false
  );
  const [verrouActif, setVerrouActif] = useState(false);
  const verrou = useRef<WakeLockSentinel | null>(null);

  // Demande la garde quand le service est voulu ET l'onglet affiché ; la libère dès que l'une des deux conditions tombe (et à la fermeture).
  // Au retour sur l'onglet, `visible` repasse à vrai : l'effet la redemande, car le navigateur l'a retirée en arrière-plan.
  useEffect(() => {
    if (!voulu || !visible || !supporte) return;
    let annule = false;
    navigator.wakeLock
      .request("screen")
      .then((sentinelle) => {
        if (annule) {
          void sentinelle.release().catch(() => {});
          return;
        }
        verrou.current = sentinelle;
        setVerrouActif(true);
        // Le navigateur peut retirer la garde seul (batterie faible) : l'affichage ne dit plus « actif ».
        sentinelle.addEventListener("release", () => {
          if (verrou.current === sentinelle) verrou.current = null;
          setVerrouActif(false);
        });
      })
      .catch(() => setVerrouActif(false));
    return () => {
      annule = true;
      const sentinelle = verrou.current;
      verrou.current = null;
      void sentinelle?.release().catch(() => {});
    };
  }, [voulu, visible, supporte]);

  const etat = etatService({ voulu, supporte, verrouActif, enLigne, visible });

  return (
    <div className={`rc-service-mode rc-service-mode-${etat.niveau}`}>
      <button
        type="button"
        className="btn btn-secondary rc-service-bouton"
        aria-pressed={voulu}
        disabled={!supporte && !voulu}
        onClick={() => ecrireChoix(!voulu)}
      >
        {voulu ? "Quitter le mode service" : "Mode service"}
      </button>
      <p className="rc-service-texte" role="status">
        {etat.message}
      </p>
    </div>
  );
}
