import "server-only";
import { after } from "next/server";
import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type { CreationCommandePayload, ResultatCreationCommande } from "@/lib/contracts/commande";
import { limiterCreationCommande } from "@/lib/securite/limitation-debit";
import { verifierAntiRobot } from "@/lib/securite/turnstile";
import { cleDeTableValide } from "@/lib/table/cle";
import { notifierRestaurant } from "@/lib/push/envoi";
import { creerCommande } from "./creation";

/**
 * Création d'une commande, du contrôle anti-robot à l'alerte du restaurant : UN seul chemin pour le site (action serveur) et l'application
 * (`/api/v1/commandes`). Les payloads sont déjà validés (`validerCreationCommande`) et l'identité déjà établie par l'appelant ; tous les montants sont
 * recalculés côté serveur par `creerCommande`.
 *
 * `antiRobot` : le site passe `true` (jeton Turnstile du navigateur, si la vérification est active). L'application native passe `false` : elle ne peut pas
 * produire ce jeton, mais elle n'accepte que des comptes identifiés (jeton porteur vérifié) et reste soumise aux mêmes plafonds de débit.
 */
export async function executerCreationCommande(
  valeurs: CreationCommandePayload,
  utilisateurId: string | null,
  options: { antiRobot: boolean }
): Promise<ResultatCreationCommande> {
  try {
    // Anti-robot d'abord (si actif) : un jeton invalide ne consomme aucun plafond.
    if (options.antiRobot) await verifierAntiRobot(valeurs.jetonVerification);
    // Commande à table avec la clé du QR de la table : plafond d'adresse large (salle pleine derrière un seul Wi-Fi) et plafond par table.
    const tableVerifiee = valeurs.mode === "sur_place" && cleDeTableValide(valeurs.restaurantId, valeurs.table, valeurs.cleTable) ? valeurs.table : null;
    await limiterCreationCommande(valeurs.restaurantId, valeurs.client.telephone, { table: tableVerifiee });
    const cree = await creerCommande(valeurs, utilisateurId);
    if (!cree.idempotent) {
      // Alerte « page fermée » du restaurant : après la réponse au client, sans jamais la retarder ni la faire échouer.
      const restaurantId = valeurs.restaurantId;
      after(async () => {
        try {
          await notifierRestaurant(restaurantId);
        } catch {
          console.error("push_indisponible");
        }
      });
    }
    return { ok: true, reference: cree.reference, jeton: cree.jeton, idempotent: cree.idempotent };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    const inattendue: ErreurApi = { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." };
    return { ok: false, erreur: inattendue };
  }
}
