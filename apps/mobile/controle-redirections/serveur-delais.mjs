import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const ID = '11111111-1111-4111-8111-111111111111';
const modes = new Set(['rapide', 'entetes', 'corps']);
/** Aucun réseau sortant, aucune base : seule une course factice change en mémoire. */
export function creerServeurDelais() {
  let mode = 'rapide'; let statut = 'vers_restaurant'; let journal = []; let rapports = [];
  const json = (res, code, corps) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/__etat') { json(res, 200, { journal, rapports, statut }); return; }
    if (req.method === 'POST' && url.pathname === '/__reset') { req.resume(); journal = []; rapports = []; statut = 'vers_restaurant'; json(res, 200, { ok: true }); return; }
    if (req.method === 'POST' && url.pathname === '/__scenario' && modes.has(url.searchParams.get('mode'))) {
      req.resume(); mode = url.searchParams.get('mode'); statut = 'vers_restaurant'; json(res, 200, { ok: true }); return;
    }
    if (req.headers.authorization !== 'Bearer controle-delais-factice') { req.resume(); json(res, 401, { ok: false }); return; }
    if (req.method === 'GET' && url.pathname === '/api/v1/livreur/etat') {
      json(res, 200, { ok: true, etat: {
        fiche: { nom: 'Livreur factice délais', statut: 'en_course', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null }, offre: null,
        course: { livraisonId: ID, statut, mode: 'speedfood', libelle: 'Course fictive', commandeReference: 'SF-DELAI', restaurantNom: 'Restaurant factice', fraisGnf: 0, etapesPossibles: statut === 'vers_restaurant' ? ['recuperee'] : ['vers_client'], client: null },
      } }); return;
    }
    let corps = ''; for await (const morceau of req) { corps += morceau; if (corps.length > 8192) { json(res, 413, { ok: false }); return; } }
    if (req.method === 'POST' && url.pathname === '/__resultat') {
      let brut; try { brut = JSON.parse(corps); } catch { json(res, 400, { ok: false }); return; }
      if (!modes.has(brut.mode)) { json(res, 400, { ok: false }); return; }
      const permis = ['mode', 'tempsMs', 'entetesMs', 'abandonMs', 'incertain', 'verrouSansRejeu', 'stableApresRetard', 'relu', 'envois', 'ok'];
      rapports.push(Object.fromEntries(permis.map(k => [k, brut[k]]))); json(res, 200, { ok: true }); return;
    }
    if (req.method !== 'POST' || url.pathname !== '/api/v1/livreur/course') { json(res, 404, { ok: false }); return; }
    let demande; try { demande = JSON.parse(corps); } catch { json(res, 400, { ok: false }); return; }
    if (demande.livraisonId !== ID || demande.vers !== 'recuperee' || statut !== 'vers_restaurant') { json(res, 400, { ok: false }); return; }
    statut = 'recuperee'; // L'action peut être appliquée même si sa réponse sera perdue.
    const debut = performance.now(); const entree = { mode, entetesMs: null, morceaux: 0, fermetureMs: null, annule: false, finTentativeMs: null };
    journal.push(entree);
    let progression;
    res.on('close', () => { entree.fermetureMs = Math.round(performance.now() - debut); entree.annule = !res.writableFinished; clearInterval(progression); });
    const entetes = () => { if (res.destroyed) return; entree.entetesMs = Math.round(performance.now() - debut); res.writeHead(200, { 'Content-Type': 'application/json' }); res.flushHeaders(); res.write('{"ok":'); entree.morceaux++; };
    if (mode !== 'entetes') {
      entetes();
      progression = setInterval(() => { if (!res.destroyed) { res.write(' '); entree.morceaux++; } }, 4000);
    }
    const attente = mode === 'rapide' ? 1500 : 25000;
    setTimeout(() => {
      entree.finTentativeMs = Math.round(performance.now() - debut); clearInterval(progression);
      if (res.destroyed) return;
      if (entree.mode === 'entetes') entetes();
      res.end('true}');
    }, attente);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  creerServeurDelais().listen(8796, '127.0.0.1', () => console.log('Banc délais prêt : 127.0.0.1:8796 ; course factice uniquement.'));
}
