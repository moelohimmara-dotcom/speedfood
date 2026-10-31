// Module de routes factices du lot « Établissement » (L5, L6, L7) pour le faux serveur d'essai.
// Le faux serveur charge automatiquement les fichiers mobile/faux-serveur/faux-serveur-<espace>-<domaine>.mjs :
// ce fichier n'a donc pas besoin d'être déclaré ailleurs.
//
// Les données sont FICTIVES et sans coordonnée personnelle réaliste : les numéros à joindre sont
// masqués comme le reste du dépôt (« +224 6** ** ** »). Rien n'est écrit dans une vraie base.
//
// Les règles appliquées ici sont les mêmes que celles de la console (apps/web/src/lib/system-admin/*-regles.ts) :
// motif obligatoire, confirmation explicite, message clients obligatoire, échéance dans le futur.

export const espace = "equipe";

const maintenant = () => new Date().toISOString();
const heuresAvant = (nombre) => new Date(Date.now() - nombre * 3_600_000).toISOString();
const heuresApres = (nombre) => new Date(Date.now() + nombre * 3_600_000).toISOString();

// Valeurs par défaut du lot (mêmes valeurs que le fichier de règles de la console).
const SEUIL_FRAICHEUR_HEURES = 6;
const DUREE_SUSPENSION_DEFAUT_HEURES = 24;
const DUREE_FERMETURE_DEFAUT_HEURES = 168;
const HEURE_SERVICE_DEBUT = 11;
const HEURE_RAPPEL_AVANT_SERVICE = 2;
const MOTIF_MIN_CARACTERES = 5;
const DUREE_MAX_HEURES = 8760;

const etablissements = [
  {
    id: "e1",
    nom: "Le Palmier (essai)",
    quartier: "Dixinn",
    telephoneCommandes: "+224 6** ** **",
    plats: 5,
    platsDisponibles: 4,
    platsEpuises: 1,
    dernierConfirmationLe: heuresAvant(9),
    dernierRappelLe: null,
    ouvert: true,
    accepteCommandes: true,
    fermeture: null,
  },
  {
    id: "e2",
    nom: "Al Baik (essai)",
    quartier: "Matam",
    telephoneCommandes: "+224 6** ** **",
    plats: 3,
    platsDisponibles: 3,
    platsEpuises: 0,
    dernierConfirmationLe: null,
    dernierRappelLe: null,
    ouvert: true,
    accepteCommandes: true,
    fermeture: null,
  },
  {
    id: "e3",
    nom: "Zoko Bissap (essai)",
    quartier: "Kaloum",
    telephoneCommandes: "+224 6** ** **",
    plats: 4,
    platsDisponibles: 3,
    platsEpuises: 1,
    dernierConfirmationLe: heuresAvant(2),
    dernierRappelLe: heuresAvant(1),
    ouvert: true,
    accepteCommandes: false,
    fermeture: {
      id: "f1",
      type: "suspension",
      motif: "Rupture de stock de riz : l'établissement ne peut pas servir le plat du jour.",
      messagePublic: "Zoko Bissap (essai) est temporairement en pause : les commandes reprendront bientôt.",
      dureeHeures: 24,
      repriseLe: heuresApres(20),
      leveLe: null,
      creeLe: heuresAvant(4),
    },
  },
];

const contacts = [
  {
    id: "c1",
    restaurantId: "e1",
    nomEtablissement: "Le Palmier (essai)",
    type: "appel",
    compteRendu: "Le patron confirme le poulet braisé pour midi, il manque du riz.",
    prochaineAction: " Rappeler à 11 h pour le riz",
    echeanceLe: heuresApres(1),
    creeLe: heuresAvant(5),
  },
  {
    id: "c2",
    restaurantId: "e3",
    nomEtablissement: "Zoko Bissap (essai)",
    type: "visite",
    compteRendu: "Visite sur place : cuisine en panne, l'établissement ne peut plus servir.",
    prochaineAction: "Revenir demain matin",
    echeanceLe: heuresAvant(2),
    creeLe: heuresAvant(4),
  },
  {
    id: "c3",
    restaurantId: "e2",
    nomEtablissement: "Al Baik (essai)",
    type: "relance",
    compteRendu: "Relance envoyée, aucun retour pour l'instant.",
    prochaineAction: "",
    echeanceLe: null,
    creeLe: heuresAvant(72),
  },
];

function trouverEtablissement(id) {
  return etablissements.find((e) => e.id === id) ?? null;
}

