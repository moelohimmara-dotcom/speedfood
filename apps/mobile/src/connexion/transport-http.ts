/** Seules les requêtes exigeant le refus des redirections changent de transport.
 * Aucun repli : une erreur peut suivre une écriture déjà appliquée côté serveur. */
export function creerTransportHttp(ordinaire: typeof fetch, protege: typeof fetch): typeof fetch {
  return (input, init) => init?.redirect === 'error' ? protege(input, init) : ordinaire(input, init);
}
