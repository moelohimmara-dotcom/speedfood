import {
  DECISIONS_SUR_LE_SITE_SEULEMENT,
  DUREE_FERMETURE_DEFAUT_HEURES,
  DUREE_MAX_HEURES,
  DUREE_SUSPENSION_DEFAUT_HEURES,
  EFFETS_CLIENTS,
  LIBELLES_ETAT_FERMETURE,
  MOTIF_MIN_CARACTERES,
  calculerRepriseLe,
  dureeParDefaut,
  etatFermeture,
  messagePublicParDefaut,
  messagePublicVisible,
  normaliserTypeFermeture,
  repriseAFaire,
  validerFermeture,
} from "../../src/lib/system-admin/etablissements-regles";
import type { SaisieFermeture } from "../../src/lib/system-admin/etablissements-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC établissements : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    établissements : ${nom}`);
  }
}

const MAINTENANT = new Date(2026, 9, 24, 10, 0);

function saisie(partiel: Partial<Parameters<typeof validerFermeture>[0]> = {}): Parameters<typeof validerFermeture>[0] {
  return {
    type: "suspension",
    motif: "Rupture de stock de riz",
    messagePublic: "Le Palmier est en pause : les commandes reprendront bientôt.",
    dureeHeures: 24,
    repriseLe: null,
    ...partiel,
  };
}

/** Message d'erreur d'une saisie refusée (null si elle est acceptée). */
function refus(entree: Parameters<typeof validerFermeture>[0]): string | null {
  const resultat = validerFermeture(entree, MAINTENANT);
  return resultat.ok ? null : resultat.message;
}

function acceptee(entree: SaisieFermeture): boolean {
  return validerFermeture(entree, MAINTENANT).ok;
}

// --- Valeurs par défaut (un seul endroit à changer) ---------------------------------
verifier("durée de suspension par défaut = 24 h", DUREE_SUSPENSION_DEFAUT_HEURES, 24);
verifier("durée de fermeture par défaut = 168 h", DUREE_FERMETURE_DEFAUT_HEURES, 168);
verifier("durée maximale = un an", DUREE_MAX_HEURES, 8760);
verifier("motif : 5 caractères minimum", MOTIF_MIN_CARACTERES, 5);
verifier("durée par défaut d'une suspension", dureeParDefaut("suspension"), 24);
verifier("durée par défaut d'une fermeture", dureeParDefaut("fermeture"), 168);

// --- Type de décision ----------------------------------------------------------------
verifier("type inconnu = refus", normaliserTypeFermeture("fermeture prolongee"), null);
verifier("type suspension", normaliserTypeFermeture("suspension"), "suspension");
verifier("type fermeture", normaliserTypeFermeture("fermeture"), "fermeture");
verifier("un type inconnu est refusé", acceptee(saisie({ type: "inconnu" })), false);
verifier("message d'erreur du type inconnu", refus(saisie({ type: "inconnu" })), "Choisissez une suspension ou une fermeture.");

// --- Motif obligatoire ------------------------------------------------------------------
verifier(
  "motif vide = refus",
  refus(saisie({ motif: "   " })),
  "Le motif est obligatoire : indiquez pourquoi l'établissement est fermé."
);
verifier("motif de 4 caractères = refus", refus(saisie({ motif: "pann" })), "Le motif doit faire au moins 5 caractères.");
verifier("motif de 5 caractères = accepté", acceptee(saisie({ motif: "panne" })), true);
verifier("motif valide = accepté", acceptee(saisie()), true);
verifier("motif de 1001 caractères = refus", acceptee(saisie({ motif: "a".repeat(1001) })), false);
verifier("motif de 1000 caractères = accepté", acceptee(saisie({ motif: "a".repeat(1000) })), true);

// --- Message clients obligatoire ------------------------------------------------------------
verifier(
  "message clients vide = refus",
  refus(saisie({ messagePublic: "" })),
  "Le message affiché aux clients est obligatoire."
);
verifier("message clients de 4 caractères = refus", acceptee(saisie({ messagePublic: "paus" })), false);
verifier("message clients de 5 caractères = accepté", acceptee(saisie({ messagePublic: "pausé" })), true);
verifier("message clients de 501 caractères = refus", acceptee(saisie({ messagePublic: "a".repeat(501) })), false);
verifier("message clients de 500 caractères = accepté", acceptee(saisie({ messagePublic: "a".repeat(500) })), true);

