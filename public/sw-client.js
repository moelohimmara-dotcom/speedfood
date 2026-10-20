/*
 * Service Worker du CLIENT : notifications de suivi de commande (espace client).
 *
 * Il est enregistré avec la portée `/compte/` seulement : il ne voit ni n'intercepte aucune page du site (pas de gestionnaire `fetch`), et il
 * est séparé du Service Worker des restaurateurs (`/sw.js`), dont il ne partage ni les abonnements ni le texte.
 *
 * Le service de push livre une notification VIDE. Le texte est demandé ici à notre serveur, avec la session du client (cookies) : rien de ce qui
 * concerne la commande ne transite par Google, Mozilla ou Apple. Sans réseau ou sans réponse, un texte générique est affiché : la notification
 * n'est jamais perdue (le navigateur l'exige d'ailleurs pour tout push).
 */
const REPLI = { titre: "Votre commande a avancé", corps: "Ouvrez Speedfood pour voir où elle en est.", url: "/compte/commandes", tag: "speedfood-suivi" };

async function lireContenu() {
  try {
    const reponse = await fetch("/compte/alertes/message", { credentials: "same-origin", cache: "no-store" });
    if (!reponse.ok) return REPLI;
    const corps = await reponse.json();
    const c = corps && corps.contenu;
    if (!c || typeof c.titre !== "string" || typeof c.corps !== "string") return REPLI;
    // La page ouverte au clic reste INTERNE : une adresse extérieure est ignorée.
    const url = typeof c.url === "string" && c.url.startsWith("/") && !c.url.startsWith("//") ? c.url : REPLI.url;
    return { titre: c.titre.slice(0, 80), corps: c.corps.slice(0, 200), url, tag: typeof c.tag === "string" ? c.tag.slice(0, 40) : REPLI.tag };
  } catch {
    return REPLI;
  }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evenement) => evenement.waitUntil(self.clients.claim()));

self.addEventListener("push", (evenement) => {
  evenement.waitUntil(
    lireContenu().then((c) =>
      self.registration.showNotification(c.titre, {
        body: c.corps,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: c.tag,
        renotify: true,
        data: { url: c.url },
      })
    )
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const adresse = (evenement.notification.data && evenement.notification.data.url) || REPLI.url;
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) return fenetre.focus().then(() => ("navigate" in fenetre ? fenetre.navigate(adresse) : undefined));
      }
      return self.clients.openWindow(adresse);
    })
  );
});
