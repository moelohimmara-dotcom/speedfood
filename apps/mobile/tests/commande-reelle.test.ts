import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { ErreurCommande, creerTentative, genererCleIdempotence, preparerEnvoi, refusServeur, validerSaisie } from '../src/catalogue/commande-reelle.ts';
import { ajouter, quantite, vide } from '../src/catalogue/panier-reel.ts';
import type { PlatCataloguePublic } from '../../../packages/shared/src/contracts/catalogue.ts';
import type { CreationCommandePayload } from '../../../packages/shared/src/contracts/commande.ts';

const resto = '00000000-0000-4000-8000-0000000000aa';
const id1 = '00000000-0000-4000-8000-000000000001';
const id2 = '00000000-0000-4000-8000-000000000002';
const plat = (id: string, prixGnf: number): PlatCataloguePublic => ({ id, nom: 'Plat ' + id.slice(-1), description: '', prixGnf, disponibilite: 'disponible', confirmeLe: null });
const plats = [plat(id1, 25000), plat(id2, 12000)];
const panier = quantite(ajouter(ajouter(ajouter(vide(), resto, plats[0]), resto, plats[1]), resto, plats[0]), id1, 2); // 2 × 25000 + 1 × 12000
const saisie = { nom: '  Mariama Diallo ', telephone: '622 12 34 56', consentement: true };
const JETON = 'A'.repeat(39) + 'b'; // 40 caractères base64url
let compteur = 0;
const generateur = () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, '0')}`;
function payloadValide(tentative = creerTentative(generateur), p = panier): CreationCommandePayload {
  const r = preparerEnvoi(p, plats, saisie, tentative); assert.equal(r.ok, true); return (r as { ok: true; payload: CreationCommandePayload }).payload;
}
const json = (corps: unknown, status: number) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });

test('commande : charge utile exacte, retrait, aucun prix par ligne, sous-total = somme', () => {
  compteur = 0;
  const p = payloadValide();
  assert.deepEqual(p, {
    cleIdempotence: '00000000-0000-4000-8000-000000000001', restaurantId: resto,
    client: { nom: 'Mariama Diallo', telephone: '+224622123456', adresse: null }, mode: 'retrait',
    lignes: [{ menuItemId: id1, quantite: 2, optionIds: [] }, { menuItemId: id2, quantite: 1, optionIds: [] }],
    sousTotalAffiche: 62000, consentementReglement: true,
  });
  for (const l of p.lignes) assert.deepEqual(Object.keys(l).sort(), ['menuItemId', 'optionIds', 'quantite']);
});

test('commande : envoi POST authentifié, corps = charge utile, un seul appel, réponse 201 contrôlée', async () => {
  const p = payloadValide(); const appels: { url: string; o: RequestInit }[] = [];
  const a = creerAuth(async (url, o) => { appels.push({ url: String(url), o: o! }); return json({ ok: true, reference: 'SF-ABCDE', jeton: JETON, idempotent: false }, 201); });
  const r = await a.creerCommande('acces-factice', p);
  assert.deepEqual(r, { reference: 'SF-ABCDE', jeton: JETON, idempotent: false });
  assert.equal(appels.length, 1);
  assert.ok(appels[0].url.endsWith('/api/v1/commandes')); assert.ok(!appels[0].url.includes(JETON));
  assert.equal(appels[0].o.method, 'POST'); assert.equal(appels[0].o.credentials, 'omit');
  assert.equal((appels[0].o.headers as Record<string, string>).Authorization, 'Bearer acces-factice');
  assert.deepEqual(JSON.parse(String(appels[0].o.body)), p);
});

test('commande : 200 = rejeu idempotent, 201 = nouvelle ; contradiction entre statut et corps refusée', async () => {
  const p = payloadValide();
  const rep = (status: number, idempotent: boolean) => creerAuth(async () => json({ ok: true, reference: 'SF-ABCDE', jeton: JETON, idempotent }, status)).creerCommande('t', p);
  assert.equal((await rep(200, true)).idempotent, true);
  assert.equal((await rep(201, false)).idempotent, false);
  await assert.rejects(rep(200, false), ErreurCommande);
  await assert.rejects(rep(201, true), ErreurCommande);
});

test('commande : mode sur_place et livraison refusés avant tout appel réseau', async () => {
  let appels = 0; const a = creerAuth(async () => { appels++; return json({}, 201); });
  for (const mode of ['sur_place', 'livraison'] as const) await assert.rejects(a.creerCommande('t', { ...payloadValide(), mode }), (e: unknown) => e instanceof ErreurCommande && e.genre === 'validation');
  assert.equal(appels, 0);
});

test('commande : réponse invalide rejetée (incertaine), jeton jamais dans l’erreur', async () => {
  const p = payloadValide();
  const mauvaises: [number, unknown][] = [
    [201, { ok: true, reference: 'SF-ABCDE', jeton: 'court', idempotent: false }],
    [201, { ok: true, reference: 'SF-ABCDE', jeton: JETON + 'x', idempotent: false }],
    [201, { ok: true, reference: 'SF-ABCDE', jeton: 'é'.repeat(40), idempotent: false }],
    [201, { ok: true, reference: '', jeton: JETON, idempotent: false }],
    [201, { ok: false, reference: 'SF-ABCDE', jeton: JETON, idempotent: false }],
    [201, { ok: true, reference: 'SF-ABCDE', jeton: JETON }],
    [202, { ok: true, reference: 'SF-ABCDE', jeton: JETON, idempotent: false }],
    [201, [JETON]],
  ];
  for (const [status, corps] of mauvaises) {
    await assert.rejects(creerAuth(async () => json(corps, status)).creerCommande('t', p), (e: unknown) => e instanceof ErreurCommande && e.genre === 'reponse_invalide' && e.incertain && !e.message.includes(JETON));
  }
  await assert.rejects(creerAuth(async () => new Response('pas du json', { status: 201, headers: { 'content-type': 'application/json' } })).creerCommande('t', p), ErreurCommande);
  await assert.rejects(creerAuth(async () => new Response(JSON.stringify({ ok: true, reference: 'SF-ABCDE', jeton: JETON, idempotent: false }), { status: 201 })).creerCommande('t', p), ErreurCommande); // pas de content-type JSON
});

test('commande : jamais de relance automatique (5xx, réseau, réponse invalide) ; envoi incertain', async () => {
  const p = payloadValide();
  for (const reponse of [() => json({ ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'x' } }, 500), () => { throw new TypeError('réseau'); }, () => json({ ok: true }, 201)]) {
    let appels = 0;
    const a = creerAuth(async () => { appels++; return reponse(); });
    await assert.rejects(a.creerCommande('t', p), (e: unknown) => e instanceof ErreurCommande && e.incertain === true);
    assert.equal(appels, 1);
  }
});

test('commande : table des refus serveur vers messages français, sans texte brut ni jeton', async () => {
  const p = payloadValide();
  const cas: [number, unknown, string, boolean][] = [
    [400, { ok: false, erreur: { code: 'VALIDATION', message: `brut ${JETON}` } }, 'validation', false],
    [401, { ok: false, erreur: { code: 'NON_AUTHENTIFIE', message: 'x' } }, 'session', false],
    [403, { ok: false, erreur: { code: 'NON_AUTORISE', message: 'x' } }, 'session', false],
    [409, { ok: false, erreur: { code: 'CONFLIT_ETAT', message: 'x', champs: { sousTotalServeur: '65000' } } }, 'prix', false],
    [429, { ok: false, erreur: { code: 'TROP_DE_REQUETES', message: 'x' } }, 'trop_de_requetes', false],
    [500, { ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'x' } }, 'serveur', true],
    [503, null, 'serveur', true],
  ];
  for (const [status, corps, genre, incertain] of cas) {
    await assert.rejects(creerAuth(async () => corps === null ? new Response('', { status }) : json(corps, status)).creerCommande('t', p), (e: unknown) => {
      assert.ok(e instanceof ErreurCommande); assert.equal(e.genre, genre); assert.equal(e.incertain, incertain);
      assert.ok(!e.message.includes(JETON) && !e.message.includes('brut')); assert.match(e.message, /[a-zé]/); return true;
    });
  }
  const prix = refusServeur(409, 'CONFLIT_ETAT', 65000); assert.equal(prix.sousTotalServeur, 65000); assert.match(prix.message, /65\s?000 GNF/);
  assert.equal(refusServeur(409, 'CONFLIT_ETAT', null).sousTotalServeur, null);
});

test('commande : clé d’idempotence stable au rejeu, changée seulement si le contenu change', () => {
  compteur = 0; const t = creerTentative(generateur);
  const k1 = payloadValide(t).cleIdempotence;
  assert.equal(payloadValide(t).cleIdempotence, k1); assert.equal(payloadValide(t).cleIdempotence, k1); // rejeu = même clé
  assert.equal(compteur, 1);
  const k2 = payloadValide(t, quantite(panier, id2, 3)).cleIdempotence; assert.notEqual(k2, k1); // panier modifié
  const r = preparerEnvoi(panier, plats, { ...saisie, nom: 'Autre Nom' }, t); assert.equal(r.ok, true);
  assert.notEqual((r as { ok: true; payload: CreationCommandePayload }).payload.cleIdempotence, k2); // formulaire modifié
  const r2 = preparerEnvoi(panier, [plat(id1, 26000), plats[1]], saisie, t);
  assert.notEqual((r2 as { ok: true; payload: CreationCommandePayload }).payload.cleIdempotence, k1); // prix relu différent
  t.oublier(); const avant = compteur; payloadValide(t); assert.equal(compteur, avant + 1); // après succès : nouvelle clé
});

test('commande : clé générée = UUID v4', () => {
  assert.match(genererCleIdempotence(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(genererCleIdempotence(), genererCleIdempotence());
});

test('commande : validation client (nom, téléphone, consentement, panier non chiffré)', () => {
  const t = creerTentative(generateur);
  const refus = (s: Partial<typeof saisie>, p = panier, l = plats) => preparerEnvoi(p, l, { ...saisie, ...s }, t);
  assert.equal(refus({ nom: ' a ' }).ok, false); assert.equal(refus({ nom: 'x'.repeat(121) }).ok, false);
  assert.equal(refus({ telephone: '12345' }).ok, false); assert.equal(refus({ telephone: '522123456' }).ok, false);
  assert.equal(refus({ consentement: false }).ok, false);
  assert.equal(refus({}, vide()).ok, false);
  assert.equal(refus({}, panier, []).ok, false); // prix non relus : pas de total, pas d'envoi
  assert.equal(refus({}, panier, [{ ...plats[0], disponibilite: 'epuise' }, plats[1]]).ok, false);
  assert.equal(validerSaisie({ nom: 'Ab', telephone: '+224 622 12 34 56', consentement: true }).telephone, '+224622123456');
  assert.deepEqual(validerSaisie({ nom: 'Ab', telephone: '0622123456', consentement: true }).erreurs, {});
});

test('session : creerCommande ne renvoie jamais le jeton et efface la session sur refus 401', async () => {
  const api = { connecter: async () => ({ accessToken: 'acces', refreshToken: 'r', userId: id1, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); },
    creerCommande: async () => ({ reference: 'SF-ABCDE', jeton: JETON, idempotent: false }) };
  let effaces = 0; const g = new GestionSession(api, { lire: async () => null, ecrire: async () => {}, effacer: async () => { effaces++; } });
  await assert.rejects(g.creerCommande(payloadValide())); // pas connecté : rien n'est envoyé
  await g.connecter('a@example.invalid', 'x');
  const r = await g.creerCommande(payloadValide()); assert.deepEqual(r, { reference: 'SF-ABCDE', idempotent: false }); assert.ok(!JSON.stringify(r).includes(JETON));
  api.creerCommande = async () => { throw refusServeur(401, null); };
  const avant = effaces; await assert.rejects(g.creerCommande(payloadValide()), (e: unknown) => e instanceof ErreurCommande && e.genre === 'session');
  assert.equal(g.connectee, false); assert.equal(effaces, avant + 1);
});

test('commande : la clé change si le nom seul, le téléphone seul ou le compte change', () => {
  const t = creerTentative(generateur);
  const cle = (s: Partial<typeof saisie>, compte = 'A') => (preparerEnvoi(panier, plats, { ...saisie, ...s }, t, compte) as { ok: true; payload: CreationCommandePayload }).payload.cleIdempotence;
  const base = cle({});
  assert.equal(cle({}), base);
  const nomChange = cle({ nom: 'Autre Nom' }); assert.notEqual(nomChange, base);
  const tel = cle({ nom: 'Autre Nom', telephone: '655 00 00 00' }); assert.notEqual(tel, nomChange);
  const telSeul = cle({ telephone: '655 00 00 00' }); assert.notEqual(telSeul, base);
  assert.notEqual(cle({ telephone: '655 00 00 00' }, 'B'), telSeul);
});

test('commande : sans générateur aléatoire sûr, la clé est refusée avec un message (jamais de clé faible)', () => {
  const d = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try { assert.throws(() => genererCleIdempotence(), (e: unknown) => e instanceof ErreurCommande && /sécuriser/.test(e.message)); }
  finally { if (d) Object.defineProperty(globalThis, 'crypto', d); else delete (globalThis as { crypto?: unknown }).crypto; }
});

test('commande : délai de 20 s respecté (ni avant, ni après), envoi déclaré incertain', async (ctx) => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const p = payloadValide();
  const a = creerAuth((_u, o) => new Promise<Response>((_res, rej) => { o!.signal!.addEventListener('abort', () => rej(new DOMException('abandon', 'AbortError'))); }));
  const etat: { fini: unknown } = { fini: 'en cours' };
  const prom = a.creerCommande('t', p).then(() => { etat.fini = 'ok'; }, (e: unknown) => { etat.fini = e; });
  await new Promise<void>(r => setImmediate(r));
  ctx.mock.timers.tick(19999); await new Promise<void>(r => setImmediate(r));
  assert.equal(etat.fini, 'en cours');
  ctx.mock.timers.tick(1); await prom;
  const f: unknown = (() => etat.fini)(); assert.ok(f instanceof ErreurCommande && f.genre === 'reseau' && f.incertain);
});

test('session : déconnexion pendant la préparation de l’envoi, rien n’est envoyé', async () => {
  let envois = 0;
  const api = { connecter: async () => ({ accessToken: 'acces', refreshToken: 'r', userId: id1, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); },
    creerCommande: async () => { envois++; return { reference: 'SF-ABCDE', jeton: JETON, idempotent: false }; } };
  const g = new GestionSession(api, { lire: async () => null, ecrire: async () => {}, effacer: async () => {} });
  await g.connecter('a@example.invalid', 'x');
  const p = g.creerCommande(payloadValide()); const d = g.deconnecter();
  await assert.rejects(p); await d; assert.equal(envois, 0);
  assert.equal(g.identifiant, null);
});
