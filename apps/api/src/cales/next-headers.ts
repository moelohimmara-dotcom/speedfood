import { AsyncLocalStorage } from "node:async_hooks";

// Remplace `headers()` de `next/headers` dans l'API : le code de limitation de débit du site lit l'adresse du visiteur par cette fonction.
// La cale rend les en-têtes de la requête en cours (posés par le premier maillon de l'application), jamais ceux d'une autre requête.
export const entetesCourants = new AsyncLocalStorage<Headers>();

export async function headers(): Promise<Headers> {
  const courants = entetesCourants.getStore();
  if (!courants) throw new Error("headers() appelé hors requête");
  return courants;
}
