export interface EnvironnementAlerteSite {
  SITE_JETONS?: unknown;
}

/**
 * Alerte « nouvelle commande » (ADR-021) : l'API ne possède pas les secrets d'envoi (FCM, VAPID), elle demande au SITE d'envoyer par la liaison de service
 * `SITE_JETONS` (méthode RPC `alerter`), jamais par HTTP public : aucune adresse, aucun secret. Liaison lue à l'APPEL, jamais au chargement. Liaison absente ou non conforme :
 * ne fait RIEN (silencieux). Un échec ou un dépassement de délai ne se rejoue pas et n'écrit que le code fixe `alerte_site_echec` (jamais d'identifiant, d'adresse ni de message).
 * La garde `CREATION_COMMANDE_API` est déjà exigée par la création elle-même : une alerte n'existe que pour une commande nouvelle.
 */
export function fournirAlerteSite(lire: () => unknown, delaiMs = 8000): (restaurantId: string) => Promise<void> {
  return async (restaurantId) => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    try {
      const brut = lire();
      if (!brut || typeof brut !== "object") return;
      const liaison = (brut as EnvironnementAlerteSite).SITE_JETONS;
      if (!liaison || typeof liaison !== "object") return;
      // Les méthodes RPC sont dynamiques : ne pas exiger que l'opérateur `in` les énumère.
      if (typeof (liaison as { alerter?: unknown }).alerter !== "function") return;
      await Promise.race([
        Promise.resolve().then(() => (liaison as { alerter(id: string): unknown }).alerter(restaurantId)),
        new Promise<never>((_resoudre, refuser) => { minuterie = setTimeout(() => refuser(new Error()), delaiMs); }),
      ]);
    } catch {
      console.error("alerte_site_echec");
    } finally {
      if (minuterie !== undefined) clearTimeout(minuterie);
    }
  };
}
