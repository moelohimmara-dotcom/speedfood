import { Hono } from 'hono';
import { lireBearer } from '@speedfood/shared/api/v1-regles';
import { lirePreferencesAEcrire } from '@speedfood/shared/contracts/preferences';
import { identifier, limiterParCompte, type Variables } from '../controles/chaine.ts';
import { lireCorpsJson, repondre, reponseErreur } from '../http.ts';
import type { Deps } from '../types.ts';

/**
 * Préférences alimentaires du client (goûts, régimes, ALLERGIES). Mode de jeton STRICT ; le compte est TOUJOURS celui du jeton, jamais le corps.
 *  GET    /api/v1/preferences           les siennes (`null` tant qu'il n'en a pas enregistré)
 *  PUT    /api/v1/preferences           les remplace toutes ; les allergies exigent `consentementSante: true`
 *  DELETE /api/v1/preferences           les efface (droit à l'effacement), allergies comprises
 *  GET    /api/v1/preferences/habitudes ses habitudes (compteurs tirés de ses commandes) pour classer les résultats
 * Rien n'est mis en cache (donnée de santé) et aucune réponse ne contient de donnée d'un autre compte.
 */
export function routePreferences(deps: Pick<Deps, 'verificateurs' | 'limiterClientApplication' | 'preferences'>) {
  const route = new Hono<{ Variables: Variables }>();
  route.use('*', identifier(deps.verificateurs.strict));
  route.use('*', limiterParCompte(deps.limiterClientApplication));
  route.get('/', async c => repondre(c, { ok: true, preferences: await deps.preferences.lire(lireBearer(c.req.header('authorization'))!, c.get('utilisateurId')) }));
  route.put('/', async c => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lirePreferencesAEcrire(lu.corps);
    if (corps === null) return reponseErreur(c, { code: 'VALIDATION', message: 'Préférences invalides.' });
    const r = await deps.preferences.ecrire(lireBearer(c.req.header('authorization'))!, c.get('utilisateurId'), corps);
    if (!r.ok) return reponseErreur(c, { code: 'VALIDATION', message: r.message });
    return repondre(c, { ok: true });
  });
  route.delete('/', async c => {
    await deps.preferences.effacer(lireBearer(c.req.header('authorization'))!, c.get('utilisateurId'));
    return repondre(c, { ok: true });
  });
  route.get('/habitudes', async c => repondre(c, { ok: true, habitudes: await deps.preferences.habitudes(c.get('utilisateurId')) }));
  return route;
}
