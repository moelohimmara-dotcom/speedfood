import "server-only";
import type { ContexteEquipeApi } from "@/lib/api/v1-equipe";
import { ACTIONS_AUDIT_CONNUES, LIBELLES_ACTIONS_AUDIT } from "./actionsAuditConnues";
import {
  INDICATEURS_AUDIT,
  PERIODES_JOURNAL_AUDIT,
  cheminCibleJournalAudit,
  libelleAuteurJournalAudit,
  libelleCibleJournalAudit,
  texteCibleJournalAudit,
} from "./audit-equipe-regles";

/**
 * Journal d'audit et indicateurs d'activité pour l'application (`/api/v1/equipe/audit`).
 *
 * Lecture seule, comme la page `/system/audit` : l'application montre les quatre indicateurs (avec leur définition
 * écrite), les filtres (type d'action, période) et les entrées du journal. Le journal est en écriture seule par le
 * serveur (ADR-010) : rien à écrire ici.
 *
 * La lecture passe par le client lié au jeton de la personne, donc par la RLS, comme le reste de l'espace équipe de
 * l'application : les indicateurs comptent ce que le rôle connecté peut voir. Le journal est lu par la fonction
 * `fn_lister_audit` (même fonction que le site), qui exige un rôle système.
 */

/** Nombre d'entrées renvoyées à l'application : protège le téléphone d'un journal démesuré. */
const LIMITE_JOURNAL_EQUIPE = 200;

export interface EntreeJournalEquipe {
  id: string;
  /** Date et heure de l'action (ISO 8601). */
  horodatage: string;
  /** Code de l'action (`restaurant.approbation`, …). */
  action: string;
  /** Libellé lisible de l'action. */
  libelle: string;
  /** E-mail de l'auteur ; `null` si l'auteur n'est plus identifiable. */
  acteurEmail: string | null;
  /** Libellé de l'auteur, toujours lisible (« acteur inconnu » si l'auteur est inconnu). */
  auteur: string;
  /** Type de cible brut (`restaurant`, `commande`, …). */
  cibleType: string;
  /** Identifiant de la cible. */
  cibleId: string;
  /** Cible affichée : « Restaurant a1b2c3d4 ». */
  cible: string;
  /** Adresse de la cible sur le site ; `null` si le type de cible n'est pas connu. */
  cibleUrl: string | null;
  /** Motif écrit par l'auteur ; `null` si l'action n'en demande pas. */
  motif: string | null;
}

export interface IndicateurAuditEquipe {
  cle: string;
  libelle: string;
  definition: string;
  valeur: number;
}

export interface ActionAuditEquipe {
  code: string;
  libelle: string;
}

/** Une période proposée par le filtre : `valeur` nulle = tout l'historique. */
export interface PeriodeAuditEquipe {
  valeur: number | null;
  libelle: string;
}

export interface ResultatAuditEquipe {
  indicateurs: IndicateurAuditEquipe[];
  /** Types d'action proposés par le filtre, avec leur libellé (le catalogue vit côté serveur). */
  actions: ActionAuditEquipe[];
  /** Périodes proposées par le filtre (le site les définit : l'application ne les invente pas). */
  periodes: PeriodeAuditEquipe[];
  journal: EntreeJournalEquipe[];
  /** Vrai si le journal est plus long que la limite renvoyée : la liste affichée est alors incomplète. */
  tronque: boolean;
}

