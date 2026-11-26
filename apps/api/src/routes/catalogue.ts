import { Hono } from 'hono';
import { repondre, reponseErreur } from '../http.ts';
import type { Deps } from '../types.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function routeCatalogue(deps: Pick<Deps, 'catalogue'>) {
  const route = new Hono();
  route.use('*', async (c, suivant) => { c.header('Access-Control-Allow-Origin', '*'); await suivant(); });
  route.get('/restaurants', async c => {
    const apres = c.req.query('apres') ?? null;
    if (apres !== null && !uuid.test(apres)) return reponseErreur(c, { code: 'VALIDATION', message: 'Curseur invalide.' });
    return repondre(c, { ok: true, ...await deps.catalogue.restaurants(apres) });
  });
  route.get('/restaurants/:id/menu', async c => {
    const id = c.req.param('id'); const apres = c.req.query('apres') ?? null;
    if (!uuid.test(id) || (apres !== null && !uuid.test(apres))) return reponseErreur(c, { code: 'VALIDATION', message: 'Identifiant ou curseur invalide.' });
    const menu = await deps.catalogue.menu(id, apres);
    return menu ? repondre(c, { ok: true, ...menu }) : reponseErreur(c, { code: 'INTROUVABLE', message: 'Restaurant introuvable.' });
  });
  route.get('/quartiers', async c => repondre(c, { ok: true, ...await deps.catalogue.quartiers() }));
  // Index de recherche d'articles : donnée publique, la même pour tous ; l'appli la garde et la relit au plus toutes les 30 minutes. Cache court partagé (2 min) : un index périmé de quelques minutes est sans conséquence.
  route.get('/articles', async c => {
    if (!deps.catalogue.articles) return reponseErreur(c, { code: 'INTROUVABLE', message: 'Ressource introuvable.' });
    const index = await deps.catalogue.articles();
    return c.json({ ok: true, ...index }, 200, { 'Cache-Control': 'public, max-age=120' });
  });
  return route;
}
