// Le nom du mode de commande tel que le client le lit. Même règle, mêmes mots que le site : copie de `libelleModeClient` de
// packages/shared/src/commande/mode.ts (l'appli n'importe pas le paquet partagé). Le test tests/libelle-mode.test.ts compare les deux.
// Les valeurs échangées avec le serveur ne changent pas (`livraison`, `retrait`, `sur_place`) : « À emporter » n'est que l'affichage de `retrait`.
export function libelleModeClient(mode: string, table?: string | null): string {
  if (mode === 'livraison') return 'Livraison';
  if (mode === 'sur_place') {
    const numero = typeof table === 'string' ? table.trim() : '';
    return numero ? 'Sur place · table ' + numero : 'Sur place';
  }
  return 'À emporter';
}
