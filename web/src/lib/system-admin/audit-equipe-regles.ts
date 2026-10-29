/**
 * Règles pures de l'espace équipe « Audit » (application) : ce que l'application LIT du journal d'audit — les
 * indicateurs d'activité, les filtres (type d'action, période) et la mise en forme des entrées. Module sans base ni
 * serveur, donc testable seul (voir `scripts/tests/audit-equipe.test.mts`).
 *
 * L'application n'écrit rien dans le journal : il est en écriture seule par le serveur (ADR-010), et les actions qu'il
 * trace (publier, supprimer, attribuer un rôle) restent sur le site. L'application lit, filtre et renvoie vers
 * `/system/audit`, où chaque cible est cliquable.
 */

import { ACTIONS_AUDIT_CONNUES } from "./actionsAuditConnues";

/** Une période du filtre : `undefined` = tout l'historique. */
export interface PeriodeJournalAudit {
  valeur: number | undefined;
  libelle: string;
}

/** Périodes proposées par le filtre, dans l'ordre du site. */
export const PERIODES_JOURNAL_AUDIT: readonly PeriodeJournalAudit[] = [
  { valeur: undefined, libelle: "Tout l'historique" },
  { valeur: 1, libelle: "24 heures" },
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
];

/**
 * Une période inconnue retombe sur tout l'historique : jamais de valeur devinée, jamais de liste vide surprise.
 * Seules les trois périodes du site sont acceptées.
 */
export function periodeJournalAuditValide(brut: unknown): number | undefined {
  const nombre = typeof brut === "number" ? brut : Number.parseInt(String(brut ?? ""), 10);
  if (!Number.isFinite(nombre)) return undefined;
  return PERIODES_JOURNAL_AUDIT.some((periode) => periode.valeur === nombre) ? nombre : undefined;
}

/** Libellé d'une période (pour le bouton qui porte le filtre). */
export function libellePeriodeJournalAudit(jours: number | undefined): string {
  return PERIODES_JOURNAL_AUDIT.find((periode) => periode.valeur === jours)?.libelle ?? "Tout l'historique";
}

/**
 * Un type d'action hors catalogue est ignoré : le filtre ne peut pas demander une action qui n'existe pas, et le
 * journal n'est jamais filtré par une valeur inventée.
 */
export function actionJournalAuditConnue(brut: unknown): string | undefined {
  const code = typeof brut === "string" ? brut.trim() : "";
  if (!code) return undefined;
  return (ACTIONS_AUDIT_CONNUES as readonly string[]).includes(code) ? code : undefined;
}

/** Types de cible du journal : libellé lisible et section du site où la cible s'ouvre. */
export const CIBLES_JOURNAL_AUDIT: Record<string, { libelle: string; section: string }> = {
  restaurant: { libelle: "Restaurant", section: "/system/catalogue/restaurants" },
  commande: { libelle: "Commande", section: "/system/commandes" },
  utilisateur: { libelle: "Compte", section: "/system/acces/comptes" },
  content_page: { libelle: "Page d'aide", section: "/system/contenu/pages" },
  content_banner: { libelle: "Bannière", section: "/system/contenu/bannieres" },
  parametres_application: { libelle: "Paramètres", section: "/system/parametres" },
  menu_categories: { libelle: "Catégories", section: "/system/catalogue/taxonomie" },
};

/** Libellé d'une cible ; une cible inconnue est affichée telle quelle (comme sur le site). */
export function libelleCibleJournalAudit(cibleType: string): string {
  return CIBLES_JOURNAL_AUDIT[cibleType]?.libelle ?? cibleType;
}

/**
 * Adresse de la cible sur le site : la fiche exacte quand le site en a une (restaurant, commande), la section
 * correspondante sinon. `null` si le type de cible n'est pas connu : l'application affiche alors la cible en texte
 * simple, sans lien.
 */
export function cheminCibleJournalAudit(cibleType: string, cibleId: string): string | null {
  const cible = CIBLES_JOURNAL_AUDIT[cibleType];
  if (!cible) return null;
  if (cibleType === "restaurant" || cibleType === "commande") return `${cible.section}/${cibleId}`;
  return cible.section;
}

/** Identifiant court affiché à côté du libellé de la cible (les huit premiers caractères, comme sur le site). */
export function identifiantCibleCourt(cibleId: string): string {
  return cibleId.slice(0, 8);
}

/** Texte affiché pour la cible : « Restaurant a1b2c3d4 ». */
export function texteCibleJournalAudit(cibleType: string, cibleId: string): string {
  return `${libelleCibleJournalAudit(cibleType)} ${identifiantCibleCourt(cibleId)}`;
}

/**
 * Les indicateurs d'activité, avec la définition écrite de chacun : un chiffre sans sa définition peut être mal
 * interprété (exigence du site, bloc 8d). Les mêmes quatre indicateurs que sur `/system/audit`.
 */
export const INDICATEURS_AUDIT: readonly { cle: string; libelle: string; definition: string }[] = [
  {
    cle: "restaurants_en_attente",
    libelle: "Restaurants en attente de validation",
    definition:
      "Restaurants créés mais ni publiés, ni suspendus, ni en attente d'une correction demandée (jamais examinés).",
  },
  {
    cle: "restaurants_suspendus",
    libelle: "Restaurants suspendus",
    definition: "Restaurants avec une date de suspension active (suspendu_le non nul).",
  },
  {
    cle: "commandes_actives",
    libelle: "Commandes actives",
    definition:
      "Commandes dont le statut est « en attente », « acceptée » ou « prête » (ni terminale, ni refusée, ni annulée), tous restaurants confondus.",
  },
  {
    cle: "revelations_coordonnees_7j",
    libelle: "Révélations de coordonnées (7 derniers jours)",
    definition:
      "Nombre d'accès exceptionnels aux coordonnées d'un client (téléphone/adresse en clair) via le support, sur les 7 derniers jours glissants.",
  },
];

/** Libellé de l'auteur : une entrée sans auteur connu reste affichée comme telle, jamais masquée. */
export function libelleAuteurJournalAudit(acteurEmail: string | null): string {
  return acteurEmail?.trim() ? acteurEmail : "acteur inconnu";
}
