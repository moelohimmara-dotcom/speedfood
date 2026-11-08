// Serveur de banc LOCAL seulement : vraie route Hono + vrai service fiche sur une base factice permissive.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { routeLivreur } from '../../api/src/routes/livreur.ts';
import { creerServiceLivreur } from '../../api/src/livreur/fiche.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { reponseErreur } from '../../api/src/http.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

const [A, B] = COMPTES_CONTROLE;
const scenarios = new Set(['actif', 'suspendu', 'archive', 'absente', 'panne', 'lente', 'restaurant_masque']);
export function creerBancLivreur() {
  let scenario = 'actif'; const appels = [];
  function clientFictif() {
    return { from(table) {
      if (table !== 'livreurs') throw new Error('TABLE_NON_PREVUE');
      let uid = null;
      return { select(champs) { if (champs.includes('*')) throw new Error('PROJECTION_NON_PREVUE'); return this; }, eq(champ, valeur) { if (champ !== 'utilisateur_id') throw new Error('FILTRE_NON_PREVU'); uid = valeur; return this; }, async maybeSingle() {
        const cas = scenario;
        if (cas === 'lente' && uid === A) await new Promise(r => setTimeout(r, 2500));
        if (cas === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
        if (cas === 'absente') return { data: null, error: null };
        const lignes = [
          { utilisateur_id: B, nom: 'Livreur témoin B', statut: 'disponible', vehicule: 'pied', cycle: 'actif', motif_cycle: null, restaurants: { nom: 'Restaurant témoin B' } },
          { utilisateur_id: A, nom: 'Livreuse témoin A', statut: 'hors_ligne', vehicule: 'moto', cycle: cas === 'suspendu' ? 'suspendu' : cas === 'archive' ? 'archive' : 'actif', motif_cycle: cas === 'suspendu' ? 'Dossier à vérifier' : null, restaurants: null },
        ];
        const ligne = lignes.find(l => l.utilisateur_id === uid) ?? lignes[0];
        return { data: cas === 'restaurant_masque' ? { ...ligne, restaurants: null } : ligne, error: null };
      } };
    } };
  }
  const service = creerServiceLivreur({ clientDuJeton: clientFictif, limiter: async () => undefined });
  const app = new Hono();
  app.get('/__etat', c => c.json({ scenario, lectures: appels.length, comptesLus: appels }));
  app.post('/__scenario', c => {
    const cas = c.req.query('cas');
    if (!scenarios.has(cas)) return c.json({ ok: false }, 400);
    scenario = cas; return c.json({ ok: true, scenario });
  });
  app.route('/api/v1/livreur', routeLivreur({
    verificateurs: { strict: async j => j === PORTEURS_CONTROLE[0] ? { id: A } : j === PORTEURS_CONTROLE[1] ? { id: B } : null, local: async () => { throw Error('MODE_LOCAL_INTERDIT'); } },
    livreur: { ...service, lireFiche: (j, id) => { appels.push(id === A ? 'A' : 'B'); return service.lireFiche(j, id); } },
  }));
  app.onError((e, c) => e instanceof ErreurMetier ? reponseErreur(c, e.toApi()) : c.json({ ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'Panne factice de la lecture.' } }, 500));
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = creerBancLivreur();
  createServer(async (req, res) => {
    try {
      const reponse = await app.fetch(new Request('http://127.0.0.1:8797' + (req.url ?? '/'), { method: req.method, headers: req.headers }));
      res.writeHead(reponse.status, Object.fromEntries(reponse.headers)); res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch { res.writeHead(500); res.end('ERREUR_BANC'); }
  }).listen(8797, '127.0.0.1', () => console.log('Banc livreur local prêt sur 127.0.0.1:8797 ; aucune base réelle.'));
}
