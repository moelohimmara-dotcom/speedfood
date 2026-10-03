import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { regrouperIpv6 } from "./ip";

/**
 * Limitation de débit des actions publiques (PROCEDURE-SECURITE.md §7, ADR-011).
 *
 * Compteur à fenêtre fixe dans la base (`fn_limiter_debit`, service-role
 * uniquement) : fiable entre plusieurs isolats Workers, sans service externe.
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
export const LIMITE_COMMANDE_PAR_IP: RegleLimite = { nom: "commande-ip", max: 10, fenetreSecondes: 600 };
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

// Récupération de mot de passe : protège la boîte d'un tiers (par adresse) et le quota d'envoi
// d'e-mails du projet (par IP).
export const LIMITE_RECUPERATION_PAR_IP: RegleLimite = { nom: "recup-ip", max: 5, fenetreSecondes: 3600 };
export const LIMITE_RECUPERATION_PAR_EMAIL: RegleLimite = { nom: "recup-mail", max: 3, fenetreSecondes: 3600 };

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

async function appliquerLimite(regle: RegleLimite, identifiant: string): Promise<void> {
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
export async function limiterCreationCommande(restaurantId: string, telephone: string): Promise<void> {
  const ip = await adresseClient();
  await Promise.all([
    appliquerLimite(LIMITE_COMMANDE_PAR_IP, ip),
    appliquerLimite(LIMITE_COMMANDE_PAR_TELEPHONE, telephone.replace(/\D/g, "")),
    appliquerLimite(LIMITE_COMMANDE_PAR_RESTAURANT, restaurantId),
  ]);
}

export async function limiterRecuperationMotDePasse(email: string): Promise<void> {
  await Promise.all([
    appliquerLimite(LIMITE_RECUPERATION_PAR_IP, await adresseClient()),
    appliquerLimite(LIMITE_RECUPERATION_PAR_EMAIL, email.trim().toLowerCase()),
  ]);
}

export async function limiterReponseProposition(): Promise<void> {
  await appliquerLimite(LIMITE_REPONSE_PROPOSITION_PAR_IP, await adresseClient());
}
