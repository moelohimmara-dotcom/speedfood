import {
  COMPTE_RENDU_MAX_CARACTERES,
  DUREE_RELANCE_DEFAUT_HEURES,
  JOURNAL_SUR_LE_SITE_SEULEMENT,
  LIBELLES_ETAT_ECHEANCE,
  LIBELLES_TYPE_CONTACT,
  PROCHAINE_ACTION_MAX_CARACTERES,
  TYPES_CONTACT,
  compterEcheances,
  etatEcheance,
  formaterDateFr,
  formaterDateHeureFr,
  formaterEcheance,
  joursDepuis,
  joursEntre,
  libelleAncienneteContact,
  normaliserTypeContact,
  validerContact,
} from "../../src/lib/system-admin/contacts-regles";
import type { SaisieContact } from "../../src/lib/system-admin/contacts-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC contacts : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    contacts : ${nom}`);
  }
}

const MAINTENANT = new Date(2026, 9, 24, 10, 0);

function saisie(partiel: Partial<Parameters<typeof validerContact>[0]> = {}): Parameters<typeof validerContact>[0] {
  return {
    type: "appel",
    compteRendu: "Le patron confirme le plat du jour pour midi.",
    prochaineAction: "",
    echeanceLe: null,
    ...partiel,
  };
}

function refus(entree: Parameters<typeof validerContact>[0]): string | null {
  const resultat = validerContact(entree);
  return resultat.ok ? null : resultat.message;
}

function acceptee(entree: SaisieContact): boolean {
  return validerContact(entree).ok;
}

// --- Valeurs par défaut (un seul endroit à changer) ---------------------------------
verifier("horizon de relance par défaut = 48 h", DUREE_RELANCE_DEFAUT_HEURES, 48);
verifier("compte rendu : 2000 caractères maximum", COMPTE_RENDU_MAX_CARACTERES, 2000);
verifier("prochaine action : 300 caractères maximum", PROCHAINE_ACTION_MAX_CARACTERES, 300);
verifier("types de contact", TYPES_CONTACT, ["appel", "visite", "relance", "whatsapp"]);
verifier("libellé d'un type", LIBELLES_TYPE_CONTACT.whatsapp, "WhatsApp");

// --- Type de contact -------------------------------------------------------------------
verifier("type inconnu = refus", normaliserTypeContact("carte"), null);
verifier("type appel", normaliserTypeContact("appel"), "appel");
verifier("type absent = refus", normaliserTypeContact(null), null);
verifier("un type inconnu est refusé", acceptee(saisie({ type: "carte" })), false);
verifier("message d'erreur du type", refus(saisie({ type: "carte" })), "Choisissez le type de contact.");

// --- Compte rendu obligatoire --------------------------------------------------------------
verifier(
  "compte rendu vide = refus",
  refus(saisie({ compteRendu: "   " })),
  "Le compte rendu est obligatoire : que s'est-il passé lors de ce contact ?"
);
verifier("compte rendu valide = accepté", acceptee(saisie()), true);
verifier("compte rendu de 2001 caractères = refus", acceptee(saisie({ compteRendu: "a".repeat(2001) })), false);
verifier("compte rendu de 2000 caractères = accepté", acceptee(saisie({ compteRendu: "a".repeat(2000) })), true);

// --- Prochaine action et échéance --------------------------------------------------------------
verifier(
  "échéance sans prochaine action = refus",
  refus(saisie({ prochaineAction: "  ", echeanceLe: new Date(2026, 9, 25, 10, 0) })),
  "Indiquez la prochaine action, ou retirez l'échéance."
);
verifier(
  "prochaine action sans échéance = accepté",
  acceptee(saisie({ prochaineAction: "Rappeler lundi", echeanceLe: null })),
  true
);
verifier(
  "échéance avec prochaine action = accepté",
  acceptee(saisie({ prochaineAction: "Rappeler lundi", echeanceLe: new Date(2026, 9, 25, 10, 0) })),
  true
);
verifier(
  "prochaine action de 301 caractères = refus",
  acceptee(saisie({ prochaineAction: "a".repeat(301) })),
  false
);
verifier(
  "prochaine action de 300 caractères = accepté",
  acceptee(saisie({ prochaineAction: "a".repeat(300) })),
  true
);

