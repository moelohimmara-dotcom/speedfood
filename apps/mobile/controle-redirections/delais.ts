import { creerAuth } from '../src/connexion/client';
import { creerControleEtatLivreur, type EtatControleLivreur } from '../src/connexion/controle-etat-livreur';
import { fetchHttp } from '../src/connexion/http-natif';

const LOCAL = 'http://127.0.0.1:8796';
const PORTEUR = 'controle-delais-factice';
type Mode = 'rapide' | 'entetes' | 'corps';
interface Compteurs { journal: { mode: Mode; entetesMs: number | null; morceaux: number; annule: boolean; finTentativeMs: number | null }[] }
async function local(chemin: string, corps?: object) {
  const r = await fetchHttp(LOCAL + chemin, { method: 'POST', redirect: 'error', credentials: 'omit', headers: { Authorization: 'Bearer ' + PORTEUR, 'Content-Type': 'application/json' }, body: JSON.stringify(corps ?? {}) });
  if (!r.ok) throw new Error('BANC_REFUSE');
}
async function compteurs(): Promise<Compteurs> { const r = await fetchHttp(LOCAL + '/__etat'); if (!r.ok) throw new Error('BANC_INDISPONIBLE'); return await r.json(); }
const lu = (e: EtatControleLivreur | undefined) => e?.etat === 'lu' ? e : null;

/** Vraies 20 secondes, vrai client et vrai contrôleur ; aucun coffre ni API réelle. */
export async function verifierDelais(signaler: (lignes: string[]) => void) {
  await local('/__reset'); const bilan: string[] = [];
  for (const mode of ['rapide', 'entetes', 'corps'] as const) {
    await local('/__scenario?mode=' + mode);
    let envois = 0; let debut = 0; let entetesMs: number | null = null; let abandonMs: number | null = null;
    const api = creerAuth(((input: string, init?: RequestInit) => {
      const chemin = new URL(String(input)).pathname;
      if (!['/api/v1/livreur/etat', '/api/v1/livreur/course'].includes(chemin) || new Headers(init?.headers).get('Authorization') !== 'Bearer ' + PORTEUR) throw new Error('APPEL_NON_FACTICE_REFUSE');
      if (chemin.endsWith('/course')) {
        envois++; init?.signal?.addEventListener('abort', () => { abandonMs = Math.round(performance.now() - debut); }, { once: true });
        return fetchHttp(LOCAL + chemin, init).then(r => { entetesMs = Math.round(performance.now() - debut); return r; });
      }
      return fetchHttp(LOCAL + chemin, init);
    }) as typeof fetch);
    const publications: EtatControleLivreur[] = [];
    const controle = creerControleEtatLivreur({ generationNotifications: 1, etatLivreur: () => api.etatLivreur(PORTEUR), avancerCourseLivreur: d => api.avancerCourseLivreur(PORTEUR, d), basculerEnLigneLivreur: async () => { throw new Error('NON_PREVU'); }, repondreOffreLivreur: async () => { throw new Error('NON_PREVU'); } }, e => publications.push(e));
    try {
      await controle.actualiser();
      if (!lu(publications.at(-1))?.etatLivreur?.course) throw new Error('COURSE_FACTICE_ABSENTE');
      signaler([...bilan, mode + ' : envoi unique en cours…']);
      debut = performance.now(); await controle.avancerCourse('recuperee');
      const tempsMs = Math.round(performance.now() - debut);
      const incertain = lu(publications.at(-1))?.incertain === true;
      let verrouSansRejeu = false; let stableApresRetard = false;
      if (mode !== 'rapide') {
        await controle.avancerCourse('recuperee');
        verrouSansRejeu = envois === 1 && incertain;
        const publicationsAvant = publications.length;
        signaler([...bilan, mode + ' : abandon à ' + tempsMs + ' ms ; attente de la fin tardive…']);
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 27000 - (performance.now() - debut))));
        stableApresRetard = publications.length === publicationsAvant && lu(publications.at(-1))?.incertain === true;
        await controle.actualiser();
      }
      const dernier = lu(publications.at(-1));
      const relu = dernier?.incertain === false && dernier?.etatLivreur?.course?.statut === 'recuperee';
      const c = await compteurs(); const lignes = c.journal.filter(x => x.mode === mode); const ligne = lignes[0];
      const finTardive = ligne?.finTentativeMs !== null && ligne?.finTentativeMs >= 24500;
      const bonnePhase = mode === 'entetes' ? entetesMs === null && ligne?.entetesMs === null : entetesMs !== null && entetesMs < 5000 && (ligne?.morceaux ?? 0) >= 3;
      const ok = lignes.length === 1 && envois === 1 && relu && (mode === 'rapide'
        ? !incertain && abandonMs === null && tempsMs < 10000 && ligne?.annule === false
        : incertain && abandonMs !== null && abandonMs >= 19000 && abandonMs <= 26000 && tempsMs - abandonMs < 2500 && verrouSansRejeu && stableApresRetard && bonnePhase && ligne?.annule === true && finTardive);
      await local('/__resultat', { mode, tempsMs, entetesMs, abandonMs, incertain, verrouSansRejeu, stableApresRetard, relu, envois, ok });
      bilan.push(mode + ' : ' + (ok ? 'OK' : 'ÉCHEC') + ' (' + tempsMs + ' ms)', '1 envoi ; relu=' + relu + (mode === 'rapide' ? '' : ' ; verrou et retard=' + (verrouSansRejeu && stableApresRetard)));
      signaler([...bilan]);
      if (!ok) throw new Error('CONTROLE_DELAI_ECHOUE');
    } finally { controle.fermer(); }
  }
  signaler(['DÉLAIS VALIDÉS SUR ANDROID', ...bilan]);
}
