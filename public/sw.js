/*
 * Service Worker de Speedfood : (1) écran « hors connexion » quand le réseau manque, (2) notifications push de nouvelle commande
 * (console restaurateur).
 *
 * - Cache : UNIQUEMENT la page `/hors-ligne.html` et l'icône qu'elle affiche, des fichiers publics identiques pour tout le monde.
 *   Aucune page de Speedfood ni aucune réponse du serveur n'est jamais mise en cache : une page privée (commande, compte, suivi,
 *   console) ne peut donc pas rester sur un téléphone partagé, ni être servie à quelqu'un d'autre.
 * - Il ne touche qu'aux navigations (changement de page) qui ÉCHOUENT faute de réseau ; toute autre requête passe sans détour.
 * - La notification est envoyée VIDE par le serveur ; le texte affiché ici est générique. Aucun nom, numéro,
 *   adresse ni montant de client ne transite par les services de push.
 * - Un clic ouvre (ou ramène au premier plan) la liste des commandes.
 */
const CACHE_HORS_LIGNE = "speedfood-hors-ligne-v1";
const PAGE_HORS_LIGNE = "/hors-ligne.html";
const FICHIERS_HORS_LIGNE = [PAGE_HORS_LIGNE, "/icons/icon-192.png"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(caches.open(CACHE_HORS_LIGNE).then((cache) => cache.addAll(FICHIERS_HORS_LIGNE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE_HORS_LIGNE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.mode !== "navigate" || requete.method !== "GET") return;
  evenement.respondWith(
    fetch(requete).catch(() => caches.open(CACHE_HORS_LIGNE).then((cache) => cache.match(PAGE_HORS_LIGNE)).then((page) => page || Response.error()))
  );
});

self.addEventListener("push", (evenement) => {
  evenement.waitUntil(
    self.registration.showNotification("Nouvelle commande", {
      body: "Ouvrez Speedfood pour répondre au client.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: "speedfood-commande",
      renotify: true,
      requireInteraction: true,
      // Android : vibration et son du canal de notification du téléphone ; `requireInteraction` y est ignoré, d'où `renotify`.
      vibrate: [200, 100, 200, 100, 200],
      data: { url: "/restaurant/commandes" },
    })
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const adresse = (evenement.notification.data && evenement.notification.data.url) || "/restaurant/commandes";
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if (new URL(fenetre.url).pathname.startsWith("/restaurant") && "focus" in fenetre) {
          return fenetre.focus().then(() => ("navigate" in fenetre ? fenetre.navigate(adresse) : undefined));
        }
      }
      return self.clients.openWindow(adresse);
    })
  );
});
