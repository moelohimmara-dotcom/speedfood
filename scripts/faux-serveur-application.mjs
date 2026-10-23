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

const favorisEssai = new Set();
const demandesEssai = [
  { id: "d1", type: "restaurant", organisation: "Chez Fatou", commune: "Ratoma", quartier: "Kipé", indications: "Près du rond-point", categories: "Grillades", specialites: "Poulet braisé", responsable: "Fatou Camara", telephone: "+224 622 10 20 30", statut: "nouvelle", etablissementCree: false, creeLe: "2026-10-22T08:00:00Z" },
  { id: "d2", type: "maquis", organisation: "Maquis du Port", commune: "Kaloum", quartier: "Boulbinet", indications: null, categories: "Poissons", specialites: null, responsable: "Ibrahima Sylla", telephone: "+224 664 00 11 22", statut: "visite_prevue", etablissementCree: false, creeLe: "2026-10-20T15:00:00Z" },
  { id: "d3", type: "restaurant", organisation: "Awa Délices", commune: "Matam", quartier: "Hamdallaye", indications: null, categories: null, specialites: null, responsable: "Awa Bah", telephone: "+224 620 55 44 33", statut: "creee", etablissementCree: true, creeLe: "2026-10-10T12:00:00Z" },
];
const signalementsEssai = [
  { id: "s1", avisId: "a1", motif: "Insultes envers le personnel", date: "2026-10-22T09:00:00Z", restaurantNom: "Chez Awa (essai)", note: 1, commentaire: "Nul, personnel désagréable et plat froid", statutAvis: "publie" },
  { id: "s2", avisId: "a2", motif: "Avis d'un concurrent", date: "2026-10-21T16:30:00Z", restaurantNom: "Chez Awa (essai)", note: 2, commentaire: null, statutAvis: "publie" },
];
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
const restaurantsEquipe = [
  {
    id: "r1", nom: "Chez Awa (essai)", categorie: "Grillades", quartier: "Kipé", publie: true, ouvert: true, suspendu: false,
    motifCorrection: null, modeVente: "speedfood", horaires: "08h00 - 22h00", consignes: "Appeler avant de préparer la commande.",
    telephoneCommandes: "+224622999999", plats: 3, platsDisponibles: 2,
    platsDetail: [
      { id: "p1", nom: "Poulet braisé", prix: 30000, disponible: true, etat: "disponible" },
      { id: "p2", nom: "Riz gras", prix: 35000, disponible: true, etat: "a_confirmer" },
      { id: "p3", nom: "Jus de bissap", prix: 5000, disponible: false, etat: "epuise" },
    ],
  },
  {
    id: "r2", nom: "Maquis du Port", categorie: "Poissons", quartier: "Boulbinet", publie: false, ouvert: false, suspendu: false,
    motifCorrection: "Coordonnées à corriger", modeVente: "autonome", horaires: "10h00 - 21h00", consignes: "",
    telephoneCommandes: null, plats: 0, platsDisponibles: 0, platsDetail: [],
  },
];
const partenariatsEssai = [
  { id: "pa1", forme: "soutenir", organisation: "Association Kaloum Solidarité", nomContact: "Fatou Camara", contactType: "email", contact: "contact@kaloum-solidarite.gn", message: "Nous souhaitons soutenir Speedfood en diffusant ses plats dans nos antennes de quartier.", statut: "nouvelle", creeLe: "2026-10-22T08:00:00Z" },
  { id: "pa2", forme: "moyens", organisation: "Guinée Froid Logistique", nomContact: "Ibrahima Sylla", contactType: "telephone", contact: "+224622334455", message: "Nous voulons fournir la livraison à froid pour les plats Speedfood, sur tout Conakry.", statut: "en_cours", creeLe: "2026-10-20T15:00:00Z" },
  { id: "pa3", forme: "investir", organisation: "Fonds Jeune Guinée", nomContact: "Mamadou Bah", contactType: "email", contact: "contact@fonds-jeune-guinee.gn", message: "Nous étudions un investissement dans le réseau Speedfood en Guinée.", statut: "traitee", creeLe: "2026-10-10T12:00:00Z" },
];
const zonesAttenteEssai = [
  { niveau: "quartier", id: "z1", nom: "Kipé", contexte: "Matam", personnes: 12, prevenues: 4, derniere: "2026-10-22T10:00:00Z" },
  { niveau: "commune", id: "z2", nom: "Ratoma", contexte: "Conakry", personnes: 7, prevenues: 0, derniere: "2026-10-21T18:30:00Z" },
  { niveau: "prefecture", id: "z3", nom: "Boké", contexte: "Boké", personnes: 3, prevenues: 3, derniere: "2026-10-15T09:00:00Z" },
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

  if (chemin === "/api/v1/client/espace") return ok(res, { ok: true, profil: { pseudo: "Client Essai", avatar: "assiette", modePrefere: "livraison", notificationsCommande: true }, adresses: [{ id: "a1", libelle: "Maison", adresse: "Kaporo Centre", parDefaut: true }], favoris: [...favorisEssai].map((id) => ({ restaurantId: id, nom: "Restaurant", ouvert: true })), avis: [] });
  if (chemin === "/api/v1/client/favoris") {
    const c = await lireCorps(req);
    const present = favorisEssai.has(c.restaurantId);
    if (present) favorisEssai.delete(c.restaurantId); else favorisEssai.add(c.restaurantId);
    return ok(res, { ok: true, message: present ? "Favori retiré." : "Favori enregistré.", favori: !present });
  }
  if (chemin.startsWith("/api/v1/client/")) { await lireCorps(req); return ok(res, { ok: true, message: "Enregistré." }); }

  // Espace restaurateur
  if (chemin.startsWith("/api/v1/restaurant/")) {
    if (!compte.roles.restaurateur) return refus(res, 403, "NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant.");
    if (chemin === "/api/v1/restaurant/commandes" && req.method === "GET") return ok(res, { ok: true, restaurant: { id: "r1", nom: compte.roles.restaurateur.restaurant, ouvert: true, accepteCommandes: true }, commandes });
    if (chemin === "/api/v1/restaurant/menu" && req.method === "GET") return ok(res, { ok: true, sections: [{ id: "s1", nom: "Plats" }, { id: "s2", nom: "Boissons" }], plats });
    if (chemin === "/api/v1/restaurant/activite") return ok(res, { ok: true, aujourdhui: { recues: 4, terminees: 3, chiffreGnf: 120000 }, semaine: { recues: 21, terminees: 17, chiffreGnf: 655000 }, repartition: { recues: 21, terminees: 17, refusees: 2, annulees: 1, enCours: 1 }, recentes: [{ reference: "SF-1002", mode: "retrait", totalGnf: 35000, creeLe: maintenant() }, { reference: "SF-0998", mode: "livraison", totalGnf: 60000, creeLe: "2026-10-21T18:20:00Z" }] });
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
    if (chemin === "/api/v1/livreur/gains") return ok(res, { ok: true, gains: { aujourdhui: { courses: 3, fraisGnf: 28500 }, semaine: { courses: 14, fraisGnf: 131000 }, recentes: [{ id: "l9", reference: "SF-1002", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: maintenant() }, { id: "l8", reference: "SF-0998", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: "2026-10-21T18:40:00Z" }] } });
    if (chemin === "/api/v1/livreur/etat") return ok(res, { ok: true, etat: { livreur: { id: "lv1", nom: "Mamadou Barry", statut: "disponible", vehicule: "Moto", cycle: "actif", motifCycle: null, restaurantNom: null }, offre: null, course: null, aNoter: null, positionConnue: true } });
    await lireCorps(req);
    return ok(res);
  }

  // Équipe Speedfood
  if (chemin.startsWith("/api/v1/equipe/")) {
    if (!compte.roles.equipe) return refus(res, 403, "NON_AUTORISE", "Cet espace est réservé à l'équipe Speedfood.");
    const sous = chemin.replace("/api/v1/equipe/", "");
    if (sous === "moi") return ok(res, { ok: true, role: compte.roles.equipe, permissions: ["commande.support", "restaurant.moderer", "attente.gerer"], groupes: [{ libelle: "Exploitation", entrees: [{ chemin: "/system/repartition", libelle: "Poste de répartition", natif: true }, { chemin: "/system/avis", libelle: "Avis", natif: true }, { chemin: "/system/paiements", libelle: "Paiements", natif: true }, { chemin: "/system/catalogue/referencements", libelle: "Référencements", natif: true }, { chemin: "/system/catalogue/restaurants", libelle: "Restaurants", natif: true }, { chemin: "/system/catalogue/partenariats", libelle: "Partenariats", natif: true }, { chemin: "/system/catalogue/liste-attente", libelle: "Liste d'attente", natif: true }, { chemin: "/system/finances", libelle: "Finances", natif: false }] }] });
    if (sous === "tableau") return ok(res, { ok: true, commandes: { activesDuJour: 7, enAttente: 2, propositionsEnAttente: 1 }, exploitation: { aConfirmer: 3, etablissementsSansTelephone: 1, coursesSansLivreur: 1, livreursEnLigne: 4, candidatsLivreurs: 2 }, catalogue: { enAttenteValidation: 2, publies: 1, suspendus: 0, aCorriger: 1, platsAReconfirmer: 12 } });
    if (sous === "repartition") return ok(res, { ok: true, commandes: commandes.map((c) => ({ id: c.id, reference: c.reference, statut: c.statut, mode: c.mode, sousTotal: c.sousTotal, fraisLivraison: c.fraisLivraisonEstime, creeLe: c.creeLe, estTest: false, restaurantId: "r1", restaurantNom: "Chez Awa (essai)", telephoneRestaurant: "+224622999999", lignes: c.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite })) })) });
    if (sous === "commandes") return ok(res, { ok: true, commandes: commandes.map((c) => ({ id: c.id, reference: c.reference, restaurantNom: "Chez Awa (essai)", restaurantId: "r1", statut: c.statut, mode: c.mode, clientNom: c.clientNom, telephoneAffiche: "+224 6** ** **", adresseAffichee: "Adresse masquée", sousTotal: c.sousTotal, fraisLivraisonEstime: c.fraisLivraisonEstime, creeLe: c.creeLe, historique: [], propositions: [] })) });
    if (sous.startsWith("commandes/")) { const c = commandes[0]; return ok(res, { ok: true, commande: { id: c.id, reference: c.reference, restaurantNom: "Chez Awa (essai)", statut: c.statut, mode: c.mode, clientNom: c.clientNom, telephoneAffiche: "+224 6** ** **", adresseAffichee: "Adresse masquée", sousTotal: c.sousTotal, fraisLivraisonEstime: c.fraisLivraisonEstime, creeLe: c.creeLe, historique: [], propositions: [] }, transitions: ["acceptee", "annulee"], peutReveler: true }); }
    if (sous === "referencements") return ok(res, { ok: true, demandes: demandesEssai });
    if (sous === "referencements/statut") {
      const c = await lireCorps(req);
      const d = demandesEssai.find((x) => x.id === c.id);
      if (!d || d.etablissementCree) return refus(res, 400, "VALIDATION", "Cette demande n'existe plus ou son établissement est déjà créé.");
      d.statut = c.statut;
      return ok(res, { ok: true, message: "Statut enregistré." });
    }
    if (sous === "restaurants") return ok(res, { ok: true, restaurants: restaurantsEquipe.map(({ platsDetail, ...reste }) => reste) });
    if (sous.startsWith("restaurants/") && sous.endsWith("/profil")) {
      const id = sous.slice("restaurants/".length, -"/profil".length);
      const r = restaurantsEquipe.find((x) => x.id === id);
      if (!r) return refus(res, 404, "INTROUVABLE", "Établissement introuvable.");
      const c = await lireCorps(req);
      const horaires = String(c.horaires ?? "").trim();
      if (!horaires) return refus(res, 400, "VALIDATION", "Renseignez les horaires avant d'enregistrer.");
      if (horaires.length > 500) return refus(res, 400, "VALIDATION", "Les horaires ne peuvent pas dépasser 500 caractères.");
      const brut = String(c.telephone ?? "").trim();
      let telephone = null;
      if (brut !== "") {
        const chiffres = brut.replace(/[\s.\-()]/g, "");
        const m = chiffres.match(/^(?:\+|00)?224(?:0)?([67]\d{8})$/) ?? chiffres.match(/^0?([67]\d{8})$/);
        if (!m) return refus(res, 400, "VALIDATION", "Ce numéro n'est pas un numéro guinéen valide.");
        telephone = `+224${m[1]}`;
      }
      r.horaires = horaires;
      r.telephoneCommandes = telephone;
      return ok(res, { ok: true, message: "Horaires et numéro à joindre enregistrés." });
    }
    if (sous.startsWith("restaurants/")) {
      const id = sous.slice("restaurants/".length);
      const r = restaurantsEquipe.find((x) => x.id === id);
      if (!r) return refus(res, 404, "INTROUVABLE", "Établissement introuvable.");
      return ok(res, { ok: true, restaurant: r });
    }
    if (sous === "partenariats") return ok(res, { ok: true, partenariats: partenariatsEssai });
    if (sous === "partenariats/statut") {
      const c = await lireCorps(req);
      const d = partenariatsEssai.find((x) => x.id === c.id);
      if (!d) return refus(res, 404, "INTROUVABLE", "Demande introuvable.");
      const statuts = ["nouvelle", "en_cours", "traitee", "classee"];
      if (!statuts.includes(c.statut)) return refus(res, 400, "VALIDATION", "Statut inconnu.");
      d.statut = c.statut;
      return ok(res, { ok: true, message: "Statut enregistré." });
    }
    if (sous === "liste-attente") return ok(res, { ok: true, zones: zonesAttenteEssai });
    if (sous === "liste-attente/prevenue") {
      const c = await lireCorps(req);
      const z = zonesAttenteEssai.find((x) => x.niveau === c.niveau && x.id === c.id);
      if (!z) return refus(res, 404, "INTROUVABLE", "Zone introuvable.");
      const restantes = Math.max(0, z.personnes - z.prevenues);
      z.prevenues = z.personnes;
      return ok(res, { ok: true, message: `${restantes} personne(s) marquée(s) comme prévenue(s).` });
    }
    if (sous === "paiements") return ok(res, { ok: true, reglages: { actif: false, fournisseur: "simulation", valeursValidees: false }, compteurs: { enAttente: 1, versementsATraiter: 2, litigesAHumain: 1 }, paiements: [{ id: "p1", commandeReference: "SF-1002", restaurantNom: "Chez Awa (essai)", etat: "libere", operateur: "orange_money", fournisseur: "simulation", totalGnf: 44500, restaurantGnf: 35000, livreurGnf: 5000, speedfoodBrutGnf: 4500, fraisMobileGnf: 890, rembourseGnf: 0, creeLe: "2026-10-22T09:00:00Z", versements: [{ beneficiaire: "restaurant", etat: "echoue", montantGnf: 35000, erreurCode: "versement_manuel_requis" }, { beneficiaire: "livreur", etat: "confirme", montantGnf: 5000, erreurCode: null }], litiges: [{ situation: "commande_non_livree", etat: "a_humain", regle: null }] }, { id: "p2", commandeReference: "SF-1001", restaurantNom: "Chez Awa (essai)", etat: "en_attente", operateur: "mtn_momo", fournisseur: "simulation", totalGnf: 69500, restaurantGnf: 60000, livreurGnf: 0, speedfoodBrutGnf: 9500, fraisMobileGnf: 1390, rembourseGnf: 0, creeLe: "2026-10-22T10:30:00Z", versements: [], litiges: [] }] });
    if (sous === "avis") return ok(res, { ok: true, signalements: signalementsEssai, alertes: [{ type: "restaurant_sous_seuil", cible: "Chez Awa (essai)", detail: "3,2 sur 6 avis" }] });
    if (sous === "avis/moderation") {
      const c = await lireCorps(req);
      if ((c.action === "masquer_commentaire" || c.action === "annuler_note") && String(c.motif ?? "").trim().length < 5) return refus(res, 400, "VALIDATION", "Indiquez le motif (5 caractères au moins).");
      const i = signalementsEssai.findIndex((s) => s.avisId === c.avisId);
      if (i >= 0) { if (c.action === "classer_sans_suite" || c.action === "retablir") signalementsEssai.splice(i, 1); else signalementsEssai[i].statutAvis = c.action === "annuler_note" ? "annule" : "commentaire_masque"; }
      return ok(res, { ok: true, message: "Décision enregistrée." });
    }
    if (sous === "livraisons") return ok(res, { ok: true, livraisons: livraisonsEquipe, livreurs: livreursEquipe });
    if (sous === "menus") return ok(res, { ok: true, fraicheurHeures: 6, menus: [{ restaurantId: "r1", nom: "Chez Awa (essai)", plats: 3, aReconfirmer: 1, epuises: 1, derniereConfirmation: null }] });
    if (sous.startsWith("menus/") && !sous.endsWith("confirmer") && !sous.endsWith("disponibilite")) return ok(res, { ok: true, nom: "Chez Awa (essai)", plats: plats.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix, disponible: p.disponible, confirmeLe: p.confirmeLe, etat: !p.disponible ? "epuise" : p.confirmeLe && p.confirmeLe > "2026-10-22" ? "disponible" : "a_confirmer" })) });
    await lireCorps(req);
    return ok(res, { ok: true, message: "Action enregistrée (simulation)." });
  }

  refus(res, 404, "INTROUVABLE", "Route inconnue du faux serveur.");
}).listen(PORT, () => console.log(`Faux serveur d'essai sur http://localhost:${PORT} (émulateur : http://10.0.2.2:${PORT})`));
