import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { regrouperIpv6 } from "./ip";
import { executerPipeline, type ConfigRedis } from "./redis-client";
import { cleCompteur, commandesLimites, decider, franchitSeuil, QUOTA_MENSUEL_PAR_DEFAUT } from "./redis-limites";

/**
 * Limitation de débit des actions publiques (PROCEDURE-SECURITE.md §7, ADR-011).
 *
 * Compteur à fenêtre fixe, sur Redis (Upstash, offre gratuite, s'il est configuré : un seul aller-retour pour toutes les limites d'une action) ou, sinon et
 * en cas de panne, dans la base (`fn_limiter_debit`, service-role uniquement) : fiable entre plusieurs isolats Workers.
 * Aucune IP ni aucun téléphone n'est stocké en clair : seule une empreinte HMAC
 * (clé serveur) sert de clé de compteur.
 *
 * Si le compteur lui-même est indisponible, on laisse passer (et on journalise
 * le nom de la règle, sans donnée personnelle) plutôt que de bloquer toutes les
 * commandes : la base est de toute façon nécessaire pour créer une commande.
 */

interface RegleLimite {
  nom: string;
  max: number;
  fenetreSecondes: number;
}

// Valeurs initiales à ajuster avec l'usage réel du pilote.
// Plafonds relevés le 19 octobre 2026 après simulation (docs/REVUE-2026-10-19.md §11) : derrière le Wi-Fi d'un restaurant ou le réseau mobile partagé
// (plusieurs clients, une seule adresse publique), 10 commandes par 10 min laissaient 30 convives sur 40 avec « Trop de demandes ». Les autres garde-fous
// restent : anti-robot, plafond par téléphone et plafond par restaurant.
export const LIMITE_COMMANDE_PAR_IP: RegleLimite = { nom: "commande-ip", max: 30, fenetreSecondes: 600 };
// Commande à table avec la clé du QR de la table (présence probable, voir src/lib/table/cle.ts) : plafond d'adresse large, plafond PAR TABLE strict.
export const LIMITE_COMMANDE_PAR_IP_TABLE: RegleLimite = { nom: "commande-ip-table", max: 60, fenetreSecondes: 600 };
export const LIMITE_COMMANDE_PAR_TABLE: RegleLimite = { nom: "commande-table", max: 15, fenetreSecondes: 600 };
export const LIMITE_COMMANDE_PAR_TELEPHONE: RegleLimite = {
  nom: "commande-tel",
  max: 5,
  fenetreSecondes: 3600,
};
// Protège la boîte de réception d'un restaurant contre une inondation venant de
// nombreuses adresses IP différentes.
export const LIMITE_COMMANDE_PAR_RESTAURANT: RegleLimite = {
  nom: "commande-resto",
  max: 60,
  fenetreSecondes: 600,
};
export const LIMITE_REPONSE_PROPOSITION_PAR_IP: RegleLimite = {
  nom: "proposition-ip",
  max: 30,
  fenetreSecondes: 600,
};
// Annulation d'une commande par son client : une personne annule rarement plus de quelques commandes par heure.
export const LIMITE_ANNULATION_CLIENT_PAR_IP: RegleLimite = {
  nom: "annulation-client-ip",
  max: 20,
  fenetreSecondes: 3600,
};

// Récupération de mot de passe : protège la boîte d'un tiers (par adresse) et le quota d'envoi
// d'e-mails du projet (par IP).
export const LIMITE_RECUPERATION_PAR_IP: RegleLimite = { nom: "recup-ip", max: 5, fenetreSecondes: 3600 };
export const LIMITE_RECUPERATION_PAR_EMAIL: RegleLimite = { nom: "recup-mail", max: 3, fenetreSecondes: 3600 };

// Essai de notification push depuis la console : une personne ne peut pas inonder ses propres appareils ni les services de push.
export const LIMITE_ESSAI_PUSH: RegleLimite = { nom: "essai-push", max: 3, fenetreSecondes: 300 };

// Envois de photos : un restaurant ne peut pas remplir le stockage (5 Mo par fichier) en boucle.
export const LIMITE_TELEVERSEMENT_PAR_RESTAURANT: RegleLimite = { nom: "televersement-resto", max: 30, fenetreSecondes: 3600 };

// Déclarations de paiement par le client (lien de suivi) : on ne peut pas inonder le restaurateur de fausses déclarations.
export const LIMITE_DECLARATION_PAIEMENT_PAR_IP: RegleLimite = { nom: "paiement-ip", max: 20, fenetreSecondes: 600 };
export const LIMITE_ECHANGE_SUIVI_PAR_IP: RegleLimite = { nom: "suivi-session-ip", max: 20, fenetreSecondes: 600 };

