/**
 * Habilitations par paliers (Studio, palier 2 ; modèle Meta Business, docs/STUDIO-SUPERADMIN.md §5). Module PUR : aucun
 * import serveur, testé par `scripts/tests/paliers.test.mts`.
 *
 * Trois questions séparées : QUI (une personne qui a déjà un rôle système), SUR QUOI (un actif du catalogue ci-dessous), À
 * QUEL NIVEAU (un palier de 0 à 5). Les rôles actuels deviennent des PRÉRÉGLAGES dérivés de `PERMISSIONS_PAR_ROLE` : sans
 * habilitation, chaque rôle garde exactement son comportement d'avant.
 *
 * Palier effectif = min(max(préréglage, relèvements applicables), plafonds applicables). Une habilitation expirée est
 * ignorée. Le palier 5 (Propriétaire) n'est jamais attribuable : il reste celui du rôle `super_admin`, qui n'est soumis à
 * aucune habilitation (ni plafond ni relèvement) et n'a donc besoin d'aucune lecture pour être évalué.
 *
 * Ce module ne remplace AUCUNE permission : un écran garde sa permission (`contenu.editer`…) ET exige un palier
 * (`deciderAcces`). Refus par défaut à chaque étape ; habilitations illisibles = refus (échec fermé).
 */

import { roleAPermission, PERMISSIONS_PAR_ROLE, type Permission, type RoleSysteme } from "./permissions";

export type Palier = 0 | 1 | 2 | 3 | 4 | 5;

export interface DefinitionPalier {
  readonly valeur: Palier;
  readonly libelle: string;
  readonly description: string;
  /** Faux pour le palier 5 : réservé au rôle `super_admin`, jamais attribué par habilitation. */
  readonly attribuable: boolean;
}

export const PALIERS: readonly DefinitionPalier[] = [
  { valeur: 0, libelle: "Observateur", description: "Voit le contenu, ne modifie rien.", attribuable: true },
  { valeur: 1, libelle: "Contributeur", description: "Crée et modifie des brouillons, sans rien mettre en ligne.", attribuable: true },
  { valeur: 2, libelle: "Éditeur", description: "Publie, dépublie, supprime et rétablit : ses changements arrivent sur le site.", attribuable: true },
  { valeur: 3, libelle: "Responsable", description: "Réservé (planification, thème, périmètre) : pas encore utilisé.", attribuable: true },
  { valeur: 4, libelle: "Administrateur", description: "Réservé (gestion des accès d'un actif) : pas encore utilisé.", attribuable: true },
  { valeur: 5, libelle: "Propriétaire", description: "Contrôle total. Réservé au rôle super administrateur, ne s'attribue pas.", attribuable: false },
];

export const PALIER_MAX_ATTRIBUABLE = 4;

export function libellePalier(palier: Palier): string {
  return PALIERS[palier].libelle;
}

export interface DefinitionActif {
  readonly code: string;
  readonly libelle: string;
  /** Actif parent : une habilitation sur le parent vaut pour l'enfant. */
  readonly parent?: string;
}

/** Catalogue des actifs. `*` couvre tout ; `contenu` couvre `contenu:*`. Conforme au CHECK de la table `acces_paliers`. */
export const ACTIFS: readonly DefinitionActif[] = [
  { code: "*", libelle: "Tout (toute l'administration)" },
  { code: "contenu", libelle: "Contenu (pages, bannières, textes)" },
  { code: "contenu:pages", libelle: "Pages", parent: "contenu" },
  { code: "contenu:bannieres", libelle: "Bannières", parent: "contenu" },
  { code: "contenu:textes", libelle: "Textes du site", parent: "contenu" },
  { code: "theme", libelle: "Thème" },
  { code: "medias", libelle: "Médias" },
  { code: "navigation", libelle: "Navigation" },
  { code: "traductions", libelle: "Traductions" },
  { code: "interrupteurs", libelle: "Interrupteurs (mises à jour)" },
  { code: "parametres", libelle: "Paramètres" },
  { code: "restaurants", libelle: "Restaurants" },
  { code: "commandes", libelle: "Commandes" },
  { code: "comptes", libelle: "Comptes" },
  { code: "audit", libelle: "Journal d'audit" },
];

