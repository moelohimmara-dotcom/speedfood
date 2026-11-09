import { Hono } from 'hono';
import { lireBearer } from '@speedfood/shared/api/v1-regles';
import { projeterFicheLivreur } from '@speedfood/shared/contracts/livreur-fiche';
import { lireCorpsCourseLivreur, lireCorpsOffreLivreur, projeterCourseLivreur } from '@speedfood/shared/contracts/livreur-course';
import { identifier, limiterParCompte, type Variables } from '../controles/chaine.ts';
import { lireCorpsJson, repondre, reponseErreur } from '../http.ts';
import type { Deps } from '../types.ts';

/**
 * G1 : la fiche est lue ; les services historiques de course ne sont jamais importés.
 * G2 : l'état (fiche + offre) est une lecture PURE — aucun traitement des offres, aucune écriture — et la bascule de
 * disponibilité est la seule écriture, explicite, câblée sur le service du site ; l'avancement des offres n'est
 * déclenché qu'après une mise en ligne réussie, jamais pendant une lecture.
 * G3a : l'état porte aussi la course (lecture pure) ; répondre à l'offre et faire avancer la course sont deux écritures
 * explicites câblées sur les services du site. Le compte est TOUJOURS celui du porteur (jamais le corps) ; les corps ont des
 * clés exactes ; le code de remise ne sort dans aucune réponse ni aucun journal.
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
    if (etat === null) return repondre(c, { ok: true, etat: null });
    // La course est reprojetée ICI aussi : aucune coordonnée ni client avant récupération, même si l'amont en fournissait.
    const course = etat.course === null || etat.course === undefined ? null : projeterCourseLivreur(etat.course);
    if (etat.course && course === null) throw new Error('ETAT_LIVREUR_ILLISIBLE');
    return repondre(c, { ok: true, etat: { fiche: projeterFicheLivreur(etat.fiche), offre: etat.offre, course } });
  });
  route.post('/offre', ...garde, async c => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lireCorpsOffreLivreur(lu.corps);
    if (corps === null) return reponseErreur(c, { code: 'VALIDATION', message: 'Demande invalide.' });
    const resultat = await deps.livreur.repondreOffre(c.get('utilisateurId'), corps.offreId, corps.reponse);
    if (!resultat.ok) return reponseErreur(c, { code: 'VALIDATION', message: resultat.message });
    return repondre(c, { ok: true });
  });
  route.post('/course', ...garde, async c => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lireCorpsCourseLivreur(lu.corps);
    if (corps === null) return reponseErreur(c, { code: 'VALIDATION', message: 'Demande invalide.' });
    const jeton = lireBearer(c.req.header('authorization'))!;
    const resultat = await deps.livreur.avancerCourse(jeton, c.get('utilisateurId'), { livraisonId: corps.livraisonId, vers: corps.vers, code: corps.code, raison: corps.raison });
    if (!resultat.ok) {
      // Défense : un message qui reprendrait le code saisi n'est jamais renvoyé.
      const message = corps.code !== undefined && resultat.message.includes(corps.code) ? 'Code de remise incorrect.' : resultat.message;
      return reponseErreur(c, { code: 'VALIDATION', message });
    }
    return repondre(c, { ok: true });
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
