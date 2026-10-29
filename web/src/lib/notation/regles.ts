// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/NOTATION.md.

export type CibleAvis = "restaurant" | "livreur" | "client";
export type AuteurAvis = "client" | "restaurant" | "livreur";

/** Qui peut noter qui : le client note le restaurant et le livreur ; le restaurant et le livreur notent le client. */
const COMBINAISONS: readonly [AuteurAvis, CibleAvis][] = [
  ["client", "restaurant"],
  ["client", "livreur"],
  ["restaurant", "client"],
  ["livreur", "client"],
];

export function combinaisonAutorisee(auteur: AuteurAvis, cible: CibleAvis): boolean {
  return COMBINAISONS.some(([a, c]) => a === auteur && c === cible);
}

/** Seule la note d'un restaurant par un client est publique. Livreur et client : exploitation (et l'intéressé pour le livreur). */
export function estPublique(cible: CibleAvis): boolean {
  return cible === "restaurant";
}

export interface Etiquette {
  cle: string;
  libelle: string;
  positive: boolean;
}

export const ETIQUETTES: Record<CibleAvis, readonly Etiquette[]> = {
  restaurant: [
    { cle: "plat_chaud", libelle: "Plat chaud", positive: true },
    { cle: "bonnes_portions", libelle: "Bonnes portions", positive: true },
    { cle: "emballage_soigne", libelle: "Emballage soigné", positive: true },
    { cle: "prete_a_l_heure", libelle: "Prête à l'heure", positive: true },
    { cle: "bon_rapport", libelle: "Bon rapport qualité-prix", positive: true },
    { cle: "plat_froid", libelle: "Plat froid", positive: false },
    { cle: "petites_portions", libelle: "Portions petites", positive: false },
    { cle: "emballage_abime", libelle: "Emballage abîmé", positive: false },
    { cle: "erreur_commande", libelle: "Erreur dans la commande", positive: false },
    { cle: "long_a_preparer", libelle: "Long à préparer", positive: false },
  ],
  livreur: [
    { cle: "rapide", libelle: "Rapide", positive: true },
    { cle: "aimable", libelle: "Aimable", positive: true },
    { cle: "soigneux", libelle: "Soigneux", positive: true },
    { cle: "en_retard", libelle: "En retard", positive: false },
    { cle: "peu_aimable", libelle: "Peu aimable", positive: false },
    { cle: "commande_abimee", libelle: "Commande abîmée", positive: false },
  ],
  client: [
    { cle: "agreable", libelle: "Agréable", positive: true },
    { cle: "injoignable", libelle: "Injoignable", positive: false },
    { cle: "adresse_incorrecte", libelle: "Adresse incorrecte", positive: false },
    { cle: "impoli", libelle: "Impoli", positive: false },
    { cle: "annule_a_la_porte", libelle: "A annulé à la porte", positive: false },
  ],
};

export const NOTE_MIN = 1;
export const NOTE_MAX = 5;
export const ETIQUETTES_MAX = 5;
export const COMMENTAIRE_MAX = 500;
export const REPONSE_MAX = 500;
export const FENETRE_NOTATION_JOURS = 14;
export const FENETRE_MODIFICATION_HEURES = 24;
/** Un même compte ne peut donner qu'un avis sur un même restaurant par période de ce nombre de jours (anti-bourrage des notes). */
export const INTERVALLE_AVIS_MEME_RESTAURANT_JOURS = 7;
/** Nombre d'avis publiés à partir duquel la moyenne s'affiche et compte dans le classement. */
export const SEUIL_AFFICHAGE = 5;
/** Poids et moyenne de départ du lissage : un restaurant sans avis vaut 10 avis « virtuels » à 4,0 (5 avis à 5,0 ne devancent pas 30 avis à 4,5). */
export const LISSAGE_POIDS = 10;
export const LISSAGE_MOYENNE = 4.0;
/** Seuil sous lequel un restaurant ou un livreur est signalé à l'exploitation. */
export const SEUIL_ALERTE_MOYENNE = 3.5;

export interface AvisSaisi {
  auteur: AuteurAvis;
  cible: CibleAvis;
  note: unknown;
  etiquettes?: unknown;
  commentaire?: unknown;
}

