// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import { validerDemandeReferencement, type DemandeReferencement } from "../site/referencement";

/**
 * Candidature déposée depuis l'application par une personne connectée (« J'ai un restaurant », formulaire en 5 étapes). C'est une demande de
 * référencement (`referencement_demandes`) enrichie : l'équipe la traite comme celles du site. Les règles de base (nom, quartier, téléphone, e-mail) sont celles
 * du site ; ici s'ajoutent les horaires, les moyens de paiement, les services et le brouillon de menu.
 */

/** Délai de réponse annoncé au candidat. Il engage Speedfood : l'écran d'envoi et le suivi l'affichent. */
export const DELAI_REPONSE_HEURES = 48;

export const MOYENS_PAIEMENT = ["especes", "orange_money", "mtn_momo"] as const;
export const SERVICES = ["livraison", "retrait", "sur_place"] as const;
export const MAX_PLATS = 80;
/** Garde-fou contre une faute de frappe de zéros (le plafond réel par plat se règle dans les paramètres au moment de créer l'établissement). */
export const PRIX_PLAT_MAX_GNF = 1_000_000;
export const PRIX_PLAT_MIN_GNF = 100;

export interface PlatBrouillon {
  nom: string;
  /** Montant GNF entier (jamais de flottant). */
  prix: number;
}

export interface CandidatureValide {
  demande: DemandeReferencement;
  horaires: string | null;
  moyensPaiement: string[];
  services: string[];
  plats: PlatBrouillon[];
}

