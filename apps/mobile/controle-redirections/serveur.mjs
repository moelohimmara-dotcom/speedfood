import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const codes = new Set([200, 301, 302, 303, 307, 308]);
const chemins = new Set(['/api/v1/livreur/en-ligne', '/api/v1/livreur/offre', '/api/v1/livreur/course']);
/** Deux origines locales ; rien n'est relayé, aucune base ni identité réelle. */
export function creerServeursRedirections() {
  let entrees = []; let destinations = [];
  const repondre = (res, status, corps) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };
  const recevoir = autreOrigine => async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/destination') {
      destinations.push({ origine: autreOrigine ? 'autre' : 'meme', methode: req.method, autorisationPresente: Boolean(req.headers.authorization) });
      req.resume(); repondre(res, 200, { ok: true }); return;
    }
    if (autreOrigine) { repondre(res, 404, { ok: false }); return; }
    if (url.pathname === '/__etat' && req.method === 'GET') { repondre(res, 200, { entrees, destinations }); return; }
    if (url.pathname === '/__reset' && req.method === 'POST') { entrees = []; destinations = []; req.resume(); repondre(res, 200, { ok: true }); return; }
    const statut = Number(url.searchParams.get('statut')); const cible = url.searchParams.get('cible');
    if (!chemins.has(url.pathname) || req.method !== 'POST' || !codes.has(statut) || !['meme', 'autre'].includes(cible)) { repondre(res, 400, { ok: false }); return; }
    if (req.headers.authorization !== 'Bearer controle-redirections-factice') { repondre(res, 401, { ok: false }); return; }
    let taille = 0;
    for await (const morceau of req) { taille += morceau.length; if (taille > 8192) { repondre(res, 413, { ok: false }); return; } }
    entrees.push({ chemin: url.pathname, statut, cible, methode: req.method });
    if (statut === 200) { repondre(res, 200, { ok: true }); return; }
    res.writeHead(statut, { Location: cible === 'meme' ? '/destination' : 'http://127.0.0.1:8799/destination' }); res.end();
  };
  return [createServer(recevoir(false)), createServer(recevoir(true))];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const serveurs = creerServeursRedirections();
  await Promise.all(serveurs.map((s, i) => new Promise(resolve => s.listen(8798 + i, '127.0.0.1', resolve))));
  console.log('Banc redirections prêt : 127.0.0.1:8798 et :8799 ; données factices uniquement.');
}
