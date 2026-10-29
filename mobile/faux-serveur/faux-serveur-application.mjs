// Faux serveur LOCAL pour auditer l'application dans l'émulateur avec des comptes et des données factices, sans toucher à la base de production.
//
// Usage : node mobile/faux-serveur/faux-serveur-application.mjs   (écoute sur le port 8787 ; l'émulateur y accède par http://10.0.2.2:8787)
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
const candidatures = new Map();
const demandesEssai = [
  { id: "d1", type: "restaurant", organisation: "Chez Fatou", commune: "Ratoma", quartier: "Kipé", indications: "Près du rond-point", categories: "Grillades", specialites: "Poulet braisé", responsable: "Fatou Camara", telephone: "+224 622 10 20 30", statut: "nouvelle", etablissementCree: false, creeLe: "2026-10-22T08:00:00Z" },
  { id: "d2", type: "maquis", organisation: "Maquis du Port", commune: "Kaloum", quartier: "Boulbinet", indications: null, categories: "Poissons", specialites: null, responsable: "Ibrahima Sylla", telephone: "+224 664 00 11 22", statut: "visite_prevue", etablissementCree: false, creeLe: "2026-10-20T15:00:00Z" },
  { id: "d3", type: "restaurant", organisation: "Awa Délices", commune: "Matam", quartier: "Hamdallaye", indications: null, categories: null, specialites: null, responsable: "Awa Bah", telephone: "+224 620 55 44 33", statut: "creee", etablissementCree: true, creeLe: "2026-10-10T12:00:00Z" },
];
// Candidature déposée dans l'application (dossier visible, compte à rattacher une fois l'établissement créé).
demandesEssai.push({ id: "d4", type: "restaurant", organisation: "Chez Mariama", commune: "Ratoma", quartier: "Kipé", indications: null, categories: null, specialites: null, responsable: "Mariama Diallo", telephone: "+224 621 33 44 55", statut: "accord", etablissementCree: false, creeLe: "2026-10-26T09:00:00Z",
  candidature: { horaires: "Tous les jours 9h-22h", moyensPaiement: ["especes", "orange_money"], services: ["livraison", "sur_place"], nombrePlats: 12, avecLogo: true, avecPhoto: false, motifRefus: null, compteRattachable: false, compteRattache: false } });
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
const bannieresEssai = [
  { id: "ban1", titre: "Livraison offerte ce week-end", texte: "La livraison est offerte sur toutes les commandes au-dessus de 20 000 GNF.", lien: "/restaurants", statut: "publie", ordre: 1, imageUrl: "https://images.exemple.test/banniere-offre.png", creeLe: "2026-10-18T09:00:00Z", misAJourLe: "2026-10-20T11:00:00Z" },
  { id: "ban2", titre: "Rentrée des prix", texte: "Les restaurateurs mettent à jour leurs plats pour la rentrée.", lien: null, statut: "publie", ordre: 2, imageUrl: null, creeLe: "2026-10-19T09:00:00Z", misAJourLe: "2026-10-19T09:00:00Z" },
  { id: "ban3", titre: "Menu de fin d'année", texte: "Un menu de fin d'année proposé par trois chefs de quartier.", lien: "/restaurants", statut: "brouillon", ordre: 3, imageUrl: "https://images.exemple.test/banniere-menu.png", creeLe: "2026-10-22T09:00:00Z", misAJourLe: "2026-10-22T09:00:00Z" },
];
const journalAuditEssai = [
  { id: "au1", horodatage: "2026-10-23T08:15:00Z", action: "restaurant.approbation", acteurEmail: "equipe@test.sf", cibleType: "restaurant", cibleId: "r1f0c2d4e5a6b7c8d", motif: "Dossier complet, photos conformes." },
  { id: "au2", horodatage: "2026-10-22T14:40:00Z", action: "restaurant.suspension", acteurEmail: "operations@speedfood.gn", cibleType: "restaurant", cibleId: "r2a1b2c3d4e5f6a7b", motif: "Retard répété des livraisons signalé par les clients." },
  { id: "au3", horodatage: "2026-10-21T09:05:00Z", action: "coordonnees.revelation", acteurEmail: "support@speedfood.gn", cibleType: "commande", cibleId: "c1d2e3f4a5b6c7d8e", motif: "Procédure support, dossier 4412 : le client a demandé le numéro du livreur." },
  { id: "au4", horodatage: "2026-10-18T16:30:00Z", action: "compte.invitation", acteurEmail: "equipe@test.sf", cibleType: "utilisateur", cibleId: "u-nouveau-membre", motif: null },
  { id: "au5", horodatage: "2026-10-02T11:00:00Z", action: "restaurant.horaires_modifies", acteurEmail: "operations@speedfood.gn", cibleType: "restaurant", cibleId: "r3b4c5d6e7f8a9b0c", motif: "Ouverture le dimanche à partir de novembre." },
  { id: "au6", horodatage: "2026-09-20T10:00:00Z", action: "livraison.reglages_modifies", acteurEmail: null, cibleType: "parametres_application", cibleId: "livraison", motif: null },
];
const actionsAuditEssai = [
  { code: "restaurant.approbation", libelle: "Restaurant approuvé" },
  { code: "restaurant.demande_correction", libelle: "Correction demandée à un restaurant" },
  { code: "restaurant.suspension", libelle: "Restaurant suspendu" },
  { code: "restaurant.reactivation", libelle: "Restaurant réactivé" },
  { code: "restaurant.horaires_modifies", libelle: "Horaires du restaurant modifiés" },
  { code: "restaurant.profil_modifie", libelle: "Profil du restaurant modifié" },
  { code: "restaurant.quartier_modifie", libelle: "Quartier du restaurant modifié" },
  { code: "coordonnees.revelation", libelle: "Coordonnées d'un client révélées" },
  { code: "compte.invitation", libelle: "Membre ajouté à une équipe" },
  { code: "compte.revocation", libelle: "Membre retiré d'une équipe" },
  { code: "livraison.reglages_modifies", libelle: "Réglages de livraison modifiés" },
  { code: "avis.masquer_commentaire", libelle: "Commentaire d'avis masqué" },
];
const periodesAuditEssai = [
  { valeur: null, libelle: "Tout l'historique" },
  { valeur: 1, libelle: "24 heures" },
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
];
const ciblesAuditEssai = {
  restaurant: { libelle: "Restaurant", section: "/system/catalogue/restaurants" },
  commande: { libelle: "Commande", section: "/system/commandes" },
  utilisateur: { libelle: "Compte", section: "/system/acces/comptes" },
  content_page: { libelle: "Page d'aide", section: "/system/contenu/pages" },
  content_banner: { libelle: "Bannière", section: "/system/contenu/bannieres" },
  parametres_application: { libelle: "Paramètres", section: "/system/parametres" },
  menu_categories: { libelle: "Catégories", section: "/system/catalogue/taxonomie" },
};
const comptesEssai = [
  { utilisateurId: "u-equipe", email: "equipe@test.sf", creeLe: "2026-09-01T08:00:00Z", roleSysteme: "super_admin", restaurants: [], test: false },
  { utilisateurId: "u-resto", email: "resto@test.sf", creeLe: "2026-09-12T08:00:00Z", roleSysteme: null, restaurants: [{ restaurantId: "r1", nom: "Chez Awa (essai)", role: "owner" }], test: false },
  { utilisateurId: "u-livreur", email: "livreur@test.sf", creeLe: "2026-10-05T08:00:00Z", roleSysteme: null, restaurants: [{ restaurantId: "r2", nom: "Maquis du Port", role: "manager" }], test: false },
  { utilisateurId: "u-test", email: "bloc8b-essai@example.com", creeLe: "2026-10-02T08:00:00Z", roleSysteme: null, restaurants: [], test: true },
];

