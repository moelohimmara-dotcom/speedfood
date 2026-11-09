import test from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth, ErreurConnexion, type SessionAuth } from '../src/connexion/client.ts';
import { ErreurLivreur, libelleDistanceLivreur, lireEnLigneLivreur, lireEtatLivreur, type EtatLivreur } from '../src/connexion/livreur.ts';
import { creerControleEtatLivreur, type SessionEtatLivreur } from '../src/connexion/controle-etat-livreur.ts';
import { GestionSession } from '../src/connexion/session.ts';

const acces = 'access-factice';
const sessionAuth: SessionAuth = { accessToken: acces, refreshToken: 'refresh-factice', userId: '00000000-0000-4000-8000-000000000001', expiresAt: 9999999999 };
function reponse(status: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}
function authentification(fetchFactice: typeof fetch) {
  return creerAuth(fetchFactice);
}
const fiche: EtatLivreur['fiche'] = { nom: 'Livreuse contrôle', statut: 'hors_ligne', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null };
const offre = { offreId: 'offre-1', expireLe: '2026-11-08T23:59:00.000Z', restaurantNom: 'Restaurant contrôle', distanceCourseKm: 2.4, distanceRestaurantKm: 1.1, fraisGnf: 5000 };

test('domaine : réponse état exacte acceptée ; enveloppe ou champ différent rejeté', () => {
  assert.deepEqual(lireEtatLivreur({ ok: true, etat: { fiche, offre } }), { fiche, offre });
  assert.equal(lireEtatLivreur({ ok: true, etat: null }), null);
  assert.throws(() => lireEtatLivreur({ ok: true }));
  assert.throws(() => lireEtatLivreur({ ok: false, etat: { fiche, offre } }));
  assert.throws(() => lireEtatLivreur({ ok: true, etat: { fiche: { ...fiche, statut: 'inconnu' }, offre: null } }));
  assert.throws(() => lireEtatLivreur({ ok: true, etat: { fiche, offre: { ...offre, fraisGnf: 5000.5 } } }), /ILLISIBLE/);
  assert.equal(libelleDistanceLivreur(null), '—');
  assert.match(libelleDistanceLivreur(2.4), /2,4 km/);
});

test('domaine : bascule confirmée seulement par { ok: true } exact', () => {
  assert.equal(lireEnLigneLivreur({ ok: true }), true);
  assert.throws(() => lireEnLigneLivreur({ ok: false }));
  assert.throws(() => lireEnLigneLivreur(null));
  const e = new ErreurLivreur('incertain', 'x');
  assert.equal(e.genre, 'incertain'); assert.equal(e.name, 'ErreurLivreur');
});

test('client : lecture GET et bascule POST vers les seuls chemins livreur, corps minimal', async () => {
  const urls: string[] = []; const corps: string[] = [];
  const auth = authentification(async (entree, init) => {
    urls.push(String(entree));
    if (init?.body) corps.push(String(init.body));
    return String(entree).endsWith('/en-ligne') ? reponse(200, { ok: true }) : reponse(200, { ok: true, etat: { fiche, offre } });
  });
  await auth.etatLivreur(acces);
  await auth.basculerEnLigneLivreur(acces, true);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/api\/v1\/livreur\/etat$/); assert.ok(!urls[0].includes('?'));
  assert.match(urls[1], /\/api\/v1\/livreur\/en-ligne$/);
  assert.deepEqual(corps, ['{"enLigne":true}']);
});

