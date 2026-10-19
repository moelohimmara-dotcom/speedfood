"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker pour tous les visiteurs, afin que l'application installée affiche l'écran « hors connexion »
 * de Speedfood plutôt que l'erreur brute du navigateur. Le service worker ne met en cache que cette page publique
 * (voir `public/sw.js`). Sans effet en développement, où un service worker gênerait les essais.
 */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec silencieux : le site fonctionne sans, seul l'écran hors connexion manquera.
    });
  }, []);
  return null;
}