const ok = (res, corps = { ok: true }, statut = 200) => {
  res.writeHead(statut, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corps));
};
const refus = (res, statut, code, message) => ok(res, { ok: false, erreur: { code, message } }, statut);
const lireCorps = (req) => new Promise((r) => { let t = ""; req.on("data", (d) => (t += d)); req.on("end", () => { try { r(t ? JSON.parse(t) : {}); } catch { r({}); } }); });
const session = (email) => ({ access_token: `tok-${email}`, refresh_token: `ref-${email}`, expires_in: 3600, token_type: "bearer", user: { id: COMPTES[email].id, email } });

// Routes factices ajoutées par les lots : un fichier par domaine, nommé mobile/faux-serveur/faux-serveur-<espace>-<domaine>.mjs.
// Chaque module exporte { espace, routes } ; routes associe un sous-chemin à un gestionnaire asynchrone.
// Ce point d'extension existe pour que plusieurs agents travaillent en parallèle sans éditer le même fichier.
const dossierFauxServeur = new URL(".", import.meta.url);
const modulesFactices = [];
for (const nom of (await import("node:fs")).readdirSync(dossierFauxServeur)) {
  const reconnu = /^faux-serveur-(equipe|restaurant|livreur|client)-[a-z0-9-]+\.mjs$/.exec(nom);
  if (!reconnu) continue;
  const moduleFactice = await import(new URL(nom, dossierFauxServeur).href);
  const espace = moduleFactice.espace ?? reconnu[1];
  modulesFactices[espace] = Object.assign(modulesFactices[espace] ?? {}, moduleFactice.routes ?? {});
}
const executerRouteFactice = async (res, route, ctx) => {
  const resultat = await route(ctx);
  if (resultat && typeof resultat.statut === "number") {
    return refus(res, resultat.statut, resultat.code ?? "ERREUR_SERVEUR", resultat.message ?? "La demande n'a pas pu être traitée.");
  }
  return ok(res, { ok: true, ...(resultat ?? {}) });
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chemin = url.pathname;
  console.log(req.method, chemin + url.search);

  if (chemin === "/__revoquer") { revoque = true; return ok(res, { revoque }); }
  if (chemin === "/__restaurer") { revoque = false; return ok(res, { revoque }); }

  // Lectures publiques : un module client peut fournir ses propres données (clé « rest/<table> ») ; sinon relais lecture seule vers la vraie base.
  if (chemin.startsWith("/rest/v1/") && req.method === "GET") {
    const donneesFactices = modulesFactices.client?.["rest/" + chemin.slice("/rest/v1/".length)];
    if (donneesFactices) return ok(res, await donneesFactices({ url }));
    try {
      const r = await fetch(REEL + chemin + url.search, { headers: { apikey: req.headers.apikey ?? "", authorization: `Bearer ${req.headers.apikey ?? ""}` } });
      res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "application/json" });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      ok(res, [], 502);
    }
    return;
  }

  if (chemin === "/auth/v1/settings") return ok(res, { external: { email: true, google: false, facebook: true } });
  if (chemin === "/auth/v1/token") {
    const corps = await lireCorps(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      if (revoque) return ok(res, { error: "invalid_grant", error_description: "Refresh Token Not Found" }, 400);
      const email = String(corps.refresh_token ?? "").replace(/^ref-/, "");
      return COMPTES[email] ? ok(res, session(email)) : ok(res, { error: "invalid_grant", error_description: "Refresh Token Not Found" }, 400);
    }
    // Retour de la connexion Facebook (PKCE) : tout code non vide ouvre le compte client factice.
    if (grant === "pkce") return corps.auth_code && corps.code_verifier ? ok(res, session("client@test.sf")) : ok(res, { error: "invalid_grant", error_description: "invalid flow state" }, 400);
    const email = String(corps.email ?? "").toLowerCase();
    if (!COMPTES[email]) return ok(res, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials" }, 400);
    return ok(res, session(email));
  }
  // Inscription sans confirmation d'e-mail pour les adresses « auto… » (simule le réglage « Confirm email » désactivé) : le compte client est créé et une session est rendue.
  if (chemin === "/auth/v1/signup" && req.method === "POST") {
    const corps = await lireCorps(req);
    const email = String(corps.email ?? "").toLowerCase();
    if (email.startsWith("auto")) {
      COMPTES[email] ??= { id: "u-" + email, roles: {} };
      return ok(res, session(email));
    }
    return ok(res, {});
  }
  if (chemin === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  if (chemin.startsWith("/auth/v1/")) return ok(res, {});

  if (chemin === "/api/v1/version") return ok(res, { ok: true, version: { code: 33, nom: "2.31.0", notes: "", obligatoire: false } });
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

  if (chemin === "/api/v1/connexion/fournisseurs") return ok(res, { ok: true, facebook: true });

  const compte = parJeton(req);
  if (chemin.startsWith("/api/v1/") && !compte) return refus(res, 401, "NON_AUTHENTIFIE", "Connectez-vous avec votre compte.");

  // Lecture d'une photo de menu (lot R3) : réponse fixe, comme le ferait le Chef IA (un plat sans prix lisible et un prix hors limites passent en « refusés »).
  if (chemin === "/api/v1/candidature/menu-photo" && req.method === "POST") {
    for await (const _ of req);
    return ok(res, { ok: true, lecture: { plats: [{ nom: "Poulet braisé", prix: 40000 }, { nom: "Riz sauce feuille", prix: 25000 }, { nom: "Jus de bissap", prix: 8000 }], refuses: [{ brut: "Brochettes de bœuf", raison: "prix illisible — à saisir à la main" }], etat: "plats" } });
  }
  // Candidature « J'ai un restaurant » (lot R1/R2) : une demande par compte, en mémoire.
  if (chemin === "/api/v1/candidature" || chemin === "/api/v1/candidature/image") {
    const existante = candidatures.get(compte.email);
    if (chemin === "/api/v1/candidature" && req.method === "GET") return ok(res, { ok: true, candidature: existante ?? null });
    if (chemin === "/api/v1/candidature" && req.method === "POST") {
      const c = await lireCorps(req);
      if (existante) return ok(res, { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Vous avez déjà une demande en cours : suivez-la depuis votre espace." } }, 409);
      if (!c.nom || !c.quartierId || !c.telephone) return ok(res, { ok: false, erreur: { code: "VALIDATION", message: "Demande incomplète." } }, 400);
      const vue = { id: "cand-" + candidatures.size, etat: "recue", libelleEtat: "Demande reçue", nom: c.nom, deposeeLe: maintenant(), delaiHeures: 48, reponseAttendueLe: new Date(Date.now() + 48 * 3600_000).toISOString(), motifRefus: null, aLogo: false, aPhoto: false, nombrePlats: Array.isArray(c.plats) ? c.plats.length : 0 };
      candidatures.set(compte.email, vue);
      return ok(res, { ok: true, candidature: vue }, 201);
    }
    if (chemin === "/api/v1/candidature/image" && req.method === "POST" && existante) {
      const morceaux = []; for await (const m of req) morceaux.push(m);
      const brut = Buffer.concat(morceaux).toString("latin1");
      if (brut.includes('name="type"') && brut.includes("logo")) existante.aLogo = true; else existante.aPhoto = true;
      return ok(res, { ok: true, candidature: existante });
    }
    return ok(res, { ok: false, erreur: { code: "INTROUVABLE", message: "Aucune demande." } }, 404);
  }

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
    const sousR = chemin.replace("/api/v1/restaurant/", "");
    const routeR = modulesFactices.restaurant?.[sousR];
    if (routeR) return executerRouteFactice(res, routeR, { corps: await lireCorps(req), compte, sous: sousR, methode: req.method });
    await lireCorps(req);
    return ok(res);
  }

  // Espace livreur
  if (chemin.startsWith("/api/v1/livreur/")) {
    if (!compte.roles.livreur) return ok(res, { ok: true, etat: null });
    if (chemin === "/api/v1/livreur/gains") return ok(res, { ok: true, gains: { aujourdhui: { courses: 3, fraisGnf: 28500 }, semaine: { courses: 14, fraisGnf: 131000 }, recentes: [{ id: "l9", reference: "SF-1002", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: maintenant() }, { id: "l8", reference: "SF-0998", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: "2026-10-21T18:40:00Z" }] } });
    if (chemin === "/api/v1/livreur/etat") return ok(res, { ok: true, etat: { livreur: { id: "lv1", nom: "Mamadou Barry", statut: "disponible", vehicule: "Moto", cycle: "actif", motifCycle: null, restaurantNom: null }, offre: null, course: null, aNoter: null, positionConnue: true } });
    const sousL = chemin.replace("/api/v1/livreur/", "");
    const routeL = modulesFactices.livreur?.[sousL];
    if (routeL) return executerRouteFactice(res, routeL, { corps: await lireCorps(req), compte, sous: sousL, methode: req.method });
    await lireCorps(req);
    return ok(res);
  }

  // Équipe Speedfood
  if (chemin.startsWith("/api/v1/equipe/")) {
    if (!compte.roles.equipe) return refus(res, 403, "NON_AUTORISE", "Cet espace est réservé à l'équipe Speedfood.");
    const sous = chemin.replace("/api/v1/equipe/", "");
    if (sous === "moi") return ok(res, { ok: true, role: compte.roles.equipe, permissions: ["commande.support", "restaurant.moderer", "attente.gerer", "compte.consulter", "contenu.editer", "parametres.editer", "systeme.audit"], groupes: [{ libelle: "Exploitation", entrees: [{ chemin: "/system/repartition", libelle: "Poste de répartition", natif: true }, { chemin: "/system/avis", libelle: "Avis", natif: true }, { chemin: "/system/paiements", libelle: "Paiements", natif: true }, { chemin: "/system/catalogue/referencements", libelle: "Référencements", natif: true }, { chemin: "/system/catalogue/restaurants", libelle: "Restaurants", natif: true }, { chemin: "/system/catalogue/partenariats", libelle: "Partenariats", natif: true }, { chemin: "/system/catalogue/liste-attente", libelle: "Liste d'attente", natif: true }, { chemin: "/system/finances", libelle: "Finances", natif: false }] }, { libelle: "Accès", entrees: [{ chemin: "/system/acces/comptes", libelle: "Comptes utilisateurs", natif: true }, { chemin: "/system/acces/roles", libelle: "Rôles système", natif: false }] }, { libelle: "Contenu", entrees: [{ chemin: "/system/contenu/pages", libelle: "Pages", natif: false }, { chemin: "/system/contenu/bannieres", libelle: "Bannières", natif: true }, { chemin: "/system/contenu/medias", libelle: "Médias", natif: true }, { chemin: "/system/contenu/textes", libelle: "Textes du site", natif: false }] }, { libelle: "Paramètres", entrees: [{ chemin: "/system/parametres", libelle: "Paramètres", natif: true }, { chemin: "/system/design", libelle: "Design", natif: false }, { chemin: "/system/mises-a-jour", libelle: "Mises à jour", natif: true }] }, { libelle: "Audit", entrees: [{ chemin: "/system/audit", libelle: "Journal d'audit", natif: true }] }] });
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
      if (d.candidature) d.candidature.motifRefus = c.statut === "refusee" ? (c.motif || "L'équipe vous a expliqué la raison par téléphone.") : null;
      return ok(res, { ok: true, message: "Statut enregistré." });
    }
    if (sous === "referencements/options") return ok(res, { ok: true, categories: [{ id: "c1", nom: "Grillades" }, { id: "c2", nom: "Cuisine guinéenne" }, { id: "c3", nom: "Pizzas" }], quartiers: [{ id: "q1", nom: "Kipé", commune: "Ratoma" }, { id: "q2", nom: "Boulbinet", commune: "Kaloum" }, { id: "q3", nom: "Hamdallaye", commune: "Matam" }] });
    if (sous === "referencements/creer-etablissement") {
      const c = await lireCorps(req);
      const d = demandesEssai.find((x) => x.id === c.id);
      if (!d || d.etablissementCree) return refus(res, 400, "VALIDATION", "Un établissement a déjà été créé pour cette demande.");
      d.etablissementCree = true; d.statut = "creee";
      if (d.candidature) d.candidature.compteRattachable = true;
      return ok(res, { ok: true, restaurantId: "r-essai", message: "Établissement créé (non publié)." });
    }
    if (sous === "referencements/rattacher") {
      const c = await lireCorps(req);
      const d = demandesEssai.find((x) => x.id === c.id);
      if (!d || !d.candidature || !d.candidature.compteRattachable) return refus(res, 400, "VALIDATION", "Cette demande n'a pas de compte à rattacher.");
      d.candidature.compteRattachable = false; d.candidature.compteRattache = true;
      return ok(res, { ok: true, message: "Compte rattaché à l'établissement." });
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
    if (sous === "comptes") {
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const type = url.searchParams.get("type") ?? "tous";
      const comptes = comptesEssai.filter((c) => {
        if (q && !c.email.toLowerCase().includes(q)) return false;
        if (type === "restaurateur") return c.restaurants.length > 0;
        if (type === "systeme") return c.roleSysteme !== null;
        if (type === "sans_affiliation") return c.restaurants.length === 0 && !c.roleSysteme;
        if (type === "test") return c.test;
        return true;
      });
      return ok(res, { ok: true, comptes, tronque: false });
    }
    if (sous === "bannieres" || sous === "medias") {
      const statut = sous === "medias" ? "tous" : (url.searchParams.get("statut") ?? "tous");
      const bannieres = bannieresEssai.filter((b) => {
        if (sous === "medias" && !b.imageUrl) return false;
        if (statut === "publie") return b.statut === "publie";
        if (statut === "brouillon") return b.statut === "brouillon";
        return true;
      });
      return ok(res, { ok: true, bannieres, tronque: false });
    }
    if (sous === "mises-a-jour") {
      return ok(res, {
        ok: true,
        version: { code: 33, nom: "2.31.0", notes: "Équipe Speedfood : journal d'audit dans l'application." },
        appareils: 6,
        annonce: { versionCode: 31, versionNom: "2.29.0", annonceeLe: "2026-10-23T11:20:00Z", appareils: 4, envoyes: 4 },
        fonctionnalites: [
          { cle: "zones_livraison", libelle: "Zones de livraison", description: "Affiche les zones desservies par chaque restaurant.", groupe: "public", active: true, miseAJourLe: "2026-10-14T09:00:00Z" },
          { cle: "animations", libelle: "Animations d'accueil", description: "Animations de l'écran d'accueil du site.", groupe: "public", active: false, miseAJourLe: "2026-10-05T09:00:00Z" },
          { cle: "suivi_direct", libelle: "Suivi direct", description: "Position du livreur vue par le client pendant la course.", groupe: "commande", active: true, miseAJourLe: "2026-10-18T09:00:00Z" },
        ],
        misesAJour: [
          { id: "zones", date: "2026-10-14", titre: "Zones desservies", resume: "Les zones de livraison s'affichent maintenant sur la fiche du restaurant.", verification: "Ouvrir un restaurant depuis l'accueil.", cle: "zones_livraison", active: true, raisonSansInterrupteur: null, groupe: "public" },
          { id: "animations", date: "2026-10-05", titre: "Animations d'accueil", resume: "Animations de l'écran d'accueil, désactivables à chaud.", verification: "Accueil de l'application.", cle: "animations", active: false, raisonSansInterrupteur: null, groupe: "public" },
          { id: "paiement", date: "2026-10-04", titre: "Paiement", resume: "Refonte du parcours de paiement.", verification: "Passer une commande de test.", cle: null, active: null, raisonSansInterrupteur: "Le parcours de l'argent ne peut pas être coupé à chaud : il est piloté par le prestataire de paiement.", groupe: null },
        ],
      });
    }
    if (sous === "parametres") {
      return ok(res, {
        ok: true,
        parametres: {
          commandePropositionDelaiMinutes: 30,
          prixPlatMaxGnf: 5000000,
          disponibiliteFraicheurHeures: 6,
          conservationCoordonneesJours: 90,
          conservationNonClotureeJours: 30,
          conservationAuditMois: 12,
          whatsappAssistance: "+224622000000",
          delaiValidationHeures: null,
          positionCarteActive: true,
          promesseSignature: "La commande juste et rapide",
          promesseSousTitre: "Chefs de quartier, livrés chez vous",
          promessePartage: "Commandez chez Speedfood",
          connexionFacebookActive: false,
          connexionGoogleActive: true,
        },
      });
    }
    if (sous === "paiements") return ok(res, { ok: true, reglages: { actif: false, fournisseur: "simulation", valeursValidees: false }, compteurs: { enAttente: 1, versementsATraiter: 2, litigesAHumain: 1 }, paiements: [{ id: "p1", commandeReference: "SF-1002", restaurantNom: "Chez Awa (essai)", etat: "libere", operateur: "orange_money", fournisseur: "simulation", totalGnf: 44500, restaurantGnf: 35000, livreurGnf: 5000, speedfoodBrutGnf: 4500, fraisMobileGnf: 890, rembourseGnf: 0, creeLe: "2026-10-22T09:00:00Z", versements: [{ beneficiaire: "restaurant", etat: "echoue", montantGnf: 35000, erreurCode: "versement_manuel_requis" }, { beneficiaire: "livreur", etat: "confirme", montantGnf: 5000, erreurCode: null }], litiges: [{ situation: "commande_non_livree", etat: "a_humain", regle: null }] }, { id: "p2", commandeReference: "SF-1001", restaurantNom: "Chez Awa (essai)", etat: "en_attente", operateur: "mtn_momo", fournisseur: "simulation", totalGnf: 69500, restaurantGnf: 60000, livreurGnf: 0, speedfoodBrutGnf: 9500, fraisMobileGnf: 1390, rembourseGnf: 0, creeLe: "2026-10-22T10:30:00Z", versements: [], litiges: [] }] });
    if (sous === "avis") return ok(res, { ok: true, signalements: signalementsEssai, alertes: [{ type: "restaurant_sous_seuil", cible: "Chez Awa (essai)", detail: "3,2 sur 6 avis" }] });
    if (sous === "audit") {
      const action = url.searchParams.get("action");
      const depuis = Number.parseInt(url.searchParams.get("depuis") ?? "", 10);
      const actionConnue = actionsAuditEssai.some((a) => a.code === action) ? action : null;
      const depuisMs = Number.isFinite(depuis) && [1, 7, 30].includes(depuis) ? Date.now() - depuis * 24 * 60 * 60 * 1000 : null;
      const journal = journalAuditEssai
        .filter((e) => (!actionConnue || e.action === actionConnue) && (!depuisMs || new Date(e.horodatage).getTime() >= depuisMs))
        .map((e) => {
          const cible = ciblesAuditEssai[e.cibleType];
          const section = cible ? cible.section : null;
          return {
            id: e.id,
            horodatage: e.horodatage,
            action: e.action,
            libelle: actionsAuditEssai.find((a) => a.code === e.action)?.libelle ?? e.action,
            acteurEmail: e.acteurEmail,
            auteur: e.acteurEmail && e.acteurEmail.trim() ? e.acteurEmail : "acteur inconnu",
            cibleType: e.cibleType,
            cibleId: e.cibleId,
            cible: `${cible ? cible.libelle : e.cibleType} ${e.cibleId.slice(0, 8)}`,
            cibleUrl: section ? (e.cibleType === "restaurant" || e.cibleType === "commande" ? `${section}/${e.cibleId}` : section) : null,
            motif: e.motif,
          };
        });
      return ok(res, {
        ok: true,
        indicateurs: [
          { cle: "restaurants_en_attente", libelle: "Restaurants en attente de validation", definition: "Restaurants créés mais ni publiés, ni suspendus, ni en attente d'une correction demandée (jamais examinés).", valeur: 2 },
          { cle: "restaurants_suspendus", libelle: "Restaurants suspendus", definition: "Restaurants avec une date de suspension active (suspendu_le non nul).", valeur: 1 },
          { cle: "commandes_actives", libelle: "Commandes actives", definition: "Commandes dont le statut est « en attente », « acceptée » ou « prête » (ni terminale, ni refusée, ni annulée), tous restaurants confondus.", valeur: 7 },
          { cle: "revelations_coordonnees_7j", libelle: "Révélations de coordonnées (7 derniers jours)", definition: "Nombre d'accès exceptionnels aux coordonnées d'un client (téléphone/adresse en clair) via le support, sur les 7 derniers jours glissants.", valeur: 1 },
        ],
        actions: actionsAuditEssai,
        periodes: periodesAuditEssai,
        journal,
        tronque: false,
      });
    }
    if (sous === "avis/moderation") {
      const c = await lireCorps(req);
      if ((c.action === "masquer_commentaire" || c.action === "annuler_note") && String(c.motif ?? "").trim().length < 5) return refus(res, 400, "VALIDATION", "Indiquez le motif (5 caractères au moins).");
      const i = signalementsEssai.findIndex((s) => s.avisId === c.avisId);
      if (i >= 0) { if (c.action === "classer_sans_suite" || c.action === "retablir") signalementsEssai.splice(i, 1); else signalementsEssai[i].statutAvis = c.action === "annuler_note" ? "annule" : "commentaire_masque"; }
      return ok(res, { ok: true, message: "Décision enregistrée." });
    }
    if (sous === "livraisons") return ok(res, { ok: true, livraisons: livraisonsEquipe, livreurs: livreursEquipe });
    if (sous === "menus") return ok(res, { ok: true, fraicheurHeures: 6, menus: [{ restaurantId: "r1", nom: "Chez Awa (essai)", plats: 3, aReconfirmer: 1, epuises: 1, derniereConfirmation: null }] });
    // Menu par photo, côté équipe (lot R5) : lecture fixe (qui présente « Riz sauce feuille » comme déjà au menu, pour montrer ce cas) puis import en mémoire.
    if (sous.startsWith("menus/") && sous.endsWith("/photo") && req.method === "POST") {
      for await (const _ of req);
      return ok(res, { ok: true, lecture: { plats: [{ nom: "Brochettes de bœuf", prix: 30000 }, { nom: "Jus de gingembre", prix: 6000 }], refuses: [{ brut: "Riz sauce feuille", raison: "déjà au menu : à corriger à la main si le prix a changé" }, { brut: "Poisson braisé", raison: "prix illisible — à saisir à la main" }], etat: "plats" } });
    }
    if (sous.startsWith("menus/") && sous.endsWith("/import") && req.method === "POST") {
      const c = await lireCorps(req);
      const liste = Array.isArray(c.plats) ? c.plats : [];
      for (const p of liste) plats.push({ id: "p-photo-" + plats.length, nom: p.nom, description: "", prix: p.prix, disponible: true, confirmeLe: null });
      return ok(res, { ok: true, message: `${liste.length} plat(s) ajouté(s) au menu de Chez Awa (essai). Ils sont à confirmer avant la vente.`, ajoutes: liste.length });
    }
    if (sous.startsWith("menus/") && !sous.endsWith("confirmer") && !sous.endsWith("disponibilite")) return ok(res, { ok: true, nom: "Chez Awa (essai)", plats: plats.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix, disponible: p.disponible, confirmeLe: p.confirmeLe, etat: !p.disponible ? "epuise" : p.confirmeLe && p.confirmeLe > "2026-10-22" ? "disponible" : "a_confirmer" })) });
    const routeE = modulesFactices.equipe?.[sous];
    if (routeE) return executerRouteFactice(res, routeE, { corps: await lireCorps(req), compte, sous, methode: req.method });
    await lireCorps(req);
    return ok(res, { ok: true, message: "Action enregistrée (simulation)." });
  }

  refus(res, 404, "INTROUVABLE", "Route inconnue du faux serveur.");
}).listen(PORT, () => console.log(`Faux serveur d'essai sur http://localhost:${PORT} (émulateur : http://10.0.2.2:${PORT})`));
