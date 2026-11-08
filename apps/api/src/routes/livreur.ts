import { Hono } from 'hono';
import { lireBearer } from '@speedfood/shared/api/v1-regles';
import { projeterFicheLivreur } from '@speedfood/shared/contracts/livreur-fiche';
import { identifier, limiterParCompte, type Variables } from '../controles/chaine.ts';
import { repondre } from '../http.ts';
import type { Deps } from '../types.ts';

/** G1 : seule la fiche est lue ; les services historiques de course ne sont jamais importés. */
export function routeLivreur(deps: Pick<Deps, 'verificateurs' | 'livreur'>) {
  const route = new Hono<{ Variables: Variables }>();
  route.get('/fiche', identifier(deps.verificateurs.strict, 'Connectez-vous avec votre compte livreur.'), limiterParCompte(deps.livreur.limiter), async c => {
    const jeton = lireBearer(c.req.header('authorization'))!;
    const fiche = await deps.livreur.lireFiche(jeton, c.get('utilisateurId'));
    return repondre(c, { ok: true, fiche: fiche === null ? null : projeterFicheLivreur(fiche) });
  });
  return route;
}
