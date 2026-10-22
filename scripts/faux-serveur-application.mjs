// Faux serveur LOCAL pour auditer l'application dans l'émulateur avec des comptes et des données factices, sans toucher à la base de production.
//
// Usage : node scripts/faux-serveur-application.mjs   (écoute sur le port 8787 ; l'émulateur y accède par http://10.0.2.2:8787)
// L'application de test est construite avec site.url = supabase.url = http://10.0.2.2:8787 (voir docs/AUDIT-PARCOURS-2026-10-22.md).
//
// Comptes factices (mot de passe quelconque) : client@test.sf, resto@test.sf, livreur@test.sf, equipe@test.sf, multi@test.sf (restaurateur + livreur).
// Les lectures publiques `/rest/v1/*` (restaurants, plats, quartiers) sont relayées en LECTURE SEULE vers la vraie base ; tout le reste est simulé ici, en mémoire :
// aucune commande, aucun compte n'est créé ailleurs que dans ce processus.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const REEL = process.env.SUPABASE_URL ?? "https://ggldjdizqrtpetdiohxy.supabase.co";

const COMPTES = {
  "client@test.sf": { id: "u-client", roles: {} },
  "resto@test.sf": { id: "u-resto", roles: { restaurateur: { restaurant: "Chez Awa (essai)" } } },
  "livreur@test.sf": { id: "u-livreur", roles: { livreur: true } },
  "equipe@test.sf": { id: "u-equipe", roles: { equipe: "super_admin" } },
  "multi@test.sf": { id: "u-multi", roles: { restaurateur: { restaurant: "Chez Awa (essai)" }, livreur: true } },
};
// Simulation d'une session révoquée ou expirée côté serveur : GET /__revoquer puis GET /__restaurer (pour l'audit « je reste dans l'application sans être connecté »).
let revoque = false;
const parJeton = (req) => {
  if (revoque) return null;
  const m = /^Bearer tok-(.+)$/.exec(req.headers.authorization ?? "");
  const email = m?.[1];
  return email && COMPTES[email] ? { email, ...COMPTES[email] } : null;
};

const maintenant = () => new Date().toISOString();
let commandes = [
  { id: "c1", reference: "SF-1001", statut: "en_attente", etatDerive: "en_attente", mode: "livraison", clientNom: "Aminata Diallo", clientTelephone: "+224622000001", clientAdresse: "Kaporo Centre, rue KA-012", sousTotal: 60000, fraisLivraisonEstime: 9500, creeLe: maintenant(), estTest: false, lignes: [{ nom: "Poulet braisé", prix: 30000, quantite: 2, options: [{ nom: "Piment", prix: 0 }] }], propositionActive: null, propositions: [], paiementStatut: "non_declare" },
  { id: "c2", reference: "SF-1002", statut: "acceptee", etatDerive: "acceptee", mode: "retrait", clientNom: "Mamadou Bah", clientTelephone: "+224622000002", clientAdresse: "", sousTotal: 35000, fraisLivraisonEstime: 0, creeLe: maintenant(), estTest: false, lignes: [{ nom: "Riz gras", prix: 35000, quantite: 1, options: [] }], propositionActive: null, propositions: [], paiementStatut: "non_declare" },
];
const plats = [
  { id: "p1", nom: "Poulet braisé", description: "Servi avec attiéké", prix: 30000, prixPromo: null, disponible: true, confirmeLe: maintenant(), sectionId: "s1", options: [{ id: "o1", nom: "Piment", prix: 0, disponible: true }] },
  { id: "p2", nom: "Riz gras", description: "", prix: 35000, prixPromo: 32000, disponible: true, confirmeLe: "2026-10-03T10:00:00Z", sectionId: "s1", options: [] },
  { id: "p3", nom: "Jus de bissap", description: "", prix: 5000, prixPromo: null, disponible: false, confirmeLe: null, sectionId: "s2", options: [] },
];
const livraisonsEquipe = [
  { id: "l1", commandeReference: "SF-1001", restaurantNom: "Chez Awa (essai)", mode: "speedfood", statut: "a_assigner", libelle: "En recherche d'un livreur", livreurId: null, livreurNom: null, fraisGnf: 9500, distanceKm: 3.2, creeLe: maintenant(), offreEnCours: null, raison: null },
];
const livreursEquipe = [
  { id: "lv1", nom: "Mamadou Barry", telephone: "+224622111111", cycle: "actif", motifCycle: null, vehicule: "Moto", statut: "disponible", simule: false, aPosition: true },
  { id: "lv2", nom: "Fatoumata Sow", telephone: "+224622222222", cycle: "candidat", motifCycle: null, vehicule: "Vélo", statut: "hors_ligne", simule: false, aPosition: false },
];

