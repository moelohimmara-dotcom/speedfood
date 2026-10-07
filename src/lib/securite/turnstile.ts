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
 * doivent être définies ensemble ; sans secret, la vérification est désactivée et seule la
 * limitation de débit protège.
 *
 * **État au 7 octobre 2026 : les deux clés sont présentes sur le Worker** (vérifié par l'API
 * Cloudflare — nom seul, la valeur d'un secret n'est jamais relisible). Les lignes suivantes
 * indiquaient que la vérification restait inactive « tant que Malika n'a pas créé le widget » :
 * c'était faux, le widget existe depuis le 5 octobre et la vérification est active.
 *
 * Documentation officielle : le jeton est valable cinq minutes et ne se valide qu'une
 * seule fois (`timeout-or-duplicate`) ; le formulaire redemande donc un jeton neuf après
 * chaque tentative. **Échec fermé, sans exception** : si Cloudflare ne répond pas, si le jeton
 * est absent, expiré ou refusé, la commande n'est pas créée. Arbitrage de la propriétaire le
 * 7 octobre 2026 : la sécurité passe avant la disponibilité — voir le bloc `catch` plus bas.
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
    // Échec fermé (décision de la propriétaire, 7 octobre 2026 : la sécurité passe avant la
    // disponibilité). Cloudflare est injoignable DEPUIS LE SERVEUR, donc rien ne prouve que le
    // jeton présenté est authentique : un appel direct au serveur peut présenter n'importe quelle
    // chaîne. Lettingtreur serait ouvrir une porte à un robot pendant toute la panne.
    //
    // Un repli a été écrit ici le 7 octobre 2026 (acceptation sous la seule limitation de débit)
    // puis retiré : c'était bien une concession de sécurité, faite en bonne foi mais contraire
    // à l'arbitrage. Si ce tunnel doit survivre à une panne de Cloudflare, il faudra une autre
    // preuve — un jeton signé vérifiable localement, pas une confiance dans le client.
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "La vérification anti-robot est indisponible. Réessayez dans un instant."
    );
  }

  if (!reussite) {
    throw new ErreurMetier(
      "VALIDATION",
      "La vérification anti-robot a échoué ou a expiré. Recommencez-la puis validez de nouveau.",
      { verification: "Vérification à refaire." }
    );
  }
}