interface LigneAudit {
  id: string;
  acteur_email: string | null;
  action: string;
  cible_type: string;
  cible_id: string;
  motif: string | null;
  horodatage: string;
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Journal d'audit filtré et indicateurs, lus avec le client lié au jeton. La permission `systeme.audit` est vérifiée
 * par la route (`equipeAuthentifiee`) ; ici on ne fait que lire.
 */
export async function lireAuditEquipe(
  contexte: ContexteEquipeApi,
  filtres: { action?: string; depuisJours?: number }
): Promise<ResultatAuditEquipe> {
  const maintenant = Date.now();
  const depuis = filtres.depuisJours ? new Date(maintenant - filtres.depuisJours * MS_PAR_JOUR).toISOString() : undefined;

  // On demande une entrée de plus que la limite : si elle arrive, c'est que la liste est tronquée.
  const { data, error } = await contexte.supabase.rpc("fn_lister_audit", {
    p_action: filtres.action || undefined,
    p_depuis: depuis,
    p_limite: LIMITE_JOURNAL_EQUIPE + 1,
  });

  if (error || !data) {
    throw new Error("Journal d'audit illisible.");
  }

  const lignes = (data as LigneAudit[]) ?? [];
  const tronque = lignes.length > LIMITE_JOURNAL_EQUIPE;
  const journal = lignes.slice(0, LIMITE_JOURNAL_EQUIPE).map((ligne) => ({
    id: ligne.id,
    horodatage: ligne.horodatage,
    action: ligne.action,
    libelle: LIBELLES_ACTIONS_AUDIT[ligne.action] ?? ligne.action,
    acteurEmail: ligne.acteur_email,
    auteur: libelleAuteurJournalAudit(ligne.acteur_email),
    cibleType: ligne.cible_type,
    cibleId: ligne.cible_id,
    cible: texteCibleJournalAudit(ligne.cible_type, ligne.cible_id),
    cibleUrl: cheminCibleJournalAudit(ligne.cible_type, ligne.cible_id),
    motif: ligne.motif,
  }));

  const indicateurs = await lireIndicateursAudit(contexte, maintenant);

  return {
    indicateurs,
    actions: ACTIONS_AUDIT_CONNUES.map((code) => ({ code, libelle: LIBELLES_ACTIONS_AUDIT[code] })),
    periodes: PERIODES_JOURNAL_AUDIT.map((periode) => ({ valeur: periode.valeur ?? null, libelle: periode.libelle })),
    journal,
    tronque,
  };
}

/**
 * Les quatre indicateurs du site, lus avec le client lié au jeton (donc avec la RLS du rôle connecté). Un compteur
 * indisponible vaut zéro plutôt qu'une absence : l'indicateur reste lisible, l'équipe voit qu'il est à zéro.
 */
async function lireIndicateursAudit(contexte: ContexteEquipeApi, maintenant: number): Promise<IndicateurAuditEquipe[]> {
  const [restaurantsEnAttente, restaurantsSuspendus, commandesActives, revelationsCoordonnees7j] = await Promise.all([
    contexte.supabase
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("publie", false)
      .is("suspendu_le", null)
      .is("motif_correction", null),
    contexte.supabase.from("restaurants").select("id", { count: "exact", head: true }).not("suspendu_le", "is", null),
    // Fonction réservée au support (plus d'accès direct à `orders`) : 0 pour les autres rôles.
    contexte.supabase.rpc("fn_support_compter_commandes", { p_statuts: ["en_attente", "acceptee", "prete"] }),
    contexte.supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "coordonnees.revelation")
      .gte("horodatage", new Date(maintenant - 7 * MS_PAR_JOUR).toISOString()),
  ]);

  const valeurs: Record<string, number> = {
    restaurants_en_attente: restaurantsEnAttente.count ?? 0,
    restaurants_suspendus: restaurantsSuspendus.count ?? 0,
    commandes_actives: typeof commandesActives.data === "number" ? commandesActives.data : 0,
    revelations_coordonnees_7j: revelationsCoordonnees7j.count ?? 0,
  };

  return INDICATEURS_AUDIT.map((indicateur) => ({
    cle: indicateur.cle,
    libelle: indicateur.libelle,
    definition: indicateur.definition,
    valeur: valeurs[indicateur.cle] ?? 0,
  }));
}

/** Le libellé lisible d'un type de cible, réutilisé par l'application. */
export { libelleCibleJournalAudit };
