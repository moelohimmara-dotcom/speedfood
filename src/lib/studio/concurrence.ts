/**
 * Jeton de concurrence du brouillon d'une page à blocs (palier 3, tâche 7, revue I1). Module PUR.
 *
 * Le jeton est l'horodatage `mis_a_jour_le` de la page, lu à l'ouverture de l'éditeur et renvoyé à chaque
 * enregistrement ou publication. Si la page a été modifiée entre-temps (autre onglet, autre personne de l'équipe), le
 * jeton ne correspond plus : l'écriture est refusée sans rien écraser. Pour l'enregistrement, la comparaison se fait
 * DANS la requête de mise à jour (atomique) ; cette fonction sert à la publication (lecture puis jeton de la fonction
 * SQL) et fixe la règle pour les deux.
 */
export const MESSAGE_CONCURRENCE =
  "Le brouillon a été modifié ailleurs depuis que vous avez ouvert la page. Rechargez pour voir la dernière version avant d'enregistrer.";

/**
 * Vrai si le jeton reçu est périmé. Jeton absent (`undefined`) : appel sans contrôle, accepté (rétro-compatibilité des
 * appels existants ; l'éditeur, lui, l'envoie toujours). Jeton présent mais de mauvais type : périmé. Égal : à jour.
 */
export function jetonPerime(recu: unknown, courant: string | null | undefined): boolean {
  if (recu === undefined) return false;
  if (typeof recu !== "string" || recu.length === 0 || recu.length > 64) return true;
  return recu !== courant;
}
