import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Retour commun des actions de la console qui n'ont rien à renvoyer d'autre qu'un échec éventuel (audit du 15 octobre 2026 : plusieurs actions
 * renvoyaient `void`, ignoraient l'erreur de la base et laissaient une exception non rattrapée devenir une page d'erreur générique).
 * Une `ErreurMetier` (droit, palier insuffisant) garde son message, rédigé pour l'utilisateur ; toute autre erreur reçoit le message par défaut.
 * Fichier SANS « use server » : un fichier « use server » ne peut exporter que des fonctions asynchrones.
 */
export interface RetourAction {
  erreur?: string;
}

export function erreurAction(erreur: unknown, messageParDefaut: string): RetourAction {
  return { erreur: erreur instanceof ErreurMetier ? erreur.message : messageParDefaut };
}
