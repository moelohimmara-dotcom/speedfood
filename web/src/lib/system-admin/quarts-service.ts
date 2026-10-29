import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import type { ContexteSysteme } from "./contexte";
import {
  DELAI_RELANCE_MINUTES_PAR_DEFAUT,
  PERIMETRE_AFFECTATION_PAR_DEFAUT,
  ROLES_EQUIPE,
  commandesNonReprises,
  minutesDepuis,
  trierParUrgence,
  type CommandeQuart,
  type EtablissementQuart,
  type OperateurQuart,
  type PerimetreAffectation,
} from "./quarts-regles";

/**
 * Lecture des quarts (lot L2) : qui tient quel établissement, et quelles commandes attendent.
 *
 * Lecture avec le client clé service-role (comme la page voisine `/system/repartition`) : la
 * permission a déjà été vérifiée par la page ou l'action serveur, et le serveur est la seule
 * source d'autorité. Aucune écriture ici : les mutations passent par `fn_quarts_prendre` et
 * `fn_quarts_liberer` (fonctions réservées), jamais par un insert direct.
 *
 * Toutes les lectures sont bornées (plafonds ci-dessous) : aucune requête sans borne.
 */

/** Statuts de commande encore en cours : ce sont les seules commandes qui attendent un opérateur. */
const STATUTS_ACTIFS = ["en_attente", "acceptee", "prete"];

const LIMITE_ETABLISSEMENTS = 200;
const LIMITE_COMMANDES = 200;
const LIMITE_OPERATEURS = 50;
const LIMITE_RELANCES = 200;

/** Une commande qui attend, avec son ancienneté et sa dernière relance connue. */
export interface AlerteRelance {
  commande: CommandeQuart;
  /** Minutes écoulées depuis la création de la commande. */
  minutesAttente: number;
  /** Horodatage de la dernière relance tracée dans le journal d'audit, si la commande a déjà été relancée. */
  derniereRelance: string | null;
}

/** Ce que l'écran `/system/quarts` affiche. */
export interface VueQuarts {
  /** Tous les établissements tenus par l'équipe, avec leur titulaire éventuel. */
  etablissements: EtablissementQuart[];
  /** File « à moi » : les établissements dont je suis le titulaire. */
  moi: EtablissementQuart[];
  /** File « non pris » : les établissements que personne ne tient. */
  nonPris: EtablissementQuart[];
  /** Établissements tenus par un autre membre de l'équipe. */
  autres: EtablissementQuart[];
  /** Commandes qui attendent depuis plus longtemps que le délai de relance, sur un établissement non pris. */
  alertes: AlerteRelance[];
  /** Membres de l'équipe susceptibles de tenir un établissement. */
  operateurs: OperateurQuart[];
  /** Barème appliqué : délai de relance en minutes. */
  delaiMinutes: number;
  /** Périmètre d'affectation appliqué. */
  perimetre: PerimetreAffectation;
}

/**
 * Client non typé pour la table `affectations_operateurs` : la table est nouvelle, son type n'est
 * pas encore dans `src/lib/db/database.types.ts` (fichier généré, hors périmètre de ce lot).
 * Un client typé serait refusé par TypeScript sur un nom de table inconnu.
 */