// --- Durée -------------------------------------------------------------------------------------
verifier("durée nulle = refus", acceptee(saisie({ dureeHeures: 0 })), false);
verifier("durée négative = refus", acceptee(saisie({ dureeHeures: -5 })), false);
verifier("durée décimale = refus", acceptee(saisie({ dureeHeures: 2.5 })), false);
verifier("durée non numérique = refus", acceptee(saisie({ dureeHeures: Number.NaN })), false);
verifier("durée au-delà d'un an = refus", acceptee(saisie({ dureeHeures: 8761 })), false);
verifier("durée d'un an = acceptée", acceptee(saisie({ dureeHeures: 8760 })), true);
verifier("durée d'une heure = acceptée", acceptee(saisie({ dureeHeures: 1 })), true);

// --- Reprise planifiée ---------------------------------------------------------------------------
verifier(
  "reprise déjà passée = refus",
  refus(saisie({ repriseLe: new Date(2026, 9, 23, 10, 0) })),
  "La reprise planifiée est déjà passée : choisissez une date à venir."
);
verifier("reprise dans le futur = acceptée", acceptee(saisie({ repriseLe: new Date(2026, 9, 25, 10, 0) })), true);
verifier(
  "reprise absente = la durée la calcule",
  (validerFermeture(saisie({ repriseLe: null }), MAINTENANT) as { repriseLe: Date | null }).repriseLe,
  null
);

const reprise = calculerRepriseLe(24, MAINTENANT);
verifier("reprise calculée = 24 h plus tard", reprise.getTime() - MAINTENANT.getTime(), 24 * 3_600_000);

// --- Messages clients par défaut --------------------------------------------------------------------
verifier(
  "message par défaut d'une suspension",
  messagePublicParDefaut("suspension", "Le Palmier"),
  "Le Palmier est temporairement en pause : les commandes reprendront bientôt."
);
verifier(
  "message par défaut d'une fermeture",
  messagePublicParDefaut("fermeture", "Le Palmier"),
  "Le Palmier est fermé pour le moment : aucune commande n'est acceptée."
);
verifier(
  "message par défaut sans nom",
  messagePublicParDefaut("fermeture", "  "),
  "Cet établissement est fermé pour le moment : aucune commande n'est acceptée."
);

// --- État de la fermeture -----------------------------------------------------------------------------
verifier("fermeture en cours sans reprise", etatFermeture({ leveLe: null, repriseLe: null }, MAINTENANT), "active");
verifier(
  "fermeture avec reprise à venir",
  etatFermeture({ leveLe: null, repriseLe: new Date(2026, 9, 25, 10, 0) }, MAINTENANT),
  "reprise_prevue"
);
verifier(
  "reprise dépassée sans levée",
  etatFermeture({ leveLe: null, repriseLe: new Date(2026, 9, 23, 10, 0) }, MAINTENANT),
  "expiree"
);
verifier(
  "fermeture levée",
  etatFermeture({ leveLe: new Date(2026, 9, 24, 9, 0), repriseLe: new Date(2026, 9, 25, 10, 0) }, MAINTENANT),
  "levee"
);
verifier(
  "une reprise dépassée doit être reprise à la main",
  repriseAFaire({ leveLe: null, repriseLe: new Date(2026, 9, 23, 10, 0) }, MAINTENANT),
  true
);
verifier(
  "le message clients disparaît quand la fermeture est levée",
  messagePublicVisible({ leveLe: new Date(2026, 9, 24, 9, 0), repriseLe: null }, MAINTENANT),
  false
);
verifier(
  "le message clients reste tant que la fermeture n'est pas levée",
  messagePublicVisible({ leveLe: null, repriseLe: new Date(2026, 9, 23, 10, 0) }, MAINTENANT),
  true
);
verifier("libellé « Reprise à faire »", LIBELLES_ETAT_FERMETURE.expiree.texte, "Reprise à faire");

// --- Effets sur les clients et périmètre -------------------------------------------------------------------
verifier("la suspension met les commandes en pause", EFFETS_CLIENTS.suspension.includes("Commandes en pause"), true);
verifier("la fermeture ferme l'établissement", EFFETS_CLIENTS.fermeture.includes("Fermé"), true);
verifier("fermer reste sur le site", DECISIONS_SUR_LE_SITE_SEULEMENT.fermerOuSuspendre, true);
verifier("lever reste sur le site", DECISIONS_SUR_LE_SITE_SEULEMENT.leverLaFermeture, true);
verifier("consulter l'état ne reste pas sur le site", DECISIONS_SUR_LE_SITE_SEULEMENT.consulterLEtat, false);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
