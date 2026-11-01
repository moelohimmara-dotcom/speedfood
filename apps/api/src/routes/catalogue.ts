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
  return route;
}
