/**
 * Client minimal pour Upstash Redis (API REST, sans dépendance) : une seule requête HTTP « pipeline » envoie plusieurs commandes d'un coup.
 *
 * Aucune clé ni donnée personnelle n'est écrite ici : l'appelant fournit l'adresse et le jeton (secrets du Worker), jamais l'application mobile.
 * Toute panne (réseau, délai dépassé, réponse inattendue, une commande en erreur) renvoie `null` : l'appelant retombe sur son repli (la base). Redis n'est
 * JAMAIS la source de vérité ; il ne doit jamais bloquer une commande.
 */

export type CommandeRedis = (string | number)[];

export interface ConfigRedis {
  /** Adresse REST de la base Upstash (secret `UPSTASH_REDIS_REST_URL`). */
  url: string;
  /** Jeton REST (secret `UPSTASH_REDIS_REST_TOKEN`). */
  jeton: string;
  /** Délai maximum d'attente, en millisecondes. 500 par défaut : au-delà, le repli sur la base est plus rapide qu'attendre. */
  delaiMs?: number;
  /** Fonction d'envoi (injectable pour les tests). */
  envoyer?: typeof fetch;
}

export const DELAI_REDIS_PAR_DEFAUT_MS = 500;

/**
 * Envoie les commandes dans l'ordre et renvoie la valeur de chacune, ou `null` si quoi que ce soit se passe mal.
 * Une réponse « erreur » pour une seule commande invalide tout le lot : on ne devine jamais un résultat partiel.
 */
export async function executerPipeline(config: ConfigRedis, commandes: readonly CommandeRedis[]): Promise<unknown[] | null> {
  if (commandes.length === 0) return [];
  const envoyer = config.envoyer ?? fetch;
  // Minuteur explicite (et nettoyé à la fin) plutôt que `AbortSignal.timeout` : il garde le processus en vie jusqu'à l'échéance, y compris dans les tests.
  const coupure = new AbortController();
  const minuteur = setTimeout(() => coupure.abort(), config.delaiMs ?? DELAI_REDIS_PAR_DEFAUT_MS);
  try {
    const reponse = await envoyer(`${config.url.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify(commandes),
      signal: coupure.signal,
    });
    if (!reponse.ok) return null;
    const corps: unknown = await reponse.json();
    if (!Array.isArray(corps) || corps.length !== commandes.length) return null;
    const valeurs: unknown[] = [];
    for (const element of corps) {
      if (typeof element !== "object" || element === null || "error" in element) return null;
      valeurs.push((element as { result?: unknown }).result ?? null);
    }
    return valeurs;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}
