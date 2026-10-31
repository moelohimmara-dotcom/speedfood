// Pur, sans dépendance serveur : testable seul (npm run test:unit). Espace client : « Mes commandes ».

/** Ce que le client lit sur une de ses commandes passées : des mots simples, jamais le vocabulaire technique. */
export interface LibelleStatutClient {
  libelle: string;
  /** Teinte de la pastille. */
  ton: "succes" | "attention" | "danger" | "neutre";
  /** La commande avance encore : le suivi mérite d'être ouvert. */
  enCours: boolean;
}

export function libelleStatutCommandeClient(statut: string, modeCommande: string): LibelleStatutClient {
  switch (statut) {
    case "en_attente":
      return { libelle: "En attente du restaurant", ton: "attention", enCours: true };
    case "acceptee":
      return { libelle: "Acceptée, en préparation", ton: "succes", enCours: true };
    case "prete":
      return { libelle: modeCommande === "livraison" ? "Prête, en cours de livraison" : "Prête", ton: "succes", enCours: true };
    case "terminee":
      return { libelle: modeCommande === "livraison" ? "Livrée" : modeCommande === "sur_place" ? "Servie" : "Remise", ton: "neutre", enCours: false };
    case "refusee":
      return { libelle: "Refusée par le restaurant", ton: "danger", enCours: false };
    case "annulee":
      return { libelle: "Annulée", ton: "danger", enCours: false };
    default:
      return { libelle: "Statut inconnu", ton: "neutre", enCours: false };
  }
}

/** Mention de paiement à côté d'une commande : rien quand il n'y a rien à dire. */
export function libellePaiementClient(paiementStatut: string, paiementMode: string | null): string | null {
  if (paiementStatut === "recu") return paiementMode === "speedfood" ? "Payée en ligne" : "Payée";
  if (paiementStatut === "declare") return "Paiement déclaré, en attente de confirmation du restaurant";
  if (paiementStatut === "especes") return "À régler en espèces";
  if (paiementStatut === "non_recu") return "Paiement non retrouvé par le restaurant";
  return null;
}

export type ResultatAdresse = { ok: true; libelle: string; adresse: string } | { ok: false; erreur: string };

/** Une adresse enregistrée : un nom court (« Maison », « Travail ») et l'adresse comme on la dicterait à un livreur. */
export function validerAdresseClient(libelleBrut: string, adresseBrute: string): ResultatAdresse {
  const libelle = libelleBrut.replace(/\s+/g, " ").trim();
  const adresse = adresseBrute.replace(/\s+/g, " ").trim();
  if (libelle.length < 2 || libelle.length > 30) return { ok: false, erreur: "Donnez un nom court à cette adresse (2 à 30 caractères), par exemple « Maison »." };
  if (adresse.length < 5 || adresse.length > 300) return { ok: false, erreur: "Décrivez l'adresse pour le livreur (5 à 300 caractères) : quartier, rue, point de repère." };
  return { ok: true, libelle, adresse };
}

export const MODES_PREFERES = ["retrait", "livraison", "sur_place"] as const;
export type ModePrefere = (typeof MODES_PREFERES)[number];

/** Mode préféré lu d'un formulaire : vide = aucune préférence ; une valeur inconnue est refusée (`undefined`). */
export function lireModePrefere(brut: unknown): ModePrefere | null | undefined {
  if (brut === null || brut === undefined || brut === "") return null;
  return typeof brut === "string" && (MODES_PREFERES as readonly string[]).includes(brut) ? (brut as ModePrefere) : undefined;
}

export const LIBELLES_MODE_PREFERE: Record<ModePrefere, string> = {
  retrait: "Retrait sur place",
  livraison: "Livraison",
  sur_place: "Sur place, à table",
};

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 21 oct. 2026 à 14:05 », en heure de Conakry (GMT, sans changement d'heure). */
export function formaterDateCommande(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()} à ${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`;
}

/** Montant en GNF avec espaces insécables fins pour les milliers. */
export function formaterMontantClient(montantGnf: number): string {
  return `${String(Math.max(0, Math.round(montantGnf))).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} GNF`;
}