export interface AvisValide {
  note: number;
  etiquettes: string[];
  commentaire: string | null;
}

export type ResultatAvis = { ok: true; avis: AvisValide } | { ok: false; erreur: string };

/** Nettoie un texte libre : espaces normalisés, caractères de contrôle retirés. */
export function nettoyerTexte(brut: string): string {
  // eslint-disable-next-line no-control-regex
  return brut.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function validerAvis(saisie: AvisSaisi): ResultatAvis {
  if (!combinaisonAutorisee(saisie.auteur, saisie.cible)) return { ok: false, erreur: "Cette note n'est pas possible." };

  const note = saisie.note;
  if (typeof note !== "number" || !Number.isInteger(note) || note < NOTE_MIN || note > NOTE_MAX) {
    return { ok: false, erreur: `Choisissez une note de ${NOTE_MIN} à ${NOTE_MAX} étoiles.` };
  }

  const brutes = saisie.etiquettes === undefined ? [] : saisie.etiquettes;
  if (!Array.isArray(brutes) || brutes.some((e) => typeof e !== "string")) return { ok: false, erreur: "Étiquettes invalides." };
  const etiquettes = [...new Set(brutes as string[])];
  if (etiquettes.length > ETIQUETTES_MAX) return { ok: false, erreur: `Au plus ${ETIQUETTES_MAX} étiquettes.` };
  const permises = new Set(ETIQUETTES[saisie.cible].map((e) => e.cle));
  if (etiquettes.some((e) => !permises.has(e))) return { ok: false, erreur: "Étiquette inconnue." };

  const brutCommentaire = saisie.commentaire === undefined || saisie.commentaire === null ? "" : saisie.commentaire;
  if (typeof brutCommentaire !== "string") return { ok: false, erreur: "Commentaire invalide." };
  const commentaire = nettoyerTexte(brutCommentaire);
  if (commentaire !== "" && saisie.cible === "client") {
    return { ok: false, erreur: "Une note sur un client se fait avec des étiquettes, sans commentaire libre." };
  }
  if (commentaire.length > COMMENTAIRE_MAX) return { ok: false, erreur: `Commentaire trop long (${COMMENTAIRE_MAX} caractères au plus).` };

  return { ok: true, avis: { note, etiquettes, commentaire: commentaire === "" ? null : commentaire } };
}

export function validerReponse(brut: unknown): { ok: true; texte: string } | { ok: false; erreur: string } {
  if (typeof brut !== "string") return { ok: false, erreur: "Réponse invalide." };
  const texte = nettoyerTexte(brut);
  if (texte.length < 2) return { ok: false, erreur: "Écrivez une réponse (2 caractères au moins)." };
  if (texte.length > REPONSE_MAX) return { ok: false, erreur: `Réponse trop longue (${REPONSE_MAX} caractères au plus).` };
  return { ok: true, texte };
}

// ---------------------------------------------------------------- fenêtres de temps

export type StatutCommandeNotable = "terminee" | string;

export interface CommandeNotable {
  statut: StatutCommandeNotable;
  estTest: boolean;
  /** Date de clôture de la commande (ISO) : sa dernière mise à jour une fois « terminée ». */
  clotureLe: string;
  /** Commande saisie par le personnel du restaurant : il ne peut pas se noter lui-même. */
  saisiePersonnel?: boolean;
}

export type RaisonRefus = "pas_terminee" | "commande_de_test" | "delai_depasse" | "saisie_personnel";

/** `null` si on peut noter cette commande, sinon la raison du refus. */
export function raisonNotationImpossible(commande: CommandeNotable, maintenant: Date): RaisonRefus | null {
  if (commande.estTest) return "commande_de_test";
  if (commande.saisiePersonnel) return "saisie_personnel";
  if (commande.statut !== "terminee") return "pas_terminee";
  const ecoule = maintenant.getTime() - new Date(commande.clotureLe).getTime();
  if (!Number.isFinite(ecoule) || ecoule > FENETRE_NOTATION_JOURS * 86_400_000) return "delai_depasse";
  return null;
}

export function messageRefus(raison: RaisonRefus): string {
  switch (raison) {
    case "pas_terminee":
      return "Vous pourrez noter cette commande quand elle sera terminée.";
    case "saisie_personnel":
      return "Une commande saisie par le personnel du restaurant ne se note pas.";
    case "commande_de_test":
      return "Une commande de test ne se note pas.";
    case "delai_depasse":
      return `Le délai pour noter cette commande (${FENETRE_NOTATION_JOURS} jours) est dépassé.`;
  }
}

/** Une note reste modifiable un court moment après sa création. */
export function noteModifiable(creeLe: string, maintenant: Date): boolean {
  const ecoule = maintenant.getTime() - new Date(creeLe).getTime();
  return Number.isFinite(ecoule) && ecoule >= 0 && ecoule <= FENETRE_MODIFICATION_HEURES * 3_600_000;
}

// ---------------------------------------------------------------- moyennes

/** Moyenne simple arrondie à une décimale, ou `null` sans avis. */
export function moyenne(somme: number, total: number): number | null {
  if (!Number.isFinite(somme) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((somme / total) * 10) / 10;
}

/** Moyenne montrée au public : seulement à partir du seuil, sinon `null` (« Nouveau »). */
export function moyenneAffichee(somme: number, total: number): number | null {
  return total >= SEUIL_AFFICHAGE ? moyenne(somme, total) : null;
}

/** Moyenne lissée : tire les restaurants peu notés vers la moyenne de départ. */
export function noteLissee(somme: number, total: number): number {
  const s = Number.isFinite(somme) && somme > 0 ? somme : 0;
  const n = Number.isFinite(total) && total > 0 ? total : 0;
  return (LISSAGE_POIDS * LISSAGE_MOYENNE + s) / (LISSAGE_POIDS + n);
}

/** Score de classement : la note lissée, seulement à partir du seuil ; `null` = pas de rang par la note. */
export function scoreClassement(somme: number, total: number): number | null {
  return total >= SEUIL_AFFICHAGE ? noteLissee(somme, total) : null;
}

/**
 * Compare deux restaurants pour le classement du catalogue : ceux qui ont un score passent avant ceux qui n'en ont pas, puis le plus haut
 * score d'abord ; deux restaurants sans score (ou à score égal) gardent leur ordre d'origine (retour 0).
 */
export function comparerParNote(a: { somme: number; total: number }, b: { somme: number; total: number }): number {
  const sa = scoreClassement(a.somme, a.total);
  const sb = scoreClassement(b.somme, b.total);
  if (sa === null && sb === null) return 0;
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sb - sa;
}

/** « 4,3 · 12 avis », « Nouveau » ou « 1 avis » selon le seuil. */
export function libelleNote(somme: number, total: number): string {
  const m = moyenneAffichee(somme, total);
  if (m === null) return total === 0 ? "Nouveau" : `Nouveau · ${total} avis`;
  return `${m.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${total} avis`;
}

// ---------------------------------------------------------------- alertes (exploitation)

/** Restaurant ou livreur : moyenne sous le seuil avec assez de notes pour que ce soit significatif. */
export function sousLeSeuil(somme: number, total: number): boolean {
  const m = moyenne(somme, total);
  return total >= SEUIL_AFFICHAGE && m !== null && m < SEUIL_ALERTE_MOYENNE;
}

/** Trois mauvaises notes (2 ou moins) de suite, la plus récente en premier. */
export function troisMauvaisesDeSuite(notesRecentes: readonly number[]): boolean {
  return notesRecentes.length >= 3 && notesRecentes.slice(0, 3).every((n) => n <= 2);
}

// ---------------------------------------------------------------- affichage

/** Prénom affiché sous un avis public : premier mot du nom, 20 caractères au plus ; « Client » à défaut. */
export function prenomAffiche(nom: string): string {
  const premier = nettoyerTexte(nom).split(" ")[0] ?? "";
  const propre = premier.replace(/[^\p{L}'’-]/gu, "").slice(0, 20);
  return propre.length >= 2 ? propre.charAt(0).toUpperCase() + propre.slice(1) : "Client";
}
