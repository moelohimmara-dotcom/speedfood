import { Hono } from 'hono';
import { lireBearer } from '@speedfood/shared/api/v1-regles';
import { projeterFicheLivreur } from '@speedfood/shared/contracts/livreur-fiche';
import { identifier, limiterParCompte, type Variables } from '../controles/chaine.ts';
import { lireCorpsJson, repondre, reponseErreur } from '../http.ts';
import type { Deps } from '../types.ts';

/**
 * G1 : la fiche est lue ; les services historiques de course ne sont jamais importés.
 * G2 : l'état (fiche + offre) est une lecture PURE — aucun traitement des offres, aucune écriture — et la bascule de
 * disponibilité est la seule écriture, explicite, câblée sur le service du site ; l'avancement des offres n'est
 * déclenché qu'après une mise en ligne réussie, jamais pendant une lecture.
 */
export function routeLivreur(deps: Pick<Deps, 'verificateurs' | 'livreur'>) {
  const route = new Hono<{ Variables: Variables }>();
  const garde = [identifier(deps.verificateurs.strict, 'Connectez-vous avec votre compte livreur.'), limiterParCompte(deps.livreur.limiter)] as const;
  route.get('/fiche', ...garde, async c => {
    const jeton = lireBearer(c.req.header('authorization'))!;
    const fiche = await deps.livreur.lireFiche(jeton, c.get('utilisateurId'));
    return repondre(c, { ok: true, fiche: fiche === null ? null : projeterFicheLivreur(fiche) });
  });
  route.get('/etat', ...garde, async c => {
    const jeton = lireBearer(c.req.header('authorization'))!;
    const etat = await deps.livreur.lireEtat(jeton, c.get('utilisateurId'));
    return repondre(c, { ok: true, etat: etat === null ? null : { fiche: projeterFicheLivreur(etat.fiche), offre: etat.offre } });
  });
  route.post('/en-ligne', ...garde, async c => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === 'object' && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
    if (Object.keys(corps).length !== 1 || typeof corps.enLigne !== 'boolean') {
      return reponseErreur(c, { code: 'VALIDATION', message: 'Disponibilité invalide.' });
    }
    const resultat = await deps.livreur.basculer(c.get('utilisateurId'), corps.enLigne);
    if (!resultat.ok) return reponseErreur(c, { code: 'VALIDATION', message: resultat.message });
    if (corps.enLigne) await deps.livreur.avancerOffres();
    return repondre(c, { ok: true });
  });
  return route;
}