/** Même expression que le CHECK de la colonne `acces_paliers.actif`. */
export const REGEX_ACTIF = /^(\*|[a-z_]+(:[a-z_]+)?)$/;

export function estActifConnu(code: string): boolean {
  return ACTIFS.some((a) => a.code === code);
}

export function libelleActif(code: string): string {
  return ACTIFS.find((a) => a.code === code)?.libelle ?? code;
}

/** Actifs protégés par palier dans ce lot (écrans du Studio livrés aux tâches 1 à 3). */
export const ACTIFS_STUDIO = ["contenu:pages", "contenu:bannieres", "contenu:textes"] as const;
export type ActifStudio = (typeof ACTIFS_STUDIO)[number];

/** Paliers minimums des actions du Studio : voir ≥ 0, brouillon ≥ 1, mise en ligne (publier, dépublier, supprimer, rétablir) ≥ 2. */
export const MINIMUMS_STUDIO = { lire: 0, brouillon: 1, publier: 2 } as const satisfies Record<string, Palier>;

/**
 * Vrai si une habilitation posée sur `habilitationActif` s'applique à `actifDemande`. `*` couvre tout ; un parent couvre
 * ses enfants (`contenu` → `contenu:pages`) ; jamais l'inverse (un enfant ne couvre pas son parent).
 */
export function actifCouvre(habilitationActif: string, actifDemande: string): boolean {
  if (habilitationActif === "*") return true;
  if (habilitationActif === actifDemande) return true;
  return actifDemande.startsWith(`${habilitationActif}:`) && !habilitationActif.includes(":");
}

/**
 * Correspondance « permission actuelle → palier sur un actif », source des préréglages. Une permission de consultation
 * donne Observateur (0), une permission d'action donne Éditeur (2). Les permissions sans actif au catalogue
 * (`contenu.mettre_en_avant`, `taxonomie.editer`, `coordonees.voir`, `systeme.roles`) n'y figurent pas : elles restent
 * gouvernées par la seule matrice de permissions.
 */
export const CORRESPONDANCE_PERMISSIONS: readonly { permission: Permission; actif: string; palier: Palier }[] = [
  { permission: "restaurant.consulter", actif: "restaurants", palier: 0 },
  { permission: "restaurant.moderer", actif: "restaurants", palier: 2 },
  { permission: "compte.consulter", actif: "comptes", palier: 0 },
  { permission: "compte.inviter", actif: "comptes", palier: 2 },
  { permission: "compte.supprimer", actif: "comptes", palier: 2 },
  { permission: "contenu.editer", actif: "contenu", palier: 2 },
  { permission: "contenu.editer", actif: "medias", palier: 2 },
  { permission: "commande.consulter", actif: "commandes", palier: 0 },
  { permission: "commande.support", actif: "commandes", palier: 2 },
  { permission: "systeme.audit", actif: "audit", palier: 0 },
  { permission: "parametres.editer", actif: "parametres", palier: 2 },
  { permission: "parametres.editer", actif: "interrupteurs", palier: 2 },
];

/** Préréglage d'un rôle : actif → palier. `super_admin` : Propriétaire (5) sur tout. Les autres : dérivés de leurs permissions. */
export function paliersPreset(role: RoleSysteme): Readonly<Record<string, Palier>> {
  if (role === "super_admin") return { "*": 5 };
  const preset: Record<string, Palier> = {};
  for (const { permission, actif, palier } of CORRESPONDANCE_PERMISSIONS) {
    if (!PERMISSIONS_PAR_ROLE[role].includes(permission)) continue;
    const actuel = preset[actif];
    if (actuel === undefined || palier > actuel) preset[actif] = palier;
  }
  return preset;
}

/** Une ligne de `acces_paliers` telle que lue en base (valeurs non fiables : revérifiées ici). */
export interface Habilitation {
  actif: string;
  palier: number;
  plafond: boolean;
  expire_le: string | null;
}

/**
 * État d'une habilitation à l'instant `maintenant`. Prudence asymétrique sur une date illisible : un relèvement est alors
 * considéré expiré (il ne donne rien), un plafond reste actif (il continue de limiter).
 */
function estActive(h: Habilitation, maintenant: number): boolean {
  if (h.expire_le === null) return true;
  const fin = Date.parse(h.expire_le);
  if (Number.isNaN(fin)) return h.plafond;
  return fin > maintenant;
}