const ok = (res, corps = { ok: true }, statut = 200) => {
  res.writeHead(statut, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corps));
};
const refus = (res, statut, code, message) => ok(res, { ok: false, erreur: { code, message } }, statut);
const lireCorps = (req) => new Promise((r) => { let t = ""; req.on("data", (d) => (t += d)); req.on("end", () => { try { r(t ? JSON.parse(t) : {}); } catch { r({}); } }); });
const session = (email) => ({ access_token: `tok-${email}`, refresh_token: `ref-${email}`, expires_in: 3600, token_type: "bearer", user: { id: COMPTES[email].id, email } });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chemin = url.pathname;
  console.log(req.method, chemin);

  if (chemin === "/__revoquer") { revoque = true; return ok(res, { revoque }); }
  if (chemin === "/__restaurer") { revoque = false; return ok(res, { revoque }); }

  // Lectures publiques : relais lecture seule vers la vraie base.
  if (chemin.startsWith("/rest/v1/") && req.method === "GET") {
    try {
      const r = await fetch(REEL + chemin + url.search, { headers: { apikey: req.headers.apikey ?? "", authorization: `Bearer ${req.headers.apikey ?? ""}` } });
      res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "application/json" });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      ok(res, [], 502);
    }
    return;
  }

  if (chemin === "/auth/v1/settings") return ok(res, { external: { email: true, google: false } });
  if (chemin === "/auth/v1/token") {
    const corps = await lireCorps(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      if (revoque) return ok(res, { error: "invalid_grant", error_description: "Refresh Token Not Found" }, 400);
      const email = String(corps.refresh_token ?? "").replace(/^ref-/, "");
      return COMPTES[email] ? ok(res, session(email)) : ok(res, { error: "invalid_grant", error_description: "Refresh Token Not Found" }, 400);
    }
    const email = String(corps.email ?? "").toLowerCase();
    if (!COMPTES[email]) return ok(res, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials" }, 400);
    return ok(res, session(email));
  }
  if (chemin === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  if (chemin.startsWith("/auth/v1/")) return ok(res, {});

  if (chemin === "/api/v1/version") return ok(res, { ok: true, version: { code: 21, nom: "2.19.0", notes: "", obligatoire: false } });
  if (chemin === "/api/v1/aide") return ok(res, { ok: true, whatsapp: "+224620000000" });
  if (chemin.startsWith("/api/v1/appareils")) return ok(res);
  if (chemin === "/api/v1/livraison/estimation") { await lireCorps(req); return ok(res, { ok: true, estimation: null }); }

  // Commandes d'un invité ou d'un client (simulées).
  if (chemin === "/api/v1/commandes" && req.method === "POST") { await lireCorps(req); return ok(res, { ok: true, reference: "SF-2001", jeton: "jeton-essai", idempotent: false }, 201); }
  if (chemin === "/api/v1/commandes" && req.method === "GET") return ok(res, { ok: true, commandes: [] });
  if (chemin === "/api/v1/suivi") {
    await lireCorps(req);
    return ok(res, { ok: true, suivi: { reference: "SF-2001", statut: "acceptee", etatDerive: "acceptee", mode: "retrait", creeLe: maintenant(), restaurant: { id: "r1", nom: "Chez Awa (essai)" }, lignes: [{ nom: "Poulet braisé", quantite: 1, prix: 30000, options: [] }], sousTotal: 30000, fraisLivraisonEstime: 0, propositionActive: null, historiqueStatuts: [] } });
  }

  const compte = parJeton(req);
  if (chemin.startsWith("/api/v1/") && !compte) return refus(res, 401, "NON_AUTHENTIFIE", "Connectez-vous avec votre compte.");

  if (chemin === "/api/v1/moi") return ok(res, { ok: true, roles: { restaurateur: compte.roles.restaurateur ?? null, livreur: Boolean(compte.roles.livreur), equipe: compte.roles.equipe ?? null } });

  if (chemin === "/api/v1/client/espace") return ok(res, { ok: true, profil: { pseudo: "Client Essai", avatar: "assiette", modePrefere: "livraison", notificationsCommande: true }, adresses: [{ id: "a1", libelle: "Maison", adresse: "Kaporo Centre", parDefaut: true }], favoris: [{ restaurantId: "r1", nom: "Chez Awa (essai)", ouvert: true }], avis: [] });
  if (chemin.startsWith("/api/v1/client/")) { await lireCorps(req); return ok(res, { ok: true, message: "Enregistré." }); }

  // Espace restaurateur
  if (chemin.startsWith("/api/v1/restaurant/")) {
    if (!compte.roles.restaurateur) return refus(res, 403, "NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant.");
    if (chemin === "/api/v1/restaurant/commandes" && req.method === "GET") return ok(res, { ok: true, restaurant: { id: "r1", nom: compte.roles.restaurateur.restaurant, ouvert: true, accepteCommandes: true }, commandes });
    if (chemin === "/api/v1/restaurant/menu" && req.method === "GET") return ok(res, { ok: true, sections: [{ id: "s1", nom: "Plats" }, { id: "s2", nom: "Boissons" }], plats });
    if (chemin === "/api/v1/restaurant/commandes/action") {
      const c = await lireCorps(req);
      const cible = commandes.find((x) => x.id === c.commandeId);
      if (cible) cible.statut = cible.etatDerive = { accepter: "acceptee", refuser: "refusee", prete: "prete", terminer: "terminee" }[c.action] ?? cible.statut;
      return ok(res);
    }
    await lireCorps(req);
    return ok(res);
  }

  // Espace livreur
  if (chemin.startsWith("/api/v1/livreur/")) {
    if (!compte.roles.livreur) return ok(res, { ok: true, etat: null });
    if (chemin === "/api/v1/livreur/etat") return ok(res, { ok: true, etat: { livreur: { id: "lv1", nom: "Mamadou Barry", statut: "disponible", vehicule: "Moto", cycle: "actif", motifCycle: null, restaurantNom: null }, offre: null, course: null, aNoter: null, positionConnue: true } });
    await lireCorps(req);
    return ok(res);
  }

  // Équipe Speedfood
  if (chemin.startsWith("/api/v1/equipe/")) {
    if (!compte.roles.equipe) return refus(res, 403, "NON_AUTORISE", "Cet espace est réservé à l'équipe Speedfood.");
    const sous = chemin.replace("/api/v1/equipe/", "");
    if (sous === "moi") return ok(res, { ok: true, role: compte.roles.equipe, permissions: ["commande.support", "restaurant.moderer"], groupes: [{ libelle: "Exploitation", entrees: [{ chemin: "/system/repartition", libelle: "Poste de répartition", natif: true }, { chemin: "/system/finances", libelle: "Finances", natif: false }] }] });
    if (sous === "tableau") return ok(res, { ok: true, commandes: { activesDuJour: 7, enAttente: 2, propositionsEnAttente: 1 }, exploitation: { aConfirmer: 3, etablissementsSansTelephone: 1, coursesSansLivreur: 1, livreursEnLigne: 4, candidatsLivreurs: 2 }, catalogue: { enAttenteValidation: 2, publies: 1, suspendus: 0, aCorriger: 1, platsAReconfirmer: 12 } });
    if (sous === "repartition") return ok(res, { ok: true, commandes: commandes.map((c) => ({ id: c.id, reference: c.reference, statut: c.statut, mode: c.mode, sousTotal: c.sousTotal, fraisLivraison: c.fraisLivraisonEstime, creeLe: c.creeLe, estTest: false, restaurantId: "r1", restaurantNom: "Chez Awa (essai)", telephoneRestaurant: "+224622999999", lignes: c.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite })) })) });
    if (sous === "commandes") return ok(res, { ok: true, commandes: commandes.map((c) => ({ id: c.id, reference: c.reference, restaurantNom: "Chez Awa (essai)", restaurantId: "r1", statut: c.statut, mode: c.mode, clientNom: c.clientNom, telephoneAffiche: "+224 6** ** **", adresseAffichee: "Adresse masquée", sousTotal: c.sousTotal, fraisLivraisonEstime: c.fraisLivraisonEstime, creeLe: c.creeLe, historique: [], propositions: [] })) });
    if (sous.startsWith("commandes/")) { const c = commandes[0]; return ok(res, { ok: true, commande: { id: c.id, reference: c.reference, restaurantNom: "Chez Awa (essai)", statut: c.statut, mode: c.mode, clientNom: c.clientNom, telephoneAffiche: "+224 6** ** **", adresseAffichee: "Adresse masquée", sousTotal: c.sousTotal, fraisLivraisonEstime: c.fraisLivraisonEstime, creeLe: c.creeLe, historique: [], propositions: [] }, transitions: ["acceptee", "annulee"], peutReveler: true }); }
    if (sous === "livraisons") return ok(res, { ok: true, livraisons: livraisonsEquipe, livreurs: livreursEquipe });
    if (sous === "menus") return ok(res, { ok: true, fraicheurHeures: 6, menus: [{ restaurantId: "r1", nom: "Chez Awa (essai)", plats: 3, aReconfirmer: 1, epuises: 1, derniereConfirmation: null }] });
    if (sous.startsWith("menus/") && !sous.endsWith("confirmer") && !sous.endsWith("disponibilite")) return ok(res, { ok: true, nom: "Chez Awa (essai)", plats: plats.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix, disponible: p.disponible, confirmeLe: p.confirmeLe, etat: !p.disponible ? "epuise" : p.confirmeLe && p.confirmeLe > "2026-10-22" ? "disponible" : "a_confirmer" })) });
    await lireCorps(req);
    return ok(res, { ok: true, message: "Action enregistrée (simulation)." });
  }

  refus(res, 404, "INTROUVABLE", "Route inconnue du faux serveur.");
}).listen(PORT, () => console.log(`Faux serveur d'essai sur http://localhost:${PORT} (émulateur : http://10.0.2.2:${PORT})`));