test('client : refus 400 de la bascule = refus explicite ; 500 et rejet réseau = incertain', async () => {
  const refus = authentification(async () => reponse(400, { ok: false, erreur: { code: 'VALIDATION', message: 'x' } }));
  await assert.rejects(refus.basculerEnLigneLivreur(acces, true), (e: unknown) => e instanceof ErreurLivreur && e.genre === 'refus');
  const panne = authentification(async () => reponse(500, { ok: false }));
  await assert.rejects(panne.basculerEnLigneLivreur(acces, true), (e: unknown) => e instanceof ErreurLivreur && e.genre === 'incertain');
  const reseau = authentification(async () => { throw new Error('réseau factice'); });
  await assert.rejects(reseau.basculerEnLigneLivreur(acces, true), (e: unknown) => e instanceof ErreurLivreur && e.genre === 'incertain');
  const finSession = authentification(async () => reponse(401, { ok: false }));
  await assert.rejects(finSession.basculerEnLigneLivreur(acces, true), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});

// ---------- session et contrôleur ----------

type LectureFactice = { generation: number | null; appels: string[]; session: SessionEtatLivreur };
function sessionFactice(repondre: (appel: string) => Promise<unknown>): LectureFactice {
  const appels: string[] = [];
  const session: SessionEtatLivreur = {
    generationNotifications: 4,
    etatLivreur: async () => { appels.push('etat'); return repondre('etat') as Promise<EtatLivreur | null>; },
    basculerEnLigneLivreur: async (v) => { appels.push('basculer:' + v); await repondre('basculer'); },
  };
  return { generation: 4, appels, session };
}

test('contrôleur : bascule réussie relit l’état avant de publier la vérité', async () => {
  let etatActuel: EtatLivreur | null = { fiche: { ...fiche, statut: 'hors_ligne' }, offre: null };
  const f = sessionFactice(async (appel) => { if (appel === 'etat') return etatActuel; etatActuel = { fiche: { ...fiche, statut: 'disponible' }, offre: null }; return undefined; });
  const publications: unknown[] = [];
  const controle = creerControleEtatLivreur(f.session, (e) => publications.push(e));
  await controle.actualiser();
  await controle.basculer(true);
  assert.deepEqual(f.appels, ['etat', 'basculer:true', 'etat']);
  const derniere = publications.at(-1) as { etatLivreur: EtatLivreur };
  assert.equal(derniere.etatLivreur.fiche.statut, 'disponible');
});

test('contrôleur : résultat incertain verrouille la bascule jusqu’à une relecture réussie', async () => {
  let mode: 'incertain' | 'refus' | 'ok' = 'incertain';
  const f = sessionFactice(async (appel) => {
    if (appel === 'etat') return { fiche, offre: null };
    if (mode === 'incertain') throw new ErreurLivreur('incertain', 'Résultat inconnu factice.');
    if (mode === 'refus') throw new ErreurLivreur('refus', 'Refus factice.');
    return undefined;
  });
  const publications: { incertain?: boolean; message?: string | null }[] = [];
  const controle = creerControleEtatLivreur(f.session, (e) => publications.push(e as { incertain?: boolean }));
  await controle.actualiser();
  await controle.basculer(true);
  assert.equal(publications.at(-1)?.incertain, true);
  // Bouton verrouillé : un second tap ne part jamais tant que l'état n'est pas relu.
  await controle.basculer(false);
  assert.deepEqual(f.appels.filter(a => a.startsWith('basculer')), ['basculer:true']);
  await controle.actualiser();
  assert.equal(publications.at(-1)?.incertain, false);
  // Refus explicite : pas de verrouillage, message conservé, vérité relue.
  mode = 'refus';
  await controle.basculer(true);
  assert.deepEqual(f.appels.filter(a => a.startsWith('basculer')), ['basculer:true', 'basculer:true']);
  assert.equal(publications.at(-1)?.incertain, false);
  assert.match(String(publications.at(-1)?.message ?? ''), /Refus factice/);
});

test('session : une lecture d’état terminée après un remplacement de session est écartée', async () => {
  let ouvrir: (v: EtatLivreur | null) => void = () => {};
  const promesse = new Promise<EtatLivreur | null>((r) => { ouvrir = r; });
  const api = {
    connecter: async () => sessionAuth,
    renouveler: async () => sessionAuth,
    deconnecter: async () => undefined,
    etatLivreur: async () => promesse,
  } as unknown as ConstructorParameters<typeof GestionSession>[0];
  const session = new GestionSession(api, { lire: async () => 'refresh-factice', ecrire: async () => {}, effacer: async () => {} });
  await session.restaurer();
  assert.equal(session.connectee, true);
  const avant = session.etatLivreur();
  await new Promise((r) => setImmediate(r));
  await session.connecter('autre@factice.invalid', 'factice');
  ouvrir({ fiche, offre: null });
  await assert.rejects(avant, /annulée/);
});
