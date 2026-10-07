import "server-only";
import { headers } from "next/headers";
import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Vérification anti-robot Cloudflare Turnstile pour la création de commande
 * (revue de sécurité, point 9 : un script ne doit pas pouvoir saturer les plafonds
 * par téléphone ou par restaurant avec des commandes valides).
 *
 * Actif UNIQUEMENT si `TURNSTILE_SECRET_KEY` est défini (secret du Worker) ; la clé de
 * site publique correspondante est `TURNSTILE_SITE_KEY` (variable publique). Les deux
 * doivent être définies ensemble. Sans secret, la vérification est désactivée : c'est
 * le cas tant que Malika n'a pas créé le widget dans son tableau de bord Cloudflare.
 *
 * Documentation officielle : le jeton est valable cinq minutes et ne se valide qu'une
 * seule fois (`timeout-or-duplicate`) ; le formulaire redemande donc un jeton neuf après
 * chaque tentative. Échec fermé : si Cloudflare ne répond pas, la commande n'est pas
 * créée (message clair, le client réessaie).
 */

const URL_VERIFICATION = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const LONGUEUR_MAX_JETON = 2048;

const MESSAGE_REQUIS = "Confirmez que vous n'êtes pas un robot.";

export function verificationAntiRobotActive(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifierAntiRobot(jeton: string | undefined): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return;
  }
  if (!jeton || jeton.length > LONGUEUR_MAX_JETON) {
    throw new ErreurMetier("VALIDATION", MESSAGE_REQUIS, { verification: MESSAGE_REQUIS });
  }

  const corps = new URLSearchParams({ secret, response: jeton });
  const adresse = (await headers()).get("cf-connecting-ip");
  if (adresse) {
    corps.set("remoteip", adresse.trim());
  }

  let reussite = false;
  try {
    const reponse = await fetch(URL_VERIFICATION, {
      method: "POST",
      body: corps,
      signal: AbortSignal.timeout(5000),
    });
    const donnees = (await reponse.json()) as { success?: boolean };
    reussite = reponse.ok && donnees.success === true;
  } catch {
    // Cloudflare est injoignable DEPUIS LE SERVEUR (panne de leur côté, réseau de sortie).
    // À cet instant le client a pourtant produit un jeton : il a réellement résolu le défi,
    // ce qu'un robot ne ferait pas en omettant simplement le jeton — ce cas-là est refusé
    // plus haut. On peut donc laisser passer, en confiant la protection au seul garde-fou
    // restant : la limitation de débit en base, appelée juste avant dans `actions.ts`.
    //
    // Refuser ici (comme avant le 7 octobre 2026) transformerait une panne tierce en
    // indisponibilité totale du tunnel de commande. La trace `anti_robot_indisponible`
    // permet de voir si ce chemin devient fréquent ; il ne doit pas le devenir.
    console.error("anti_robot_indisponible");
    return;
  }

  if (!reussite) {
    throw new ErreurMetier(
      "VALIDATION",
      "La vérification anti-robot a échoué ou a expiré. Recommencez-la puis validez de nouveau.",
      { verification: "Vérification à refaire." }
    );
  }
}