// « Utiliser ma position » : chaque appel sollicite le service OpenStreetMap, dont la politique d'usage interdit les rafales.
export const LIMITE_ZONE_POSITION_PAR_IP: RegleLimite = { nom: "zone-position-ip", max: 20, fenetreSecondes: 600 };

// Estimation des frais de livraison à la commande : un calcul par changement de destination, jamais en rafale.
export const LIMITE_ESTIMATION_LIVRAISON_PAR_IP: RegleLimite = { nom: "livraison-estimation-ip", max: 60, fenetreSecondes: 600 };

// Liste d'attente par zone : un contact est une donnée personnelle, on évite les inscriptions en rafale.
export const LIMITE_ZONE_ALERTE_PAR_IP: RegleLimite = { nom: "zone-alerte-ip", max: 5, fenetreSecondes: 3600 };

// « Chef IA » : chaque analyse consomme le quota Workers AI du PROJET (10 000
// neurons/jour sur l'offre gratuite), pas celui du restaurant. Sans ce
// limiteur, un seul restaurateur très bavard épuiserait la jauge de tous les
// autres — un budget partagé doit être protégé du même geste que les autres
// ressources rares (téléversements, tentatives de connexion).
export const LIMITE_CHEF_IA_PAR_RESTAURANT: RegleLimite = { nom: "chef-ia-resto", max: 20, fenetreSecondes: 3600 };

// Même budget partagé, côté candidat : une personne qui prépare sa demande n'a pas encore de restaurant, donc le plafond est par COMPTE, par jour, et bas (une carte se photographie en une ou deux fois).
export const LIMITE_CHEF_IA_PAR_CANDIDAT: RegleLimite = { nom: "chef-ia-candidat", max: 6, fenetreSecondes: 86_400 };

// Demandes de partenariat : une personne réelle en envoie une ou deux ; le plafond protège la boîte de l'équipe et la base.
export const LIMITE_PARTENARIAT_PAR_IP: RegleLimite = { nom: "partenariat-ip", max: 3, fenetreSecondes: 3600 };

// Demandes de référencement : un restaurateur réel en envoie une ou deux ; le plafond protège la boîte de l'équipe et la base.
export const LIMITE_REFERENCEMENT_PAR_IP: RegleLimite = { nom: "referencement-ip", max: 3, fenetreSecondes: 3600 };

// Application livreur : relecture de l’état (toutes les 5 s), position (toutes les 5 à 8 s) et actions ; plafond PAR COMPTE (le compte vient du jeton vérifié).
export const LIMITE_LIVREUR_PAR_COMPTE: RegleLimite = { nom: "livreur-compte", max: 600, fenetreSecondes: 300 };

// Application restaurateur : relecture des commandes (toutes les quelques secondes) et actions ; plafond PAR COMPTE (le compte vient du jeton vérifié).
export const LIMITE_RESTAURANT_APP_PAR_COMPTE: RegleLimite = { nom: "restaurant-app-compte", max: 600, fenetreSecondes: 300 };

// Espace équipe Speedfood de l'application : même plafond que la console restaurateur (rafraîchissement toutes les 20 s + actions).
// Espace client de l'application (profil, adresses, favoris) : lectures à l'ouverture des écrans et quelques écritures.
export const LIMITE_CLIENT_APP_PAR_COMPTE: RegleLimite = { nom: "client-app-compte", max: 300, fenetreSecondes: 300 };

export const LIMITE_EQUIPE_APP_PAR_COMPTE: RegleLimite = { nom: "equipe-app-compte", max: 600, fenetreSecondes: 300 };

// Enregistrement et retrait de l'appareil pour les notifications poussées : quelques fois par jour suffisent (connexion, changement de jeton, déconnexion).
export const LIMITE_APPAREIL_PAR_COMPTE: RegleLimite = { nom: "appareil-compte", max: 30, fenetreSecondes: 3600 };

// Suivi d'une commande par l'application : elle relit le statut toutes les quelques secondes, par jeton ; le plafond protège la base sans gêner un client réel.
export const LIMITE_LECTURE_SUIVI_PAR_JETON: RegleLimite = { nom: "suivi-lecture-jeton", max: 120, fenetreSecondes: 300 };

const MESSAGE_TROP_DE_REQUETES =
  "Trop de demandes en peu de temps. Patientez quelques minutes puis réessayez.";

/**
 * Adresse du visiteur. `cf-connecting-ip` est posé par Cloudflare (non
 * falsifiable par le client une fois derrière Cloudflare) ; le repli sur
 * `x-forwarded-for` ne sert qu'en développement local.
 */