function clientAffectations(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

/** Charge l'écran des quarts pour l'opérateur connecté. */
export async function chargerVueQuarts(contexte: ContexteSysteme): Promise<VueQuarts> {
  const admin = creerClientAdmin();
  const maintenant = new Date();

  // D'abord les établissements de l'équipe : les commandes sont lues SUR CEUX-LÀ (une commande d'un
  // restaurant autonome n'appartient pas aux quarts de l'équipe, et une lecture globale risquerait
  // de laisser passer des commandes d'autres restaurants).
  const { data: etablissementsBruts } = await admin
    .from("restaurants")
    .select("id, nom")
    .eq("mode_vente", "speedfood")
    .order("nom", { ascending: true })
    .limit(LIMITE_ETABLISSEMENTS);

  const nomParEtablissement = new Map<string, string>();
  for (const etablissement of etablissementsBruts ?? []) {
    nomParEtablissement.set(etablissement.id, etablissement.nom);
  }
  const idsEtablissements = [...nomParEtablissement.keys()];

  const [affectationsBrutes, commandesBrutes, membershipsBruts] = await Promise.all([
    clientAffectations()
      .from("affectations_operateurs")
      .select("restaurant_id, operateur_id, prise_le")
      .is("libere_le", null)
      .limit(LIMITE_ETABLISSEMENTS),
    idsEtablissements.length === 0
      ? Promise.resolve({ data: [] as { id: string; reference: string; restaurant_id: string; statut: string; mode: string; cree_le: string }[] })
      : admin
          .from("orders")
          .select("id, reference, restaurant_id, statut, mode, cree_le")
          .in("restaurant_id", idsEtablissements)
          .in("statut", STATUTS_ACTIFS)
          .eq("est_test", false)
          .order("cree_le", { ascending: true })
          .limit(LIMITE_COMMANDES),
    admin
      .from("system_admin_memberships")
      .select("utilisateur_id, role")
      .in("role", [...ROLES_EQUIPE])
      .limit(LIMITE_OPERATEURS),
  ]);

  // Titulaire actif par établissement (la base garantit qu'il n'y en a qu'un).
  const titulaireParEtablissement = new Map<string, { operateurId: string; priseLe: string }>();
  for (const affectation of (affectationsBrutes.data ?? []) as {
    restaurant_id: string;
    operateur_id: string;
    prise_le: string;
  }[]) {
    titulaireParEtablissement.set(affectation.restaurant_id, {
      operateurId: affectation.operateur_id,
      priseLe: affectation.prise_le,
    });
  }

  // Commandes des établissements de l'équipe uniquement (une commande d'un restaurant autonome
  // n'appartient pas aux quarts de l'équipe).
  const commandes: CommandeQuart[] = [];
  for (const commande of commandesBrutes.data ?? []) {
    if (!nomParEtablissement.has(commande.restaurant_id)) continue;
    commandes.push({
      id: commande.id,
      reference: commande.reference,
      restaurantId: commande.restaurant_id,
      restaurantNom: nomParEtablissement.get(commande.restaurant_id) ?? "",
      statut: commande.statut,
      modeCommande: commande.mode,
      creeLe: commande.cree_le,
    });
  }

  const operateurs = await lireOperateurs(admin, membershipsBruts.data ?? []);
  const emailParOperateur = new Map(operateurs.map((o) => [o.utilisateurId, o.email]));

  const etablissements: EtablissementQuart[] = [];
  for (const [restaurantId, nom] of nomParEtablissement) {
    const titulaire = titulaireParEtablissement.get(restaurantId);
    etablissements.push({
      id: restaurantId,
      nom,
      titulaireId: titulaire?.operateurId ?? null,
      titulaireEmail: titulaire ? emailParOperateur.get(titulaire.operateurId) ?? null : null,
      priseLe: titulaire?.priseLe ?? null,
      nonPris: !titulaire,
      commandes: trierParUrgence(
        commandes.filter((c) => c.restaurantId === restaurantId),
        maintenant
      ),
    });
  }

  const moi = etablissements.filter((e) => e.titulaireId === contexte.utilisateurId);
  const nonPris = etablissements.filter((e) => e.nonPris);
  const autres = etablissements.filter((e) => e.titulaireId !== null && e.titulaireId !== contexte.utilisateurId);

  // Une commande est « non reprise » quand son établissement n'est tenu par personne ET qu'elle
  // attend depuis au moins le délai de relance.
  const idsNonPris = new Set(nonPris.map((e) => e.id));
  const candidates = commandes.filter((c) => idsNonPris.has(c.restaurantId));
  const nonReprises = commandesNonReprises(candidates, maintenant, DELAI_RELANCE_MINUTES_PAR_DEFAUT);

  const relances = await lireRelances(admin, nonReprises.map((c) => c.id));
  const alertes: AlerteRelance[] = nonReprises.map((commande) => ({
    commande,
    minutesAttente: minutesDepuis(commande.creeLe, maintenant),
    derniereRelance: relances.get(commande.id) ?? null,
  }));

  return {
    etablissements,
    moi,
    nonPris,
    autres,
    alertes,
    operateurs,
    delaiMinutes: DELAI_RELANCE_MINUTES_PAR_DEFAUT,
    perimetre: PERIMETRE_AFFECTATION_PAR_DEFAUT,
  };
}

/** Les membres de l'équipe, avec leur e-mail (jamais celui d'un client). */
export async function lireOperateursEquipe(): Promise<OperateurQuart[]> {
  const admin = creerClientAdmin();
  const { data } = await admin
    .from("system_admin_memberships")
    .select("utilisateur_id, role")
    .in("role", [...ROLES_EQUIPE])
    .limit(LIMITE_OPERATEURS);
  return lireOperateurs(admin, data ?? []);
}

/** Les membres de l'équipe, avec leur e-mail (jamais celui d'un client). */
async function lireOperateurs(
  admin: ReturnType<typeof creerClientAdmin>,
  memberships: { utilisateur_id: string; role: string }[]
): Promise<OperateurQuart[]> {
  const operateurs: OperateurQuart[] = [];
  for (const membership of memberships) {
    let email = "";
    try {
      const { data } = await admin.auth.admin.getUserById(membership.utilisateur_id);
      email = data.user?.email ?? "";
    } catch {
      email = "";
    }
    operateurs.push({
      utilisateurId: membership.utilisateur_id,
      email,
      role: membership.role,
    });
  }
  return operateurs.sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Les dernières relances tracées dans le journal d'audit : le journal EST l'historique des
 * relances, il n'y a pas de table supplémentaire à maintenir.
 */
async function lireRelances(
  admin: ReturnType<typeof creerClientAdmin>,
  commandeIds: string[]
): Promise<Map<string, string>> {
  const relances = new Map<string, string>();
  if (commandeIds.length === 0) return relances;
  const { data } = await admin
    .from("audit_events")
    .select("cible_id, horodatage")
    .eq("action", "quart.relance")
    .in("cible_id", commandeIds)
    .limit(LIMITE_RELANCES);
  for (const evenement of data ?? []) {
    const precedent = relances.get(evenement.cible_id);
    if (!precedent || evenement.horodatage > precedent) {
      relances.set(evenement.cible_id, evenement.horodatage);
    }
  }
  return relances;
}
