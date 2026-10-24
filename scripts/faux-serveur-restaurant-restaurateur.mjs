// Faux serveur LOCAL — espace restaurateur : horaires d'ouverture, pause du service, plats à reconfirmer et historique paginé.
//
// Ce fichier est un module de routes simulées, chargé automatiquement par scripts/faux-serveur-application.mjs
// (un fichier par domaine : scripts/faux-serveur-<espace>-<domaine>.mjs). Il ne touche aucune base : tout est en mémoire, dans ce processus.
//
// Données 100 % factices. La règle « plat à reconfirmer » reproduite ici est celle du serveur (src/lib/disponibilite/etat.ts) :
// l'application ne la recalcule pas, elle affiche ce que cette route renvoie.
// Les plats de ce module ne sont pas ceux de la route « menu » du faux serveur (celle-ci a ses propres plats d'essai) : c'est un faux,
// les deux listes n'ont pas à se ressemble.

export const espace = "restaurant";

/** Seuil de fraîcheur du serveur : au-delà, sans reconfirmation, un plat est « à reconfirmer ». */
const FRAICHEUR_HEURES = 6;

/** Heure d'il y a X heures, en ISO. */
const ilYA = (heures) => new Date(Date.now() - heures * 3_600_000).toISOString();

/** Horaires d'essai : une semaine type, dans le format canonique de l'application. */
let horaires = [
  "Lundi : 11:00 - 22:00",
  "Mardi : 11:00 - 22:00",
  "Mercredi : 11:00 - 22:00",
  "Jeudi : 11:00 - 22:00",
  "Vendredi : 11:00 - 23:00",
  "Samedi : 11:00 - 23:00",
  "Dimanche : fermé",
].join("\n");

/** État du service (le serveur en est le seul maître). */
let ouvert = true;
let accepteCommandes = true;

/** Plats d'essai : deux sont « à reconfirmer » (confirmation absente ou trop ancienne). */
const plats = [
  { id: "p1", nom: "Poulet braisé", disponible: true, confirmeLe: ilYA(1) },
  { id: "p2", nom: "Riz gras", disponible: true, confirmeLe: ilYA(9) },
  { id: "p3", nom: "Sauce arachide", disponible: true, confirmeLe: null },
  { id: "p4", nom: "Jus de bissap", disponible: true, confirmeLe: ilYA(2) },
];

/** Règle du serveur, reproduite ici pour la simulation : jamais confirmée, ou confirmation plus ancienne que le seuil. */
const aConfirmer = (plat) => {
  if (!plat.disponible) return false;
  if (!plat.confirmeLe) return true;
  return Date.now() - new Date(plat.confirmeLe).getTime() > FRAICHEUR_HEURES * 3_600_000;
};

/** Historique d'essai : 47 commandes terminées, pour que la pagination ait plusieurs pages à montrer. */
const HISTORIQUE = Array.from({ length: 47 }, (_, i) => {
  const numero = 1200 - i;
  const statuts = ["terminee", "terminee", "terminee", "refusee", "annulee"];
  return {
    id: `h${numero}`,
    reference: `SF-${numero}`,
    statut: statuts[i % statuts.length],
    mode: i % 3 === 0 ? "livraison" : "retrait",
    sousTotal: 25_000 + (i % 7) * 5_000,
    fraisLivraisonEstime: i % 3 === 0 ? 9_500 : 0,
    creeLe: new Date(Date.now() - (i + 1) * 5 * 3_600_000).toISOString(),
    nbLignes: 1 + (i % 3),
  };
});

export const routes = {
  /** Réglages du poste de travail : horaires, état du service, plats à reconfirmer. POST enregistre les horaires. */
  reglages: async (ctx) => {
    const corps = ctx.corps ?? {};
    if (ctx.methode === "POST") {
      if (typeof corps.horaires !== "string") return { statut: 400, code: "VALIDATION", message: "Horaires invalides." };
      if (corps.horaires.length > 500) return { statut: 400, code: "VALIDATION", message: "Les horaires ne peuvent pas dépasser 500 caractères." };
      horaires = corps.horaires;
      return { horaires };
    }
    return {
      horaires,
      ouvert,
      accepteCommandes,
      platsAReconfirmer: plats
        .filter(aConfirmer)
        .map((plat) => ({ id: plat.id, nom: plat.nom, confirmeLe: plat.confirmeLe })),
    };
  },

  /** Ouverture du restaurant et pause du service (la console envoie « ouvert » ou « accepte_commandes »). */
  statut: async (ctx) => {
    const corps = ctx.corps ?? {};
    if (corps.champ === "ouvert" && typeof corps.valeur === "boolean") ouvert = corps.valeur;
    if (corps.champ === "accepte_commandes" && typeof corps.valeur === "boolean") accepteCommandes = corps.valeur;
    return { ouvert, accepteCommandes };
  },

  /** Historique paginé : la page demandée est dans le corps de la requête. */
  historique: async (ctx) => {
    const corps = ctx.corps ?? {};
    const page = Number.isInteger(corps.page) && corps.page >= 1 ? corps.page : 1;
    const taille = Number.isInteger(corps.taille) && corps.taille >= 1 ? Math.min(corps.taille, 100) : 20;
    const debut = (page - 1) * taille;
    const commandes = HISTORIQUE.slice(debut, debut + taille);
    return {
      commandes,
      page,
      total: HISTORIQUE.length,
      pageSuivante: debut + commandes.length < HISTORIQUE.length ? page + 1 : null,
    };
  },

  /** Reconfirmation d'un plat (ou de tous) : c'est le serveur qui repose l'heure de confirmation. */
  "menu/action": async (ctx) => {
    const corps = ctx.corps ?? {};
    if (corps.action === "confirmer") {
      const plat = plats.find((p) => p.id === corps.platId);
      if (!plat) return { statut: 404, code: "INTROUVABLE", message: "Plat introuvable." };
      plat.confirmeLe = new Date().toISOString();
      return { message: "Plat reconfirmé." };
    }
    if (corps.action === "confirmer_tout") {
      plats.forEach((plat) => {
        plat.confirmeLe = new Date().toISOString();
      });
      return { message: "Tous les plats sont reconfirmés." };
    }
    return { message: "Enregistré." };
  },
};
