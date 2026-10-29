"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker pour tous les visiteurs : écran « hors connexion » de Speedfood plutôt que l'erreur brute du navigateur, réessais
 * automatiques des coupures 503, et notifications push de la console restaurateur. Le service worker ne met en cache que cette page publique
 * (voir `public/sw.js`). Le site n'est plus installable comme application (le manifeste a été retiré le 21 octobre 2026, ADR-019) : l'application, c'est
 * l'application native téléchargée depuis /installer. Sans effet en développement, où un service worker gênerait les essais.
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
