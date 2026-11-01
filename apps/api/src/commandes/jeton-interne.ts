import { cleIdempotenceValide } from "../../../web/src/lib/commande/jetons-calcul.ts";

export interface EnvironnementJetonInterne {
  CREATION_COMMANDE_API?: string;
  SITE_JETONS?: unknown;
}

/** Un seul appel RPC. Une erreur ne permet JAMAIS un calcul local de repli. */
export function fournirJetonInterne(lire: () => unknown, delaiMs = 3000): (cle: string) => Promise<string> {
  return async (cle) => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    try {
      const brut = lire();
      if (!brut || typeof brut !== "object") throw new Error();
      const env = brut as EnvironnementJetonInterne;
      const liaison = env.SITE_JETONS;
      if (env.CREATION_COMMANDE_API !== "oui" || !cleIdempotenceValide(cle) || !liaison || typeof liaison !== "object") throw new Error();
      // Les méthodes RPC sont dynamiques : ne pas exiger que l'opérateur `in` les énumère.
      const deriver = (liaison as { deriver?: unknown }).deriver;
      if (typeof deriver !== "function") throw new Error();
      const jeton = await Promise.race([
        Promise.resolve().then(() => (liaison as { deriver(cle: string): unknown }).deriver(cle)),
        new Promise<never>((_resoudre, refuser) => { minuterie = setTimeout(() => refuser(new Error()), delaiMs); }),
      ]);
      if (typeof jeton !== "string" || !/^[A-Za-z0-9_-]{40}$/.test(jeton)) throw new Error();
      return jeton;
    } catch {
      throw new Error("calcul_jeton_indisponible");
    } finally {
      if (minuterie !== undefined) clearTimeout(minuterie);
    }
  };
}