function palierValide(valeur: number): valeur is 0 | 1 | 2 | 3 | 4 {
  return Number.isInteger(valeur) && valeur >= 0 && valeur <= PALIER_MAX_ATTRIBUABLE;
}

/**
 * Palier effectif d'un rôle sur un actif, ou `null` si la personne n'a aucun accès à cet actif. `super_admin` : toujours
 * 5, les habilitations sont ignorées. Lignes invalides : un relèvement hors 0-4 est ignoré (jamais d'élévation), un
 * plafond hors 0-4 limite à 0 (jamais d'élévation non plus).
 */
export function palierEffectif({
  role,
  habilitations,
  actif,
  maintenant,
}: {
  role: RoleSysteme;
  habilitations: readonly Habilitation[];
  actif: string;
  maintenant: number;
}): Palier | null {
  if (role === "super_admin") return 5;

  let palier: number | null = null;
  for (const [actifPreset, valeur] of Object.entries(paliersPreset(role))) {
    if (actifCouvre(actifPreset, actif) && (palier === null || valeur > palier)) palier = valeur;
  }

  const applicables = habilitations.filter((h) => typeof h.actif === "string" && actifCouvre(h.actif, actif) && estActive(h, maintenant));

  for (const h of applicables) {
    if (h.plafond !== false || !palierValide(h.palier)) continue;
    if (palier === null || h.palier > palier) palier = h.palier;
  }
  if (palier === null) return null;

  for (const h of applicables) {
    if (h.plafond === false) continue;
    const plafond = palierValide(h.palier) ? h.palier : 0;
    if (plafond < palier) palier = plafond;
  }
  return palier as Palier;
}

/** Résultat de la lecture des habilitations d'une personne : `ok: false` = illisibles (erreur base, table absente…). */
export type LectureHabilitations = { ok: true; habilitations: readonly Habilitation[] } | { ok: false };

/** Le seul rôle évaluable sans lire les habilitations est `super_admin` (préréglage seul, palier 5 sur tout). */
export function lectureNecessaire(role: RoleSysteme): boolean {
  return role !== "super_admin";
}

export type DecisionAcces =
  | { autorise: true; palier: Palier }
  | { autorise: false; raison: "permission" | "illisible" | "palier"; palier: Palier | null };

/**
 * Décision complète d'accès à une action protégée, dans l'ordre : permission actuelle (inchangée), lisibilité des
 * habilitations (échec FERMÉ, sauf `super_admin` qui n'en a pas besoin), palier effectif ≥ minimum.
 */
export function deciderAcces({
  role,
  permission,
  actif,
  minimum,
  lecture,
  maintenant,
}: {
  role: RoleSysteme;
  /** Permission actuelle exigée en plus du palier ; omise si l'appelant l'a déjà vérifiée. */
  permission?: Permission;
  actif: string;
  minimum: Palier;
  /** `null` = pas lue (autorisé seulement pour `super_admin`). */
  lecture: LectureHabilitations | null;
  maintenant: number;
}): DecisionAcces {
  if (permission && !roleAPermission(role, permission)) return { autorise: false, raison: "permission", palier: null };

  let habilitations: readonly Habilitation[] = [];
  if (lectureNecessaire(role)) {
    if (!lecture || !lecture.ok) return { autorise: false, raison: "illisible", palier: null };
    habilitations = lecture.habilitations;
  }

  const palier = palierEffectif({ role, habilitations, actif, maintenant });
  if (palier === null || palier < minimum) return { autorise: false, raison: "palier", palier };
  return { autorise: true, palier };
}

/**
 * Garde en base des plafonds (trigger `fn_garde_palier_contenu` sur content_pages, content_banners, contenu_emplacements) :
 * passe à `true` seulement quand la migration est appliquée ET que le contournement par l'API directe a été testé refusé
 * (temps B). Sert à l'écran des habilitations pour dire honnêtement ce qui est garanti.
 */
export const GARDE_PLAFONDS_EN_BASE_VALIDEE = true;

export const MESSAGE_DROITS_ILLISIBLES = "Vos droits n'ont pas pu être vérifiés, réessayez dans un instant.";