export type ResultatCandidature = { ok: true; candidature: CandidatureValide } | { ok: false; erreur: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function objet(brut: unknown): Record<string, unknown> {
  return typeof brut === "object" && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
}

function texte(brut: unknown, max: number): string {
  return String(brut ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

/** Identifiant du quartier choisi : lu séparément car le serveur doit le retrouver en base (le nom et la commune ne viennent jamais du navigateur). */
export function lireQuartierId(corps: unknown): string | null {
  const brut = objet(corps).quartierId;
  return typeof brut === "string" && UUID.test(brut) ? brut : null;
}

function listeAutorisee(brut: unknown, autorisees: readonly string[], max: number): string[] | null {
  if (brut === undefined || brut === null) return [];
  if (!Array.isArray(brut) || brut.length > max) return null;
  const vues = new Set<string>();
  for (const v of brut) {
    if (typeof v !== "string" || !autorisees.includes(v)) return null;
    vues.add(v);
  }
  return [...vues];
}

/** Le menu du brouillon : jamais écrit tel quel dans le catalogue, l'équipe le relit à la création de l'établissement. */
export function validerPlats(brut: unknown): PlatBrouillon[] | null {
  if (brut === undefined || brut === null) return [];
  if (!Array.isArray(brut) || brut.length > MAX_PLATS) return null;
  const plats: PlatBrouillon[] = [];
  for (const ligne of brut) {
    const l = objet(ligne);
    const nom = texte(l.nom, 80);
    const prix = l.prix;
    if (nom.length < 2) return null;
    if (typeof prix !== "number" || !Number.isInteger(prix) || prix < PRIX_PLAT_MIN_GNF || prix > PRIX_PLAT_MAX_GNF) return null;
    plats.push({ nom, prix });
  }
  return plats;
}

/**
 * Valide le corps envoyé par l'application. `contexte` vient du serveur (jamais du client) : commune et quartier retrouvés par l'identifiant du quartier, adresse
 * e-mail du compte connecté.
 */
export function validerCandidature(corps: unknown, contexte: { commune: string; quartier: string; email: string }): ResultatCandidature {
  const c = objet(corps);
  const responsable = objet(c.responsable);
  const base = validerDemandeReferencement({
    type: "restaurant",
    organisation: c.nom,
    commune: contexte.commune,
    quartier: contexte.quartier,
    indications: c.indications,
    latitude: "",
    longitude: "",
    categories: c.categories,
    specialites: c.specialites,
    prenom: responsable.prenom,
    nom: responsable.nom,
    email: contexte.email,
    telephone: c.telephone,
  });
  if (!base.ok) return base;

  const moyens = listeAutorisee(c.moyensPaiement, MOYENS_PAIEMENT, MOYENS_PAIEMENT.length);
  if (!moyens) return { ok: false, erreur: "Moyens de paiement invalides." };
  const services = listeAutorisee(c.services, SERVICES, SERVICES.length);
  if (!services) return { ok: false, erreur: "Services invalides." };
  if (services.length === 0) return { ok: false, erreur: "Indiquez au moins un service : livraison, retrait ou sur place." };
  const plats = validerPlats(c.plats);
  if (!plats) return { ok: false, erreur: `Menu invalide : chaque plat a un nom (2 caractères au moins) et un prix entier en GNF entre ${PRIX_PLAT_MIN_GNF} et ${PRIX_PLAT_MAX_GNF}, ${MAX_PLATS} plats au plus.` };

  const horaires = texte(c.horaires, 200);
  if (horaires.length < 3) return { ok: false, erreur: "Indiquez vos horaires (par exemple : tous les jours, 9h à 22h)." };

  return { ok: true, candidature: { demande: base.demande, horaires, moyensPaiement: moyens, services, plats } };
}

/** Ce que renvoie la lecture d'une photo de menu (même forme que `AnalyseMenu` du Chef IA, réduite à ce dont le candidat a besoin). */
export interface LectureMenu {
  plats: { nom: string; prix: number }[];
  refuses: { brut: string; raison: string }[];
  etat: "plats" | "indetermine" | "vide";
}

/**
 * Réduit l'analyse du Chef IA aux plats d'un brouillon de candidature : nom et prix entier dans les bornes de la candidature, au plus `MAX_PLATS`. Un plat hors bornes (par
 * exemple un prix de 25 000 000 lu à la place de 25 000) n'est jamais gardé en silence : il passe dans `refuses` avec sa raison, que l'écran montre.
 */
export function platsDepuisLecture(lecture: LectureMenu): LectureMenu {
  const plats: { nom: string; prix: number }[] = [];
  const refuses = [...lecture.refuses];
  for (const p of lecture.plats) {
    if (!Number.isInteger(p.prix) || p.prix < PRIX_PLAT_MIN_GNF || p.prix > PRIX_PLAT_MAX_GNF) {
      refuses.push({ brut: `${p.nom} (${p.prix} GNF)`, raison: `prix hors limites (${PRIX_PLAT_MIN_GNF} à ${PRIX_PLAT_MAX_GNF} GNF)` });
      continue;
    }
    if (plats.length >= MAX_PLATS) {
      refuses.push({ brut: p.nom, raison: `au-delà de ${MAX_PLATS} plats : l'équipe complétera le reste avec vous` });
      continue;
    }
    plats.push({ nom: p.nom, prix: p.prix });
  }
  return { plats, refuses, etat: plats.length > 0 ? "plats" : lecture.etat === "plats" ? "indetermine" : lecture.etat };
}

/** Ce que le candidat voit : cinq états simples plutôt que les six statuts internes de l'équipe. */
export type EtatCandidat = "recue" | "en_cours" | "acceptee" | "creee" | "refusee";

export function etatPourCandidat(statut: string): EtatCandidat {
  switch (statut) {
    case "rappelee":
    case "visite_prevue":
      return "en_cours";
    case "accord":
      return "acceptee";
    case "creee":
      return "creee";
    case "refusee":
      return "refusee";
    default:
      return "recue";
  }
}

export const LIBELLE_ETAT_CANDIDAT: Record<EtatCandidat, string> = {
  recue: "Demande reçue",
  en_cours: "En cours de traitement",
  acceptee: "Demande acceptée",
  creee: "Votre restaurant est en ligne",
  refusee: "Demande refusée",
};

/** Date limite de réponse annoncée (ISO), ou null si la date de dépôt est illisible. */
export function reponseAttendueLe(deposeeLe: string): string | null {
  const t = Date.parse(deposeeLe);
  return Number.isNaN(t) ? null : new Date(t + DELAI_REPONSE_HEURES * 3600_000).toISOString();
}

/** Chemin d'une image de candidature dans le dépôt privé : toujours sous l'identifiant du compte, avec un nom généré (jamais celui du client). */
export function cheminImageCandidature(utilisateurId: string, type: "logo" | "photo", extension: string, alea: string): string {
  return `${utilisateurId}/${type}-${alea}.${extension}`;
}
