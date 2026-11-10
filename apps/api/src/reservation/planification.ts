import type { Planifier } from "../types.ts";

/**
 * Planifie une notification « après la réponse » (sur Workers, `ctx.waitUntil`). Appelée APRÈS une écriture réussie : rien de ce qui se passe ici ne doit changer la réponse déjà décidée.
 * Sans planificateur ou sans tâche (anciens appels, tests, port non câblé) : ne fait rien. Un planificateur qui lève (requête sans contexte d'exécution), ou une tâche qui échoue : absorbé.
 */
export function planifier(apres: Planifier | undefined, tache: (() => Promise<void>) | undefined): void {
  if (!apres || !tache) return;
  try {
    apres(async () => {
      try { await tache(); } catch { /* meilleur effort : la notification n'est jamais une raison d'échouer */ }
    });
  } catch { /* pas de contexte d'exécution : rien à planifier */ }
}
