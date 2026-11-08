import { enregistrerAppareil, retirerAppareil } from "@/lib/push/appareils";
import { limiterAppareil } from "@/lib/securite/limitation-debit";
import type { Deps } from "../types.ts";

/**
 * Câblage de PRODUCTION des appareils (lot E1) : les fonctions du site, jamais une copie de leurs règles (upsert sur le jeton, plafond de 10 appareils par compte, un jeton connu change de propriétaire).
 *
 * EXCEPTION documentée (même nature que le lot D5) : la table `appareils_push` n'a AUCUNE policy (migration 20261022170000), son écriture est réservée à la clé de service. `enregistrerAppareil` et
 * `retirerAppareil` l'utilisent donc, en interne, et ce fichier n'importe NI le client administrateur NI la clé : il ne branche que ces deux fonctions. Elles ne sont atteintes qu'APRÈS le jeton porteur strict,
 * le plafond par compte et la validation du corps (routes/appareils.ts) ; le compte passé est toujours celui du jeton. Épinglé par `tests/appareils-cablage-source.test.ts`.
 */
export const serviceAppareils: Deps["appareils"] = {
  limiter: limiterAppareil,
  enregistrer: (utilisateurId, jeton, plateforme, versionApp, sessionId) => enregistrerAppareil(utilisateurId, jeton, plateforme, versionApp, sessionId),
  retirer: (utilisateurId, jeton, sessionId) => retirerAppareil(utilisateurId, jeton, sessionId),
};