/** Message d'un refus de palier (serveur) ou d'un bouton indisponible (interface), en français clair. */
export function explicationPalier(palier: Palier | null, minimum: Palier): string {
  const requis = libellePalier(minimum);
  if (palier === null) return `Vous n'avez pas accès à cet espace : il faut le palier ${requis}.`;
  return `Votre accès ici est limité au palier ${libellePalier(palier)} : cette action demande le palier ${requis}. Demandez-le à un super administrateur.`;
}

// --- Attribution -------------------------------------------------------------

export type TypeHabilitation = "relevement" | "plafond";

export interface HabilitationValidee {
  actif: string;
  palier: 0 | 1 | 2 | 3 | 4;
  plafond: boolean;
  expire_le: string | null;
}

/**
 * Convertit la saisie d'un champ date (`AAAA-MM-JJ`) en fin de journée UTC (Conakry est à UTC+0 sans heure d'été) :
 * l'accès vaut jusqu'à la fin du jour choisi. Chaîne vide → `null` (sans expiration) ; saisie invalide → `undefined`.
 */
export function expirationDepuisSaisie(saisie: string): string | null | undefined {
  const propre = saisie.trim();
  if (propre === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(propre);
  if (!m) return undefined;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(annee, mois - 1, jour, 23, 59, 59));
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return undefined;
  return date.toISOString();
}

/**
 * Valide une habilitation à attribuer (saisie du formulaire, jamais fiable) : actif du catalogue, palier entier de 0 à 4
 * (le 5 est refusé avec un message dédié), type connu, expiration valide et future.
 */
export function validerHabilitation({
  actif,
  palier,
  type,
  expiration,
  maintenant,
}: {
  actif: string;
  palier: string | number;
  type: string;
  expiration: string;
  maintenant: number;
}): { ok: true; valeur: HabilitationValidee } | { ok: false; erreur: string } {
  if (!REGEX_ACTIF.test(actif) || !estActifConnu(actif)) return { ok: false, erreur: "Choisissez un actif de la liste." };

  const texte = String(palier).trim();
  if (texte === "5") {
    return { ok: false, erreur: "Le palier Propriétaire est réservé au rôle super administrateur : il ne s'attribue pas." };
  }
  if (!/^[0-4]$/.test(texte)) return { ok: false, erreur: "Choisissez un palier entre 0 (Observateur) et 4 (Administrateur)." };
  const valeurPalier = Number(texte) as 0 | 1 | 2 | 3 | 4;

  if (type !== "relevement" && type !== "plafond") return { ok: false, erreur: "Choisissez le type d'accès." };

  const expireLe = expirationDepuisSaisie(expiration);
  if (expireLe === undefined) return { ok: false, erreur: "La date d'expiration est invalide." };
  if (expireLe !== null && Date.parse(expireLe) <= maintenant) {
    return { ok: false, erreur: "La date d'expiration doit être dans le futur." };
  }

  return { ok: true, valeur: { actif, palier: valeurPalier, plafond: type === "plafond", expire_le: expireLe } };
}

/**
 * La personne qui reçoit une habilitation doit déjà avoir un rôle système autre que `super_admin` (un super administrateur
 * a toujours le contrôle total ; une personne sans rôle reste exclue de /system, cas différé).
 */
export function validerCible(role: string | null): string | null {
  if (role === null) {
    return "Cette personne n'a pas de rôle système : attribuez-lui d'abord un rôle (écran Rôles système). L'accès partiel sans rôle n'existe pas encore.";
  }
  if (role === "super_admin") return "Un super administrateur a toujours le contrôle total : aucune habilitation ne s'applique à lui.";
  if (!(Object.keys(PERMISSIONS_PAR_ROLE) as string[]).includes(role)) return "Le rôle de cette personne n'est pas reconnu.";
  return null;
}

/** Résumé lisible d'une habilitation (journal d'audit, confirmations). */
export function decrireHabilitation(h: { actif: string; palier: number; plafond: boolean; expire_le: string | null }): string {
  const nom = palierValide(h.palier) ? `${libellePalier(h.palier)} (${h.palier})` : String(h.palier);
  const type = h.plafond ? "Accès partiel (plafond)" : "Relèvement";
  const fin = h.expire_le ? `, jusqu'au ${h.expire_le.slice(0, 10)}` : "";
  return `${type} ${nom} sur ${h.actif}${fin}`;
}
