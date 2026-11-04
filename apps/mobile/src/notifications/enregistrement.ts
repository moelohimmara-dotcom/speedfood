import { CHEMIN_APPAREILS_APP, CHEMIN_APPAREILS_RETRAIT_APP, VERSION_APP_LONGUEUR_MAX, jetonAppareilValide, type PlateformeAppareil } from '../../../../packages/shared/src/contracts/appareils.ts';

/**
 * Enregistrement de l'appareil auprès de l'API (lot E1) : UN SEUL essai par déclenchement, JAMAIS de réessai automatique. Le jeton d'appareil et le jeton porteur ne sont ni
 * affichés, ni journalisés, ni repris dans un résultat : les résultats sont d'un jeu fermé.
 *
 * - `sans_firebase` : échec LOCAL, rien n'est parti (pas de google-services.json dans la compilation, pas de services Google, jeton illisible ou mal formé, plateforme inconnue) ;
 * - `indisponible` : le réseau a échoué ou le délai est dépassé : la demande a pu partir ou non, on ne relance pas (le serveur nettoie les jetons morts, l'appli réenregistre à la prochaine ouverture) ;
 * - `refuse` : le serveur a répondu non ;
 * - `enregistre` : le serveur a répondu oui.
 */
export type ResultatAppareil = 'enregistre' | 'refuse' | 'indisponible' | 'sans_firebase';

export interface DepsAppareil {
  origine: string;
  fetcher: typeof fetch;
  /** `null` pour toute plateforme autre qu'android ou ios (web) : rien n'est envoyé. */
  plateforme: PlateformeAppareil | null;
  versionApp: string | null;
  /** Jeton NATIF de l'installation (Firebase) ; lève ou renvoie `null` si Firebase n'est pas configuré. */
  lireJeton(): Promise<string | null>;
  delaiMs?: number;
}

export interface Appareil {
  enregistrer(acces: string, jetonConnu?: string): Promise<ResultatAppareil>;
  retirer(acces: string): Promise<ResultatAppareil>;
}

function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('delai')), ms);
    promesse.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export function creerAppareil(d: DepsAppareil): Appareil {
  const delai = d.delaiMs ?? 15000;
  async function jeton(connu?: string): Promise<string | null> {
    try {
      const j = connu ?? await avecDelai(d.lireJeton(), delai);
      return jetonAppareilValide(j) ? j : null;
    } catch { return null; }
  }
  async function poster(chemin: string, acces: string, corps: Record<string, unknown>): Promise<ResultatAppareil> {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), delai);
    try {
      const r = await d.fetcher(d.origine + chemin, {
        method: 'POST', credentials: 'omit', signal: controle.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${acces}` },
        body: JSON.stringify(corps),
      });
      return r.ok ? 'enregistre' : 'refuse';
    } catch { return 'indisponible'; } finally { clearTimeout(minuterie); }
  }
  return {
    async enregistrer(acces, jetonConnu) {
      if (d.plateforme === null || !acces) return 'sans_firebase';
      const j = await jeton(jetonConnu);
      if (j === null) return 'sans_firebase';
      const corps: Record<string, unknown> = { jeton: j, plateforme: d.plateforme };
      if (d.versionApp) corps.versionApp = d.versionApp.slice(0, VERSION_APP_LONGUEUR_MAX);
      return poster(CHEMIN_APPAREILS_APP, acces, corps);
    },
    async retirer(acces) {
      if (d.plateforme === null || !acces) return 'sans_firebase';
      const j = await jeton();
      if (j === null) return 'sans_firebase';
      return poster(CHEMIN_APPAREILS_RETRAIT_APP, acces, { jeton: j });
    },
  };
}