/** Rappel de confirmation du menu : mêmes seuils que la console (6 h de fraîcheur, fenêtre avant le service). */
function etatMenu(etablissement) {
  const ageHeures = etablissement.dernierConfirmationLe
    ? (Date.now() - new Date(etablissement.dernierConfirmationLe).getTime()) / 3_600_000
    : null;
  const jamaisConfirme = etablissement.dernierConfirmationLe === null;
  const perime = ageHeures !== null && ageHeures > SEUIL_FRAICHEUR_HEURES;
  const aConfirmer = jamaisConfirme || perime ? etablissement.platsDisponibles : 0;
  const etat = etablissement.plats === 0 || (!jamaisConfirme && !perime) ? "confirme" : jamaisConfirme ? "jamais_confirme" : "perime";
  const heure = new Date().getHours();
  return {
    id: etablissement.id,
    nom: etablissement.nom,
    quartier: etablissement.quartier,
    telephoneCommandes: etablissement.telephoneCommandes,
    plats: etablissement.plats,
    platsDisponibles: etablissement.platsDisponibles,
    platsEpuises: etablissement.platsEpuises,
    platsAConfirmer: aConfirmer,
    dernierConfirmationLe: etablissement.dernierConfirmationLe,
    dernierRappelLe: etablissement.dernierRappelLe,
    etat,
    ageHeures,
    rappelDu: heure >= HEURE_SERVICE_DEBUT - HEURE_RAPPEL_AVANT_SERVICE,
    dernierRappelLibelle: etablissement.dernierRappelLe
      ? `Rappel envoyé ${Math.max(1, Math.round((Date.now() - new Date(etablissement.dernierRappelLe).getTime()) / 3_600_000))} h`
      : "Aucun rappel envoyé",
  };
}

function etatEcheance(echeanceLe) {
  if (!echeanceLe) return "aucune";
  const jour = 86_400_000;
  const debut = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const cible = new Date(echeanceLe).getTime();
  if (cible < debut) return "en_retard";
  if (cible < debut + jour) return "aujourdhui";
  return "a_venir";
}

function erreur(statut, code, message) {
  return { statut, code, message };
}