async function adresseClient(): Promise<string> {
  const entetes = await headers();
  const cloudflare = entetes.get("cf-connecting-ip");
  if (cloudflare) {
    return regrouperIpv6(cloudflare.trim());
  }
  const transmis = entetes.get("x-forwarded-for");
  if (transmis) {
    return regrouperIpv6(transmis.split(",")[0].trim());
  }
  return "inconnue";
}

function empreinte(valeur: string): string {
  const secret = process.env.COMMANDE_JETON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "COMMANDE_JETON_SECRET ou SUPABASE_SERVICE_ROLE_KEY doit être définie pour la limitation de débit."
    );
  }
  return createHmac("sha256", secret)
    .update(`speedfood-limite-v1:${valeur}`)
    .digest("base64url")
    .slice(0, 32);
}

type PaireLimite = readonly [RegleLimite, string];

/**
 * Redis (Upstash) : actif seulement si l'adresse et le jeton sont des secrets du Worker, et si `LIMITEUR_REDIS` n'est pas « non » (interrupteur de secours).
 * Sinon, ou en cas de panne, la limitation retombe sur la base, exactement comme avant : Redis n'est jamais indispensable.
 */
function configRedis(): ConfigRedis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const jeton = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !jeton || process.env.LIMITEUR_REDIS === "non") return null;
  return { url, jeton };
}

/** Prévient (journal du Worker) quand la consommation du mois franchit 70 % puis 90 % de l'offre gratuite. Une seule alerte par seuil. */
function surveillerQuota(consommationMois: number | null, commandesDuLot: number): void {
  if (consommationMois === null) return;
  const quota = Number(process.env.UPSTASH_QUOTA_MENSUEL) || QUOTA_MENSUEL_PAR_DEFAUT;
  for (const part of [0.7, 0.9]) {
    if (franchitSeuil(consommationMois, commandesDuLot, quota, part)) console.warn("redis_quota_atteint", Math.round(part * 100));
  }
}

/** Applique plusieurs limites d'un seul aller-retour (Redis), ou une par une (base) si Redis est absent ou en panne. Lève `TROP_DE_REQUETES`. */
async function appliquerLimites(paires: readonly PaireLimite[]): Promise<void> {
  if (paires.length === 0) return;
  const redis = configRedis();
  if (redis) {
    const limites = paires.map(([regle, identifiant]) => ({ cle: cleCompteur(regle.nom, empreinte(identifiant)), max: regle.max, fenetreSecondes: regle.fenetreSecondes }));
    const valeurs = await executerPipeline(redis, commandesLimites(limites, new Date()));
    const decision = valeurs ? decider(limites, valeurs) : null;
    if (decision) {
      surveillerQuota(decision.consommationMois, decision.commandesDuLot);
      if (!decision.autorise) throw new ErreurMetier("TROP_DE_REQUETES", MESSAGE_TROP_DE_REQUETES);
      return;
    }
    console.error("redis_indisponible_repli_base");
  }
  await Promise.all(paires.map(([regle, identifiant]) => appliquerLimiteBase(regle, identifiant)));
}

async function appliquerLimite(regle: RegleLimite, identifiant: string): Promise<void> {
  await appliquerLimites([[regle, identifiant]]);
}

async function appliquerLimiteBase(regle: RegleLimite, identifiant: string): Promise<void> {
  const { data, error } = await creerClientAdmin().rpc("fn_limiter_debit", {
    p_cle: `${regle.nom}:${empreinte(identifiant)}`,
    p_fenetre_secondes: regle.fenetreSecondes,
    p_max: regle.max,
  });

  if (error) {
    console.error("limitation_debit_indisponible", regle.nom);
    return;
  }
  if (data === false) {
    throw new ErreurMetier("TROP_DE_REQUETES", MESSAGE_TROP_DE_REQUETES);
  }
}

/** À appeler après validation du format et avant toute écriture. Lève `TROP_DE_REQUETES`. */
export async function limiterCreationCommande(
  restaurantId: string,
  telephone: string,
  options: { table?: string | null } = {}
): Promise<void> {
  const ip = await adresseClient();
  // `table` n'est renseignée que si la clé du QR de la table a été vérifiée : sinon, le plafond d'adresse ordinaire s'applique.
  const table = options.table ?? null;
  const paires: PaireLimite[] = [table ? [LIMITE_COMMANDE_PAR_IP_TABLE, ip] : [LIMITE_COMMANDE_PAR_IP, ip]];
  if (table) paires.push([LIMITE_COMMANDE_PAR_TABLE, `${restaurantId}:${table.toLowerCase()}`]);
  // Convive sans numéro (commande à table) : pas de plafond par téléphone, les plafonds par adresse et par restaurant restent.
  const chiffres = telephone.replace(/\D/g, "");
  if (chiffres !== "") paires.push([LIMITE_COMMANDE_PAR_TELEPHONE, chiffres]);
  paires.push([LIMITE_COMMANDE_PAR_RESTAURANT, restaurantId]);
  // Un seul aller-retour vers Redis pour toutes les limites (au lieu de trois ou quatre appels à la base).
  await appliquerLimites(paires);
}