// --- Nettoyage des champs conservés -----------------------------------------------------------------
const nettoye = validerContact(saisie({ type: "visite", compteRendu: "  Passage à l'établissement.  ", prochaineAction: "  Rappeler  " }));
verifier("compte rendu nettoyé", nettoye.ok ? nettoye.compteRendu : null, "Passage à l'établissement.");
verifier("prochaine action nettoyée", nettoye.ok ? nettoye.prochaineAction : null, "Rappeler");

// --- Échéance : état -------------------------------------------------------------------------------
verifier("pas d'échéance", etatEcheance(null, MAINTENANT), "aucune");
verifier("échéance aujourd'hui", etatEcheance(new Date(2026, 9, 24, 18, 0), MAINTENANT), "aujourdhui");
verifier("échéance demain", etatEcheance(new Date(2026, 9, 25, 9, 0), MAINTENANT), "a_venir");
verifier("échéance dépassée", etatEcheance(new Date(2026, 9, 22, 9, 0), MAINTENANT), "en_retard");
verifier("libellé « En retard »", LIBELLES_ETAT_ECHEANCE.en_retard.texte, "En retard");
verifier("libellé « Aujourd'hui »", LIBELLES_ETAT_ECHEANCE.aujourdhui.texte, "Aujourd'hui");

verifier("jours entre deux dates", joursEntre(new Date(2026, 9, 20, 8, 0), new Date(2026, 9, 24, 10, 0)), 4);
verifier("jours depuis un contact", joursDepuis(new Date(2026, 9, 21, 15, 0), MAINTENANT), 3);
verifier("ancienneté : aujourd'hui", libelleAncienneteContact(new Date(2026, 9, 24, 8, 0), MAINTENANT), "aujourd'hui");
verifier("ancienneté : hier", libelleAncienneteContact(new Date(2026, 9, 23, 8, 0), MAINTENANT), "hier");
verifier("ancienneté : il y a 3 jours", libelleAncienneteContact(new Date(2026, 9, 21, 8, 0), MAINTENANT), "il y a 3 jours");

// --- Formatage (sans dépendre de la locale de la machine) ------------------------------------------------
verifier("date au format français", formaterDateFr(new Date(2026, 9, 4, 8, 0)), "04/10/2026");
verifier("date et heure au format français", formaterDateHeureFr(new Date(2026, 9, 4, 14, 5)), "04/10/2026 à 14:05");
verifier("échéance : sans échéance", formaterEcheance(null, MAINTENANT), "Sans échéance");
verifier("échéance : aujourd'hui", formaterEcheance(new Date(2026, 9, 24, 18, 0), MAINTENANT), "Échéance aujourd'hui");
verifier("échéance : en retard d'un jour", formaterEcheance(new Date(2026, 9, 23, 18, 0), MAINTENANT), "En retard d'un jour");
verifier("échéance : en retard de 3 jours", formaterEcheance(new Date(2026, 9, 21, 18, 0), MAINTENANT), "En retard de 3 jours");
verifier("échéance : à venir", formaterEcheance(new Date(2026, 9, 28, 18, 0), MAINTENANT), "Échéance le 28/10/2026");

// --- Compteurs d'échéances ------------------------------------------------------------------------------
const compteurs = compterEcheances(
  [
    { echeanceLe: new Date(2026, 9, 22, 9, 0) },
    { echeanceLe: new Date(2026, 9, 24, 18, 0) },
    { echeanceLe: new Date(2026, 9, 28, 9, 0) },
    { echeanceLe: new Date(2026, 9, 30, 9, 0) },
    { echeanceLe: null },
  ],
  MAINTENANT
);
verifier("compteur : en retard", compteurs.enRetard, 1);
verifier("compteur : aujourd'hui", compteurs.aujourdhui, 1);
verifier("compteur : à venir", compteurs.aVenir, 2);
verifier("compteur : prochaine échéance", compteurs.prochaine ? compteurs.prochaine.getDate() : null, 28);
verifier("compteur : aucune échéance = pas de prochaine", compterEcheances([{ echeanceLe: null }], MAINTENANT).prochaine, null);

// --- Périmètre : ce qui reste sur le site ------------------------------------------------------------------
verifier("écrire un contact reste sur le site", JOURNAL_SUR_LE_SITE_SEULEMENT.ecrireUnContact, true);
verifier("consulter le journal n'est pas réservé au site", JOURNAL_SUR_LE_SITE_SEULEMENT.consulterLeJournal, false);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
