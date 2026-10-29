// Routes factices de l'espace livreur : la file des courses, l'historique paginé des courses livrées et l'état du dossier d'activation.
//
// Données entièrement fictives : des restaurants d'essai, des quartiers, des montants. Aucun document, aucun numéro de pièce, aucune identité réelle :
// le dossier ne renvoie qu'un état (« à jour » ou « manquant »), jamais son contenu.
//
// Le faux serveur principal charge automatiquement ce fichier (mobile/faux-serveur/faux-serveur-application.mjs) : il ne faut pas le modifier.

const maintenant = () => new Date().toISOString();

// La course en cours, puis celles qui viennent : c'est la file que le livreur voit.
const fileEssai = {
  cours: [
    {
      livraisonId: "c1",
      statut: "recuperee",
      mode: "speedfood",
      libelle: "Commande récupérée",
      commandeReference: "SF-1042",
      commandeStatut: "prete",
      restaurantNom: "Maquis du Port (essai)",
      quartier: "Dixinn",
      fraisGnf: 9500,
      client: { nom: "Client Essai", telephone: "+224 62 00 00 00 00", adresse: "Rue d'essai (fictive)" },
    },
    {
      livraisonId: "c2",
      statut: "assignee",
      mode: "speedfood",
      libelle: "À venir",
      commandeReference: "SF-1043",
      commandeStatut: "attente",
      restaurantNom: "Maquis du Port (essai)",
      quartier: "Kaporo",
      heurePrevue: "18:30",
      fraisGnf: 8000,
    },
    {
      livraisonId: "c3",
      statut: "assignee",
      mode: "speedfood",
      libelle: "À venir",
      commandeReference: "SF-1044",
      commandeStatut: "attente",
      restaurantNom: "Grill du Centre (essai)",
      quartier: "Matam",
      heurePrevue: "19:00",
      fraisGnf: 7500,
    },
  ],
};

// Les courses livrées des sept derniers jours : 12 courses, 5 par page.
const livreesEssai = [
  { id: "l12", reference: "SF-1041", restaurantNom: "Grill du Centre (essai)", fraisGnf: 9500, livreeLe: maintenant() },
  { id: "l11", reference: "SF-1040", restaurantNom: "Maquis du Port (essai)", fraisGnf: 8000, livreeLe: "2026-10-23T18:40:00Z" },
  { id: "l10", reference: "SF-1039", restaurantNom: "Chez Awa (essai)", fraisGnf: 7500, livreeLe: "2026-10-23T17:05:00Z" },
  { id: "l9", reference: "SF-1002", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: "2026-10-22T18:40:00Z" },
  { id: "l8", reference: "SF-0998", restaurantNom: "Grill du Centre (essai)", fraisGnf: 8000, livreeLe: "2026-10-22T17:10:00Z" },
  { id: "l7", reference: "SF-0995", restaurantNom: "Maquis du Port (essai)", fraisGnf: 7500, livreeLe: "2026-10-21T19:00:00Z" },
  { id: "l6", reference: "SF-0990", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: "2026-10-21T18:15:00Z" },
  { id: "l5", reference: "SF-0985", restaurantNom: "Grill du Centre (essai)", fraisGnf: 8000, livreeLe: "2026-10-20T17:45:00Z" },
  { id: "l4", reference: "SF-0980", restaurantNom: "Maquis du Port (essai)", fraisGnf: 7500, livreeLe: "2026-10-20T16:30:00Z" },
  { id: "l3", reference: "SF-0975", restaurantNom: "Chez Awa (essai)", fraisGnf: 9500, livreeLe: "2026-10-19T18:55:00Z" },
  { id: "l2", reference: "SF-0970", restaurantNom: "Grill du Centre (essai)", fraisGnf: 8000, livreeLe: "2026-10-19T17:20:00Z" },
  { id: "l1", reference: "SF-0965", restaurantNom: "Maquis du Port (essai)", fraisGnf: 7500, livreeLe: "2026-10-18T18:35:00Z" },
];

// L'état du dossier d'activation : seulement « à jour » ou « manquant ». Jamais le document, jamais le numéro de pièce.
const dossierEssai = {
  pieces: [
    {
      code: "piece_identite",
      libelle: "Pièce d'identité",
      statut: "manquant",
      explication: "Déposez votre pièce d'identité sur le site Speedfood (page « Devenir livreur »). L'équipe Speedfood la vérifie.",
    },
    {
      code: "urgence",
      libelle: "Personne à prévenir en cas de problème",
      statut: "a_jour",
      explication: "C'est fait.",
    },
  ],
  message: null,
};

const PAR_PAGE = 5;

export const espace = "livreur";

export const routes = {
  /** GET /api/v1/livreur/file : la file des courses (la course en cours, puis celles qui viennent). */
  file: async () => ({ file: fileEssai }),

  /** POST /api/v1/livreur/historique : une page de courses livrées. */
  historique: async ({ corps }) => {
    const page = Math.max(1, Number(corps?.page ?? 1) || 1);
    const debut = (page - 1) * PAR_PAGE;
    const courses = livreesEssai.slice(debut, debut + PAR_PAGE);
    const pages = Math.max(1, Math.ceil(livreesEssai.length / PAR_PAGE));
    return { historique: { courses, page, pages } };
  },

  /** GET /api/v1/livreur/dossier : l'état du dossier d'activation, sans son contenu. */
  dossier: async () => ({ dossier: dossierEssai }),
};