export async function limiterRecuperationMotDePasse(email: string): Promise<void> {
  await appliquerLimites([
    [LIMITE_RECUPERATION_PAR_IP, await adresseClient()],
    [LIMITE_RECUPERATION_PAR_EMAIL, email.trim().toLowerCase()],
  ]);
}

export async function limiterTeleversement(restaurantId: string): Promise<void> {
  await appliquerLimite(LIMITE_TELEVERSEMENT_PAR_RESTAURANT, restaurantId);
}

export async function limiterChefIa(restaurantId: string): Promise<void> {
  await appliquerLimite(LIMITE_CHEF_IA_PAR_RESTAURANT, restaurantId);
}

export async function limiterChefIaCandidat(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_CHEF_IA_PAR_CANDIDAT, utilisateurId);
}

export async function limiterEssaiPush(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_ESSAI_PUSH, utilisateurId);
}

export async function limiterDeclarationPaiement(): Promise<void> {
  await appliquerLimite(LIMITE_DECLARATION_PAIEMENT_PAR_IP, await adresseClient());
}

export async function limiterEchangeSuivi(): Promise<void> {
  await appliquerLimite(LIMITE_ECHANGE_SUIVI_PAR_IP, await adresseClient());
}

export async function limiterReponseProposition(): Promise<void> {
  await appliquerLimite(LIMITE_REPONSE_PROPOSITION_PAR_IP, await adresseClient());
}

export async function limiterAnnulationClient(): Promise<void> {
  await appliquerLimite(LIMITE_ANNULATION_CLIENT_PAR_IP, await adresseClient());
}

export async function limiterZonePosition(): Promise<void> {
  await appliquerLimite(LIMITE_ZONE_POSITION_PAR_IP, await adresseClient());
}

export async function limiterEstimationLivraison(): Promise<void> {
  await appliquerLimite(LIMITE_ESTIMATION_LIVRAISON_PAR_IP, await adresseClient());
}

export async function limiterPartenariat(): Promise<void> {
  await appliquerLimite(LIMITE_PARTENARIAT_PAR_IP, await adresseClient());
}

export async function limiterReferencement(): Promise<void> {
  await appliquerLimite(LIMITE_REFERENCEMENT_PAR_IP, await adresseClient());
}

export async function limiterLivreur(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_LIVREUR_PAR_COMPTE, utilisateurId);
}

export async function limiterAppareil(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_APPAREIL_PAR_COMPTE, utilisateurId);
}

export async function limiterRestaurantApplication(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_RESTAURANT_APP_PAR_COMPTE, utilisateurId);
}

export async function limiterClientApplication(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_CLIENT_APP_PAR_COMPTE, utilisateurId);
}

export async function limiterEquipeApplication(utilisateurId: string): Promise<void> {
  await appliquerLimite(LIMITE_EQUIPE_APP_PAR_COMPTE, utilisateurId);
}

export async function limiterLectureSuivi(jeton: string): Promise<void> {
  await appliquerLimite(LIMITE_LECTURE_SUIVI_PAR_JETON, jeton);
}

export async function limiterZoneAlerte(): Promise<void> {
  await appliquerLimite(LIMITE_ZONE_ALERTE_PAR_IP, await adresseClient());
}

// Notes d'avis : quelques dizaines par heure suffisent largement à un client réel.
export const LIMITE_NOTATION_PAR_IP: RegleLimite = { nom: "notation-ip", max: 120, fenetreSecondes: 3600 };

export async function limiterNotation(): Promise<void> {
  await appliquerLimite(LIMITE_NOTATION_PAR_IP, await adresseClient());
}

// Aide au choix : une recherche par changement de budget ou de position, jamais en rafale.
export const LIMITE_AIDE_CHOIX_PAR_IP: RegleLimite = { nom: "aide-choix-ip", max: 40, fenetreSecondes: 600 };

export async function limiterAideChoix(): Promise<void> {
  await appliquerLimite(LIMITE_AIDE_CHOIX_PAR_IP, await adresseClient());
}

// Appels au serveur et demandes d'addition depuis une table : le délai par table est dans le service ; ce plafond limite le martèlement par adresse.
export const LIMITE_APPEL_TABLE_PAR_IP: RegleLimite = { nom: "appel-table-ip", max: 120, fenetreSecondes: 600 };

export async function limiterAppelTable(): Promise<void> {
  await appliquerLimite(LIMITE_APPEL_TABLE_PAR_IP, await adresseClient());
}
