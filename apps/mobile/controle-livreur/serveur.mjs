// Serveur de banc LOCAL seulement : vraie route Hono + vrai service fiche sur une base factice permissive.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { routeLivreur } from '../../api/src/routes/livreur.ts';
import { creerServiceLivreur } from '../../api/src/livreur/fiche.ts';
import { creerLectureEtat } from '../../api/src/livreur/etat.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { reponseErreur } from '../../api/src/http.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

const [A, B] = COMPTES_CONTROLE;
const scenarios = new Set(['actif', 'suspendu', 'archive', 'absente', 'panne', 'lente', 'restaurant_masque', 'offre', 'offre_expiree']);
export function creerBancLivreur() {
  let scenario = 'actif'; const appels = []; const bascules = []; let declenchements = 0;
  let statutA = 'hors_ligne';
  function clientFictif() {
    return { from(table) {
      if (table === 'livraison_offres') {
        return { select(champs) { if (String(champs).includes('*')) throw new Error('PROJECTION_NON_PREVUE'); return this; }, eq() { return this; }, gt() { return this; }, order() { return this; }, limit() { return this; }, async maybeSingle() {
          const cas = scenario;
          if (cas === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
          if ((cas === 'offre' && statutA === 'disponible') ) return { data: { id: 'offre-témoin-1', expire_le: new Date(Date.now() + 90000).toISOString(), livraisons: { distance_m: 3200, frais_gnf: 5000, depart_latitude: 10.4, depart_longitude: -13.53, restaurants: { nom: 'Restaurant témoin A' } } }, error: null };
          return { data: null, error: null };
        } };
      }
      // G3a : l'état lit aussi la course ; ce banc G2 n'en simule aucune (le banc de course relève de G3c).
      if (table === 'livraisons') return { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
      if (table !== 'livreurs') throw new Error('TABLE_NON_PREVUE');
      let uid = null;
      return { select(champs) { if (champs.includes('*')) throw new Error('PROJECTION_NON_PREVUE'); return this; }, eq(champ, valeur) { if (champ !== 'utilisateur_id') throw new Error('FILTRE_NON_PREVU'); uid = valeur; return this; }, async maybeSingle() {
        const cas = scenario;
        if (cas === 'lente' && uid === A) await new Promise(r => setTimeout(r, 2500));
        if (cas === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
        if (cas === 'absente') return { data: null, error: null };
        const lignes = [
          { id: 'livreur-témoin-B', utilisateur_id: B, nom: 'Livreur témoin B', statut: 'disponible', vehicule: 'pied', cycle: 'actif', motif_cycle: null, latitude: null, longitude: null, restaurants: { nom: 'Restaurant témoin B' } },
          { id: 'livreur-témoin-A', utilisateur_id: A, nom: 'Livreuse témoin A', statut: statutA, vehicule: 'moto', cycle: cas === 'suspendu' ? 'suspendu' : cas === 'archive' ? 'archive' : 'actif', motif_cycle: cas === 'suspendu' ? 'Dossier à vérifier' : null, latitude: 10.39, longitude: -13.52, restaurants: null },
        ];
        const ligne = lignes.find(l => l.utilisateur_id === uid) ?? lignes[0];
        return { data: cas === 'restaurant_masque' ? { ...ligne, restaurants: null } : ligne, error: null };
      } };
    } };
  }
  const service = creerServiceLivreur({ clientDuJeton: clientFictif, limiter: async () => undefined });
  const lireEtat = creerLectureEtat({ clientDuJeton: () => clientFictif(), regles: { acteurPeut: () => false, libelleLivraison: () => '' }, lireCommande: async () => { throw new Error('COMMANDE_NON_PREVUE'); } });
  async function basculerFactice(utilisateurId, enLigne) {
    const cas = scenario;
    if (cas === 'suspendu' || cas === 'archive') return { ok: false, message: 'Votre fiche n’est pas active : elle ne peut pas changer de disponibilité.' };
    bascules.push((utilisateurId === A ? 'A' : 'B') + ':' + (enLigne ? 'en_ligne' : 'hors_ligne'));
    if (utilisateurId === A) statutA = enLigne ? 'disponible' : 'hors_ligne';
    return { ok: true };
  }
  const app = new Hono();
  app.get('/__etat', c => c.json({ scenario, lectures: appels.length, comptesLus: appels, bascules, declenchements }));
  app.post('/__scenario', c => {
    const cas = c.req.query('cas');
    if (!scenarios.has(cas)) return c.json({ ok: false }, 400);
    scenario = cas; return c.json({ ok: true, scenario });
  });
  app.route('/api/v1/livreur', routeLivreur({
    verificateurs: { strict: async j => j === PORTEURS_CONTROLE[0] ? { id: A } : j === PORTEURS_CONTROLE[1] ? { id: B } : null, local: async () => { throw Error('MODE_LOCAL_INTERDIT'); } },
    livreur: { ...service, lireFiche: (j, id) => { appels.push(id === A ? 'A' : 'B'); return service.lireFiche(j, id); }, lireEtat, basculer: basculerFactice, avancerOffres: async () => { declenchements++; } },
  }));
  app.onError((e, c) => e instanceof ErreurMetier ? reponseErreur(c, e.toApi()) : c.json({ ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'Panne factice de la lecture.' } }, 500));
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = creerBancLivreur();
  createServer(async (req, res) => {
    try {
      const morceaux = [];
      for await (const morceau of req) morceaux.push(morceau);
      const corps = Buffer.concat(morceaux);
      const reponse = await app.fetch(new Request('http://127.0.0.1:8797' + (req.url ?? '/'), { method: req.method, headers: req.headers, body: corps.length > 0 ? corps : undefined }));
      res.writeHead(reponse.status, Object.fromEntries(reponse.headers)); res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch { res.writeHead(500); res.end('ERREUR_BANC'); }
  }).listen(8797, '127.0.0.1', () => console.log('Banc livreur local prêt sur 127.0.0.1:8797 ; aucune base réelle.'));
}