export const routes = {
  // --- L5 : confirmation du menu -------------------------------------------------
  "menus-confirmation": async () => {
    const menus = etablissements.map(etatMenu);
    return {
      seuilHeures: SEUIL_FRAICHEUR_HEURES,
      heureService: HEURE_SERVICE_DEBUT,
      heureRappelAvant: HEURE_RAPPEL_AVANT_SERVICE,
      etablissements: menus,
      aReconfirmer: menus.filter((m) => m.etat !== "confirme"),
      compteurs: {
        etablissements: menus.length,
        aConfirmer: menus.filter((m) => m.etat !== "confirme").length,
        platsAConfirmer: menus.reduce((total, m) => total + m.platsAConfirmer, 0),
        confirmes: menus.filter((m) => m.etat === "confirme").length,
      },
      rappelsDus: menus.filter((m) => m.rappelDu && m.etat !== "confirme").length,
    };
  },

  "menus-confirmation/confirmer": async ({ corps }) => {
    const etablissement = trouverEtablissement(String(corps?.restaurant_id ?? ""));
    if (!etablissement) return erreur(404, "INTROUVABLE", "Établissement introuvable.");
    if (etablissement.plats === 0) {
      return erreur(400, "VALIDATION", "Cet établissement n'a aucun plat actif : il n'y a rien à confirmer.");
    }
    etablissement.dernierConfirmationLe = maintenant();
    return { message: `Menu du jour confirmé : ${etablissement.plats} plats.` };
  },

  "menus-confirmation/rappel": async ({ corps }) => {
    const etablissement = trouverEtablissement(String(corps?.restaurant_id ?? ""));
    if (!etablissement) return erreur(404, "INTROUVABLE", "Établissement introuvable.");
    const canal = corps?.canal === "appel" ? "appel" : "interne";
    etablissement.dernierRappelLe = maintenant();
    return {
      message: `Rappel de confirmation enregistré (${canal === "appel" ? "appel téléphonique" : "notification interne"}).`,
      canal,
    };
  },

  // --- L6 : fermeture et suspension ----------------------------------------------
  "etablissements": async () => ({
    etablissements: etablissements.map((e) => ({
      id: e.id,
      nom: e.nom,
      quartier: e.quartier,
      ouvert: e.ouvert,
      accepteCommandes: e.accepteCommandes,
      fermetureActive: e.fermeture,
      fermeturesPassees: 0,
    })),
  }),

  "etablissements/fermeture": async ({ corps }) => {
    const etablissement = trouverEtablissement(String(corps?.restaurant_id ?? ""));
    if (!etablissement) return erreur(404, "INTROUVABLE", "Établissement introuvable.");
    if (corps?.confirmation !== "oui") {
      return erreur(400, "VALIDATION", "Confirmez la fermeture : l'action est visible par les clients.");
    }
    const type = corps?.type_fermeture === "fermeture" ? "fermeture" : corps?.type_fermeture === "suspension" ? "suspension" : null;
    if (!type) return erreur(400, "VALIDATION", "Choisissez une suspension ou une fermeture.");
    const motif = String(corps?.motif ?? "").trim();
    if (motif.length < MOTIF_MIN_CARACTERES) {
      return erreur(400, "VALIDATION", `Le motif doit faire au moins ${MOTIF_MIN_CARACTERES} caractères.`);
    }
    const messagePublic = String(corps?.message_public ?? "").trim();
    if (messagePublic.length < MOTIF_MIN_CARACTERES) {
      return erreur(400, "VALIDATION", "Le message affiché aux clients est obligatoire.");
    }
    const dureeHeures = Number(corps?.duree_heures);
    if (!Number.isInteger(dureeHeures) || dureeHeures < 1 || dureeHeures > DUREE_MAX_HEURES) {
      return erreur(400, "VALIDATION", `La durée doit être un nombre d'heures entre 1 et ${DUREE_MAX_HEURES}.`);
    }
    if (etablissement.fermeture) {
      return erreur(400, "CONFLIT_ETAT", "Cet établissement est déjà fermé ou suspendu : levez la fermeture en cours avant d'en créer une autre.");
    }
    const repriseLe = corps?.reprise_le ? new Date(corps.reprise_le) : new Date(Date.now() + dureeHeures * 3_600_000);
    if (Number.isNaN(repriseLe.getTime()) || repriseLe.getTime() <= Date.now()) {
      return erreur(400, "VALIDATION", "La reprise planifiée est déjà passée : choisissez une date à venir.");
    }
    etablissement.fermeture = {
      id: `f${Date.now()}`,
      type,
      motif,
      messagePublic,
      dureeHeures: type === "fermeture" ? dureeHeures || DUREE_FERMETURE_DEFAUT_HEURES : dureeHeures || DUREE_SUSPENSION_DEFAUT_HEURES,
      repriseLe: repriseLe.toISOString(),
      leveLe: null,
      creeLe: maintenant(),
    };
    etablissement.accepteCommandes = false;
    if (type === "fermeture") etablissement.ouvert = false;
    return { message: `${type === "fermeture" ? "Fermeture" : "Suspension"} appliquée : l'établissement n'accepte plus de commande.` };
  },

  "etablissements/reprise": async ({ corps }) => {
    const etablissement = trouverEtablissement(String(corps?.restaurant_id ?? ""));
    if (!etablissement) return erreur(404, "INTROUVABLE", "Établissement introuvable.");
    const motif = String(corps?.motif_levee ?? "").trim();
    if (motif.length < MOTIF_MIN_CARACTERES) {
      return erreur(400, "VALIDATION", "Indiquez pourquoi la fermeture est levée (5 caractères minimum).");
    }
    if (!etablissement.fermeture) return erreur(400, "CONFLIT_ETAT", "Aucune fermeture en cours pour cet établissement.");
    etablissement.fermeture.leveLe = maintenant();
    etablissement.fermeture = null;
    etablissement.ouvert = true;
    etablissement.accepteCommandes = true;
    return { message: "Fermeture levée : l'établissement accepte de nouveau les commandes." };
  },

  // --- L7 : journal des contacts ---------------------------------------------------
  "contacts": async () => {
    const avecEcheance = contacts.map((c) => ({ ...c, etatEcheance: etatEcheance(c.echeanceLe) }));
    return {
      contacts: avecEcheance,
      total: avecEcheance.length,
      compteurs: {
        enRetard: avecEcheance.filter((c) => c.etatEcheance === "en_retard").length,
        aujourdhui: avecEcheance.filter((c) => c.etatEcheance === "aujourdhui").length,
        aVenir: avecEcheance.filter((c) => c.etatEcheance === "a_venir").length,
      },
    };
  },

  "contacts/ajout": async ({ corps }) => {
    const etablissement = trouverEtablissement(String(corps?.restaurant_id ?? ""));
    if (!etablissement) return erreur(404, "INTROUVABLE", "Établissement introuvable.");
    const types = ["appel", "visite", "relance", "whatsapp"];
    if (!types.includes(String(corps?.type_contact ?? ""))) {
      return erreur(400, "VALIDATION", "Choisissez le type de contact.");
    }
    const compteRendu = String(corps?.compte_rendu ?? "").trim();
    if (compteRendu.length === 0) {
      return erreur(400, "VALIDATION", "Le compte rendu est obligatoire : que s'est-il passé lors de ce contact ?");
    }
    if (compteRendu.length > 2000) {
      return erreur(400, "VALIDATION", "Le compte rendu ne peut pas dépasser 2000 caractères.");
    }
    const prochaineAction = String(corps?.prochaine_action ?? "").trim();
    const echeanceLe = corps?.echeance_le ? new Date(corps.echeance_le) : null;
    if (echeanceLe && (Number.isNaN(echeanceLe.getTime()) || echeanceLe.getTime() <= Date.now())) {
      return erreur(400, "VALIDATION", "L'échéance est déjà passée : choisissez une date à venir.");
    }
    if (echeanceLe && prochaineAction.length === 0) {
      return erreur(400, "VALIDATION", "Indiquez la prochaine action, ou retirez l'échéance.");
    }
    contacts.push({
      id: `c${Date.now()}`,
      restaurantId: etablissement.id,
      nomEtablissement: etablissement.nom,
      type: corps.type_contact,
      compteRendu,
      prochaineAction,
      echeanceLe: echeanceLe ? echeanceLe.toISOString() : null,
      creeLe: maintenant(),
    });
    return { message: "Contact consigné." };
  },
};
