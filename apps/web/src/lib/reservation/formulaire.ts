import {
  DELAI_MIN_MINUTES, MESSAGE_CRENEAU_HORS_PLAGE, NB_PERSONNES_MAX, NB_PERSONNES_MIN, NOM_RESERVATION_MAX, NOM_RESERVATION_MIN, NOTE_RESERVATION_MAX, creneauDansPlage, lireCorpsCreationReservation, type DemandeReservation,
} from "../contracts/reservation";
import { normaliserTelephone } from "../commande/telephone";
import { NB_JOURS_RESERVABLES, creneauIso, creneauxDuJour, formaterCreneau, joursReservables } from "./creneaux";

/**
 * Validation du formulaire « Réserver une table » (lot M4b), côté navigateur (pour guider) ET côté serveur (qui revalide tout avec sa propre horloge).
 * Les messages sont en français, courts, et ne reprennent jamais la saisie. La demande produite ne contient que les six champs du contrat : aucune identité.
 * L'API reste seule juge (capacité, plafond, doublon) : ceci n'évite que les erreurs évidentes.
 */

export interface BrutReservation {
  restaurantId: string;
  /** `AAAA-MM-JJ` choisi dans la liste. */
  jour: string;
  /** `HH:MM` choisi dans la liste. */
  heure: string;
  nbPersonnes: string | number;
  nom: string;
  telephone: string;
  note: string;
}

export type ChampReservation = "restaurantId" | "jour" | "heure" | "nbPersonnes" | "nom" | "telephone" | "note" | "formulaire";
const ORDRE: ChampReservation[] = ["restaurantId", "jour", "heure", "nbPersonnes", "nom", "telephone", "note", "formulaire"];

export type ResultatFormulaire =
  | { ok: true; demande: DemandeReservation }
  | { ok: false; erreurs: Partial<Record<ChampReservation, string>>; message: string };

const CARACTERES_DE_CONTROLE = /[\u0000-\u001f\u007f]/g;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nettoyer(brut: string): string {
  return brut.replace(CARACTERES_DE_CONTROLE, " ").replace(/\s+/g, " ").trim();
}

function lireNombre(v: string | number): number | null {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  return /^\d{1,3}$/.test(v.trim()) ? Number(v.trim()) : null;
}

/** Le plus grand groupe que le formulaire laisse choisir : la borne annoncée par l'API, jamais au-delà de la borne partagée. */
export function nombrePersonnesMaximum(nbPersonnesMax: number): number {
  return Number.isInteger(nbPersonnesMax) ? Math.min(Math.max(nbPersonnesMax, NB_PERSONNES_MIN), NB_PERSONNES_MAX) : NB_PERSONNES_MAX;
}

export function validerFormulaireReservation(brut: BrutReservation, maintenant: Date, nbPersonnesMax: number): ResultatFormulaire {
  const erreurs: Partial<Record<ChampReservation, string>> = {};
  const max = nombrePersonnesMaximum(nbPersonnesMax);

  const restaurantId = typeof brut.restaurantId === "string" ? brut.restaurantId : "";
  if (!REGEX_UUID.test(restaurantId)) erreurs.restaurantId = "Restaurant invalide.";

  const jour = typeof brut.jour === "string" ? brut.jour : "";
  const heure = typeof brut.heure === "string" ? brut.heure : "";
  let creneau: string | null = null;
  if (jour === "") erreurs.jour = "Choisissez un jour.";
  else if (!joursReservables(maintenant).some((j) => j.valeur === jour)) erreurs.jour = `Ce jour n'est pas proposé. Choisissez un jour parmi les ${NB_JOURS_RESERVABLES} prochains jours.`;
  if (erreurs.jour === undefined) {
    if (heure === "") erreurs.heure = "Choisissez une heure.";
    else {
      creneau = creneauIso(jour, heure);
      if (creneau === null) erreurs.heure = "Choisissez une heure parmi celles proposées.";
      else if (!creneauDansPlage(Date.parse(creneau))) erreurs.heure = MESSAGE_CRENEAU_HORS_PLAGE;
      else if (!creneauxDuJour(jour, maintenant).includes(heure)) erreurs.heure = `Cette heure est trop proche. Réservez au moins ${DELAI_MIN_MINUTES} minutes à l'avance.`;
    }
  }

  const nbPersonnes = lireNombre(brut.nbPersonnes);
  if (nbPersonnes === null || nbPersonnes < NB_PERSONNES_MIN || nbPersonnes > max) erreurs.nbPersonnes = `Indiquez un nombre de personnes entre ${NB_PERSONNES_MIN} et ${max}.`;

  const nom = nettoyer(typeof brut.nom === "string" ? brut.nom : "");
  if (nom.length < NOM_RESERVATION_MIN || nom.length > NOM_RESERVATION_MAX) erreurs.nom = `Indiquez un nom de ${NOM_RESERVATION_MIN} à ${NOM_RESERVATION_MAX} caractères.`;

  const telephone = typeof brut.telephone === "string" ? normaliserTelephone(brut.telephone) : null;
  if (telephone === null) erreurs.telephone = "Numéro de téléphone invalide. Indiquez un numéro guinéen, par exemple 620 00 00 00.";

  const note = nettoyer(typeof brut.note === "string" ? brut.note : "");
  if (note.length > NOTE_RESERVATION_MAX) erreurs.note = `La note ne peut pas dépasser ${NOTE_RESERVATION_MAX} caractères.`;

  if (Object.keys(erreurs).length === 0 && creneau !== null && nbPersonnes !== null && telephone !== null) {
    // Dernier filet : le contrat partagé (celui que l'API applique) relit la demande. Un désaccord ne doit pas arriver ; s'il arrive, on refuse sans rien envoyer.
    const lu = lireCorpsCreationReservation({ restaurantId, creneau, nbPersonnes, nom, telephone, note: note === "" ? null : note });
    if (lu.ok) return { ok: true, demande: lu.valeurs };
    erreurs.formulaire = lu.message;
  }
  const premier = ORDRE.find((c) => erreurs[c] !== undefined);
  return { ok: false, erreurs, message: premier ? (erreurs[premier] as string) : "Demande invalide." };
}

/** Le texte lu avant l'envoi : ce qui est demandé, puis ce qui se passe ensuite. */
export function recapitulatifReservation(demande: DemandeReservation, restaurantNom: string): { demande: string; suite: string } {
  const personnes = `${demande.nbPersonnes} ${demande.nbPersonnes === 1 ? "personne" : "personnes"}`;
  return {
    demande: `Demande de réservation : ${restaurantNom}, ${formaterCreneau(demande.creneau)}, ${personnes}, au nom de ${demande.nom}.`,
    suite: "Le restaurant doit la confirmer. Aucun paiement.",
  };
}
