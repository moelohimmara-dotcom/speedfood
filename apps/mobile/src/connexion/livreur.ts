import { lireReponseFicheLivreur, type FicheLivreur } from '../../../../packages/shared/src/contracts/livreur-fiche.ts';
import { lireReponseEtatLivreur, lireReponseEnLigneLivreur, type OffreLivreur } from '../../../../packages/shared/src/contracts/livreur-etat.ts';
import {
  ETAPES_COURSE_LIVREUR, MODES_COURSE_LIVREUR, STATUTS_APRES_RECUPERATION, STATUTS_COURSE_ACTIVE,
  type ClientCourseLivreur, type CourseLivreur, type EtapeCourseLivreur, type EtatLivreurAvecCourse,
} from '../../../../packages/shared/src/contracts/livreur-course.ts';
/** L'état lu par l'application : fiche, offre et (G3) course. */
export type EtatLivreur = EtatLivreurAvecCourse;
export type { FicheLivreur, OffreLivreur, CourseLivreur, ClientCourseLivreur, EtapeCourseLivreur };
export const lireFicheLivreur = lireReponseFicheLivreur;
/**
 * Erreur d'une action livreur. `refus` : le serveur a explicitement refusé (rien n'a été appliqué ; relire l'état suffit).
 * `incertain` : l'action a pu être appliquée (réseau, délai, service indisponible, réponse illisible) ; ne jamais la
 * rejouer automatiquement — relire l'état avant de reproposer le bouton.
 */
export class ErreurLivreur extends Error {
  genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurLivreur'; this.genre = genre; }
}
export const lireEnLigneLivreur = lireReponseEnLigneLivreur;
export const LIBELLES_STATUT_LIVREUR: Record<FicheLivreur['statut'], string> = { hors_ligne: 'Hors ligne', disponible: 'Disponible', en_course: 'En course' };
export const LIBELLES_VEHICULE_LIVREUR: Record<FicheLivreur['vehicule'], string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };
export const LIBELLES_CYCLE_LIVREUR: Record<FicheLivreur['cycle'], string> = { cree: 'Fiche créée', invite: 'Invitation en cours', candidat: 'Dossier en cours', actif: 'Compte actif', suspendu: 'Compte suspendu', archive: 'Fiche archivée' };
/** Distance affichable : une décimale en km, ou « — » quand elle est inconnue (jamais un faux zéro). */
export function libelleDistanceLivreur(km: number | null): string {
  return km === null ? '—' : km.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}
/** Échéance affichable de l'offre : heure locale lisible ; la date reçue a déjà été validée par le parseur. */
export function libelleEcheanceOffre(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ---------- G3 : course du livreur ----------

export const REGEX_UUID_LIVREUR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const illisible = (): never => { throw new Error('ETAT_LIVREUR_ILLISIBLE'); };
const objetExact = (v: unknown, cles: readonly string[]): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return illisible();
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== cles.length || !cles.every(c => Object.hasOwn(o, c))) return illisible();
  return o;
};
const chaine = (v: unknown, max: number): string => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v : illisible());

function lireClientStrict(v: unknown): ClientCourseLivreur {
  const o = objetExact(v, ['nom', 'telephone', 'adresse']);
  if (typeof o.nom !== 'string' || o.nom.length > 80 || typeof o.telephone !== 'string' || o.telephone.length > 40) return illisible();
  if (o.adresse !== null && (typeof o.adresse !== 'string' || o.adresse.length > 300)) return illisible();
  return { nom: o.nom, telephone: o.telephone, adresse: o.adresse };
}

/**
 * Lecture STRICTE de la course renvoyée par `GET /etat` : exactement les neuf champs du contrat, statut et mode connus, frais entier
 * sûr et positif, étapes connues et sans doublon, identifiant de livraison au format UUID. Le client (nom, téléphone, adresse) n'est accepté
 * QUE si le serveur le fournit et seulement après la récupération de la commande ; fourni avant, la réponse entière est refusée.
 * Tout écart rend la réponse illisible : jamais une course adoucie, jamais un faux « aucune course ».
 */
