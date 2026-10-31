/*
 * Service Worker de Speedfood : (1) écran « hors connexion » quand le réseau manque, (2) notifications push de nouvelle commande
 * (console restaurateur).
 *
 * - Cache : UNIQUEMENT la page `/hors-ligne` et l'icône qu'elle affiche, des fichiers publics identiques pour tout le monde.
 *   Aucune page de Speedfood ni aucune réponse du serveur n'est jamais mise en cache : une page privée (commande, compte, suivi,
 *   console) ne peut donc pas rester sur un téléphone partagé, ni être servie à quelqu'un d'autre.
 * - Faute de réseau, une navigation reçoit l'écran « hors connexion ». Un 503 de Cloudflare (Worker coupé au hasard sur le forfait gratuit) est réessayé
 *   automatiquement, voir plus bas. Toute autre requête passe sans détour.
 * - La notification est envoyée VIDE par le serveur ; le texte affiché ici est générique. Aucun nom, numéro,
 *   adresse ni montant de client ne transite par les services de push.
 * - Un clic ouvre (ou ramène au premier plan) la liste des commandes.
 */
const CACHE_HORS_LIGNE = "speedfood-hors-ligne-v1";
// Adresse SANS extension : Cloudflare redirige `/hors-ligne.html` vers `/hors-ligne` (307), et une réponse issue d'une redirection ne peut pas
// être servie à une navigation.
const PAGE_HORS_LIGNE = "/hors-ligne";
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

// Réessais automatiques (19 octobre 2026) : sur le forfait gratuit de Cloudflare, une part des requêtes est coupée AU HASARD (erreur 1102, réponse 503) dès que le
// calcul moyen du Worker dépasse la limite, même pour un seul visiteur (docs/REVUE-2026-10-19.md §12). La coupure est aléatoire d'une requête à l'autre : on réessaie
// donc deux fois, après une courte pause, avant de montrer l'erreur. Rien n'est réessayé pour une autre raison qu'un 503.
//  - Toutes les LECTURES (GET) du site, sans risque.
//  - Les ENVOIS (POST) seulement pour la connexion, l'inscription, le panier et la commande : sans danger à répéter (la commande porte une clé d'idempotence).
//    Les autres envois (menu, réglages, paiements…) ne sont JAMAIS réessayés : un double envoi y créerait un doublon.
const PAUSES_REESSAI_MS = [250, 700];
const CHEMINS_ENVOI_REESSAYABLES = ["/connexion", "/inscription", "/entrer", "/commande", "/panier"];

function reessayable(requete) {
  let url;
  try {
    url = new URL(requete.url);
  } catch {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (requete.method === "GET") return true;
  if (requete.method === "POST") return CHEMINS_ENVOI_REESSAYABLES.some((c) => url.pathname === c || url.pathname.startsWith(c + "/"));
  return false;
}

async function chargerAvecReessais(requete) {
  // Un envoi a un corps qu'on ne peut lire qu'une fois : on garde un modèle à cloner pour chaque essai.
  const modele = requete.method === "GET" ? null : requete.clone();
  let reponse = await fetch(requete);
  for (const pause of PAUSES_REESSAI_MS) {
    if (reponse.status !== 503) return reponse;
    try {
      if (reponse.body) await reponse.body.cancel();
    } catch {
      // Rien à libérer.
    }
    await new Promise((fin) => setTimeout(fin, pause));
    reponse = await fetch(modele ? modele.clone() : requete);
  }
  return reponse;
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (!reessayable(requete)) return;
  evenement.respondWith(
    chargerAvecReessais(requete).catch(() =>
      // Réseau absent : seule une navigation reçoit l'écran « hors connexion » ; les autres requêtes échouent normalement.
      requete.mode === "navigate"
        ? caches.open(CACHE_HORS_LIGNE).then((cache) => cache.match(PAGE_HORS_LIGNE)).then((page) => page || Response.error())
        : Response.error()
    )
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
