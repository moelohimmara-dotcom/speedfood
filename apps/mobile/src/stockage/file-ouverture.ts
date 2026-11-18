/**
 * File d'attente d'ouvertures : `creerOuvreurEnSerie(ouvrir)` rend une fonction qui lance les ouvertures UNE À LA FOIS, dans l'ordre des appels. Un échec ne bloque pas l'ouverture suivante
 * et n'est rendu qu'à son propre appelant. Logique pure : testée sans le module natif de SQLite.
 */
export function creerOuvreurEnSerie<T>(ouvrir: (nom: string) => Promise<T>): (nom: string) => Promise<T> {
  let file: Promise<unknown> = Promise.resolve();
  return (nom: string) => {
    const ouverture = file.then(() => ouvrir(nom));
    file = ouverture.catch(() => undefined);
    return ouverture;
  };
}