export function lireCourseStricte(v: unknown): CourseLivreur | null {
  if (v === null) return null;
  const o = objetExact(v, ['livraisonId', 'statut', 'mode', 'libelle', 'commandeReference', 'restaurantNom', 'fraisGnf', 'etapesPossibles', 'client']);
  if (typeof o.livraisonId !== 'string' || !REGEX_UUID_LIVREUR.test(o.livraisonId)) return illisible();
  const statut = (STATUTS_COURSE_ACTIVE as readonly unknown[]).includes(o.statut) ? (o.statut as CourseLivreur['statut']) : illisible();
  const mode = (MODES_COURSE_LIVREUR as readonly unknown[]).includes(o.mode) ? (o.mode as CourseLivreur['mode']) : illisible();
  if (typeof o.fraisGnf !== 'number' || !Number.isSafeInteger(o.fraisGnf) || o.fraisGnf < 0) return illisible();
  if (!Array.isArray(o.etapesPossibles) || o.etapesPossibles.length > ETAPES_COURSE_LIVREUR.length) return illisible();
  const etapes = o.etapesPossibles as unknown[];
  if (!etapes.every(e => (ETAPES_COURSE_LIVREUR as readonly unknown[]).includes(e)) || new Set(etapes).size !== etapes.length) return illisible();
  let client: ClientCourseLivreur | null = null;
  if (o.client !== null) {
    if (!STATUTS_APRES_RECUPERATION.includes(statut)) return illisible();
    client = lireClientStrict(o.client);
  }
  return {
    livraisonId: o.livraisonId, statut, mode, libelle: chaine(o.libelle, 80), commandeReference: chaine(o.commandeReference, 40),
    restaurantNom: chaine(o.restaurantNom, 80), fraisGnf: o.fraisGnf, etapesPossibles: etapes as EtapeCourseLivreur[], client,
  };
}

/**
 * Lecture de la réponse d'état : l'enveloppe, la fiche et l'offre passent par le parseur partagé de G2 ; l'état contient EXACTEMENT
 * `fiche`, `offre` et `course` (une clé en trop ou une course absente rend la réponse illisible).
 */
export function lireEtatLivreur(v: unknown): EtatLivreur | null {
  const base = lireReponseEtatLivreur(v);
  if (base === null) return null;
  const o = objetExact((v as { etat: unknown }).etat, ['fiche', 'offre', 'course']);
  return { fiche: base.fiche, offre: base.offre, course: lireCourseStricte(o.course) };
}

export const LIBELLES_ETAPE_COURSE: Record<EtapeCourseLivreur, string> = {
  vers_restaurant: 'Je pars vers le restaurant',
  recuperee: 'J’ai récupéré la commande',
  vers_client: 'Je pars chez le client',
  livree: 'Livrée',
  echec: 'Échec de la livraison',
};

/** Boutons d'étape à montrer : UNIQUEMENT ceux que le serveur autorise (`etapesPossibles`), dans l'ordre du parcours. */
export function boutonsCourse(course: CourseLivreur): EtapeCourseLivreur[] {
  return ETAPES_COURSE_LIVREUR.filter(e => course.etapesPossibles.includes(e));
}

/** Client à afficher : seulement ce que le serveur a fourni, et seulement après la récupération ; sinon `null` (rien n'est inventé). */
export function clientVisible(course: CourseLivreur): ClientCourseLivreur | null {
  return course.client !== null && STATUTS_APRES_RECUPERATION.includes(course.statut) ? course.client : null;
}

export const MESSAGE_CODE_REMISE_LIVREUR = 'Le code de remise comporte exactement 4 chiffres.';
export const MESSAGE_RAISON_ECHEC_LIVREUR = 'Indiquez la raison de l’échec (300 caractères au plus).';
/** Code de remise saisi : 4 chiffres exactement, espaces retirés ; sinon `null`. Le code n'est jamais conservé ni repris dans un message. */
export function lireCodeRemiseLivreur(saisie: unknown): string | null {
  if (typeof saisie !== 'string') return null;
  const propre = saisie.replace(/\s+/g, '');
  return /^\d{4}$/.test(propre) ? propre : null;
}
/** Raison d'un échec : de 1 à 300 caractères après rognage ; sinon `null`. */
export function lireRaisonEchecLivreur(saisie: unknown): string | null {
  if (typeof saisie !== 'string') return null;
  const propre = saisie.trim();
  return propre.length >= 1 && propre.length <= 300 ? propre : null;
}
/** Ce que l'écran peut demander au serveur pour faire avancer la course : l'identifiant est celui de la course AFFICHÉE. */
export interface DemandeCourseLivreur { livraisonId: string; vers: EtapeCourseLivreur; code?: string; raison?: string }
