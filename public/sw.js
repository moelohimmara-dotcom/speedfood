/*
 * Service Worker de Speedfood : reçoit les notifications push de nouvelle commande (console restaurateur).
 *
 * - Il n'a aucun rôle de cache : il ne met rien hors ligne et ne touche jamais aux pages ni aux données.
 * - La notification est envoyée VIDE par le serveur ; le texte affiché ici est générique. Aucun nom, numéro,
 *   adresse ni montant de client ne transite par les services de push.
 * - Un clic ouvre (ou ramène au premier plan) la liste des commandes.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evenement) => evenement.waitUntil(self.clients.claim()));

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
