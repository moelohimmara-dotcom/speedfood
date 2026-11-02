import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { actionReglement, declarationVerrouillee, ErreurReglement, reglementAffichable, lireReglement, lireReglementOuNull, preparerDeclaration, refusDeclaration, verdictDeclaration, type ReglementSuivi } from '../src/connexion/reglement.ts';

const JETON = 'suivi-factice-' + 'J'.repeat(26);
const id = '00000000-0000-4000-8000-000000000001';
const enLigne = (etat: string | null = null) => ({ disponible: false, simulation: false, etat, operateur: null, totalGnf: null });
const brut = (surcharge: Record<string, unknown> = {}) => ({
  statut: 'non_demande', mode: null, reference: null, declareLe: null, recuLe: null, enLigne: enLigne(),
  options: [{ mode: 'orange_money', libelle: 'x', code: '123456' }, { mode: 'mtn_momo', libelle: 'x', code: 'AB1234' }, { mode: 'especes', libelle: 'x', code: null }],
  ...surcharge,
});
const lu = (surcharge: Record<string, unknown> = {}): ReglementSuivi => lireReglement(brut(surcharge));

// ---------- lecture stricte ----------
test('lecture : bloc valide lu, libellés fixes locaux (le texte du serveur n’est pas repris)', () => {
  const p = lu();
  assert.equal(p.options[0].libelle, 'Orange Money');
  assert.equal(p.options[2].code, null);
  assert.equal(p.enLigneEtat, null);
});
test('lecture : valeur inconnue = refus (statut, mode, mode d’option, état en ligne, code, doublon, trop d’options)', () => {
  const cas: Record<string, unknown>[] = [
    { statut: 'rembourse' }, { statut: 1 }, { mode: 'carte' }, { enLigne: enLigne('inconnu') }, { enLigne: null },
    { options: [{ mode: 'speedfood', code: null }] }, { options: [{ mode: 'speedfood', code: '123456' }] }, { options: [{ mode: 'orange_money', code: null }] }, { options: [{ mode: 'orange_money', code: 'a b' }] },
    { options: [{ mode: 'especes', code: '123456' }] }, { options: [{ mode: 'especes', code: null }, { mode: 'especes', code: null }] }, { options: 'x' },
    { options: [1, 2, 3, 4] }, { reference: 5 }, { declareLe: 'pas une date' },
  ];
  for (const c of cas) assert.throws(() => lu(c), /LECTURE_REGLEMENT_INVALIDE/, JSON.stringify(c));
  assert.equal(lireReglementOuNull(brut({ statut: 'rembourse' })), null);
  assert.equal(lireReglementOuNull(undefined), null);
  assert.equal(lireReglementOuNull('x'), null);
});

// ---------- que peut faire le client ----------
const ouvert = (paiement: ReglementSuivi | null, statutCommande = 'acceptee', propositionActive = false) => actionReglement({ statutCommande, propositionActive, paiement });
test('action : rien avant l’acceptation, aucun message (ni « ne payez rien »), pour toute commande non ouverte ou avec proposition en cours', () => {
  for (const s of ['en_attente', 'refusee', 'annulee', 'expiree']) assert.deepEqual(ouvert(lu(), s), { genre: 'rien', message: null }, s);
  assert.deepEqual(ouvert(lu(), 'acceptee', true), { genre: 'rien', message: null });
});
test('affichable : le bloc n’existe que commande acceptée, prête ou terminée et sans proposition en cours', () => {
  for (const s of ['acceptee', 'prete', 'terminee']) { assert.equal(reglementAffichable(s, false), true, s); assert.equal(reglementAffichable(s, true), false, s); }
  for (const s of ['en_attente', 'refusee', 'annulee', 'expiree', 'inconnu']) assert.equal(reglementAffichable(s, false), false, s);
});
test('verrou : après un verdict incertain sans relecture réussie, déclaration verrouillée jusqu’à une relecture réussie (compteur différent)', () => {
  const aveugle = verdictDeclaration({ erreur: refusDeclaration(503), mode: 'especes', reference: null, relu: undefined });
  const relu = verdictDeclaration({ erreur: refusDeclaration(503), mode: 'especes', reference: null, relu: lu() });
  assert.equal(declarationVerrouillee(aveugle, 4, 4), true);
  assert.equal(declarationVerrouillee(aveugle, 4, 5), false, 'relecture réussie : déverrouillé');
  assert.equal(declarationVerrouillee(relu, 4, 4), false, 'relecture réussie sans la déclaration : réessayer permis');
  assert.equal(declarationVerrouillee(null, null, 0), false);
  for (const v of [verdictDeclaration({ erreur: null, mode: 'especes', reference: null, relu: undefined }), verdictDeclaration({ erreur: refusDeclaration(409), mode: 'especes', reference: null, relu: undefined })]) assert.equal(declarationVerrouillee(v, 4, 4), false, v.genre);
});
test('action : acceptée, prête ou terminée, rien déclaré = déclarer avec les trois modes', () => {
  for (const s of ['acceptee', 'prete', 'terminee']) {
    const a = ouvert(lu(), s);
    assert.equal(a.genre, 'declarer');
    assert.deepEqual((a as { options: { mode: string }[] }).options.map(o => o.mode), ['orange_money', 'mtn_momo', 'especes']);
  }
});
test('action : déjà déclaré (déclaré, espèces, non retrouvé) = modifier avec le libellé du statut', () => {
  for (const [statut, texte] of [['declare', /en attente de confirmation du restaurant/], ['especes', /espèces/], ['non_recu', /non retrouvé/]] as const) {
    const a = ouvert(lu({ statut, mode: 'orange_money' }));
    assert.equal(a.genre, 'modifier'); assert.match(a.message, texte);
  }
});
test('action : reçu par le restaurant = rien, libellé « reçu » (jamais de nouvelle déclaration)', () => {
  const a = ouvert(lu({ statut: 'recu', mode: 'orange_money' }));
  assert.deepEqual(a, { genre: 'rien', message: 'Paiement reçu par le restaurant' });
});
test('action : paiement en ligne actif ou mode speedfood = rien ; en ligne échoué/expiré ne bloque pas', () => {
  for (const etat of ['cree', 'en_attente', 'confirme', 'libere', 'en_litige']) assert.equal(ouvert(lu({ enLigne: enLigne(etat) })).genre, 'rien', etat);
  assert.equal(ouvert(lu({ mode: 'speedfood' })).genre, 'rien');
  for (const etat of ['echoue', 'expire', 'annule', 'rembourse']) assert.equal(ouvert(lu({ enLigne: enLigne(etat) })).genre, 'declarer', etat);
});
test('action : `enLigne.disponible` vrai est ignoré (aucun paiement en ligne proposé)', () => {
  const a = ouvert(lu({ enLigne: { ...enLigne(), disponible: true } }));
  assert.equal(a.genre, 'declarer');
});
test('action : sans option = rien ; bloc illisible (null) = indisponible seulement si la commande est acceptée', () => {
  assert.equal(ouvert(lu({ options: [] })).genre, 'rien');
  assert.equal(ouvert(null).genre, 'indisponible');
  assert.deepEqual(ouvert(null, 'en_attente').genre, 'rien');
});

// ---------- préparation ----------
const options = lu().options;
test('préparation : mobile money, référence nettoyée ou vide ; espèces ne portent jamais de référence', () => {
  assert.deepEqual(preparerDeclaration('orange_money', '  OM-123456 ', options), { ok: true, mode: 'orange_money', reference: 'OM-123456' });
  assert.deepEqual(preparerDeclaration('mtn_momo', '', options), { ok: true, mode: 'mtn_momo', reference: null });
  assert.deepEqual(preparerDeclaration('especes', 'REF-1234', options), { ok: true, mode: 'especes', reference: null });
});
test('préparation : référence de 3 ou 41 caractères, caractères spéciaux : refusée ; bornes 4 et 40 acceptées', () => {
  for (const ref of ['abc', 'a'.repeat(41), 'OM<1234>', 'OM#1234']) assert.equal(preparerDeclaration('orange_money', ref, options).ok, false, ref);
  for (const ref of ['abcd', 'a'.repeat(40)]) assert.equal(preparerDeclaration('orange_money', ref, options).ok, true, ref);
});
test('préparation : mode absent des options, inconnu ou « speedfood » : refusé', () => {
  const seulesEspeces = options.filter(o => o.mode === 'especes');
  assert.equal(preparerDeclaration('orange_money', '', seulesEspeces).ok, false);
  for (const m of ['speedfood', 'carte', '']) assert.equal(preparerDeclaration(m, '', options).ok, false);
});

// ---------- table des refus ----------
test('refus : statuts vers messages français fixes, incertain seulement pour 5xx', () => {
  assert.match(refusDeclaration(400).message, /n’a pas été acceptée/);
  assert.match(refusDeclaration(404).message, /introuvable/);
  assert.match(refusDeclaration(409).message, /ne peut plus être déclaré/);
  assert.equal(refusDeclaration(429).genre, 'limite');
  for (const s of [400, 404, 409, 429, 401, 418]) assert.equal(refusDeclaration(s).incertain, false, String(s));
  for (const s of [500, 502, 503]) assert.equal(refusDeclaration(s).incertain, true, String(s));
});

// ---------- verdict ----------
const relu = (surcharge: Record<string, unknown>) => lu(surcharge);
test('verdict : succès du serveur = confirmé', () => {
  assert.equal(verdictDeclaration({ erreur: null, mode: 'orange_money', reference: null, relu: undefined }).genre, 'confirme');
});
test('verdict : réponse inconnue + suivi relu montrant la même déclaration = confirmé (pas de doublon proposé)', () => {
  const v = verdictDeclaration({ erreur: refusDeclaration(503), mode: 'orange_money', reference: 'OM-123456', relu: relu({ statut: 'declare', mode: 'orange_money', reference: 'OM-123456' }) });
  assert.equal(v.genre, 'confirme');
  assert.equal(verdictDeclaration({ erreur: refusDeclaration(503), mode: 'especes', reference: null, relu: relu({ statut: 'especes', mode: 'especes' }) }).genre, 'confirme');
});
test('verdict : réponse inconnue + suivi relu sans la déclaration (autre mode, autre référence, rien) = réessayer proposé', () => {
  for (const r of [relu({}), relu({ statut: 'declare', mode: 'mtn_momo', reference: 'OM-123456' }), relu({ statut: 'declare', mode: 'orange_money', reference: 'AUTRE-111' })]) {
    const v = verdictDeclaration({ erreur: refusDeclaration(503), mode: 'orange_money', reference: 'OM-123456', relu: r });
    assert.deepEqual([v.genre, (v as { reessayer: boolean }).reessayer], ['incertain', true]);
  }
});
test('verdict : réponse inconnue + relecture impossible = PAS de « Réessayer » (jamais à l’aveugle)', () => {
  const v = verdictDeclaration({ erreur: refusDeclaration(503), mode: 'orange_money', reference: null, relu: undefined });
  assert.deepEqual([v.genre, (v as { reessayer: boolean }).reessayer], ['incertain', false]);
});
test('verdict : refus certain jamais converti en succès, même si le suivi relu montre une déclaration identique', () => {
  const v = verdictDeclaration({ erreur: refusDeclaration(409), mode: 'orange_money', reference: 'OM-123456', relu: relu({ statut: 'declare', mode: 'orange_money', reference: 'OM-123456' }) });
  assert.equal(v.genre, 'refus');
});
test('verdict : session terminée prime', () => {
  assert.equal(verdictDeclaration({ erreur: null, sessionTerminee: 'Votre session a pris fin.', mode: 'especes', reference: null, relu: undefined }).genre, 'session');
});

// ---------- client ----------
test('client : corps exact {jeton, mode, reference}, jeton absent de l’URL, credentials omit, un seul essai', async () => {
  const vus: { url: string; init?: RequestInit }[] = [];
  const a = creerAuth(async (url, init) => { vus.push({ url: String(url), init }); return Response.json({ ok: true }); });
  await a.declarerPaiement(JETON, 'orange_money', 'OM-123456');
  assert.equal(vus.length, 1);
  assert.ok(vus[0].url.endsWith('/api/v1/suivi/paiement')); assert.ok(!vus[0].url.includes(JETON));
  assert.equal(vus[0].init?.method, 'POST'); assert.equal(vus[0].init?.credentials, 'omit');
  assert.deepEqual(JSON.parse(String(vus[0].init?.body)), { jeton: JETON, mode: 'orange_money', reference: 'OM-123456' });
  assert.equal((vus[0].init?.headers as Record<string, string>).Authorization, undefined, 'aucune identité : le jeton de suivi est la clé');
});
test('client : sans référence, le corps ne porte pas de champ référence ; espèces refusées avec une référence avant tout réseau', async () => {
  let corps = '';
  const a = creerAuth(async (_u, init) => { corps = String(init?.body); return Response.json({ ok: true }); });
  await a.declarerPaiement(JETON, 'especes', null);
  assert.deepEqual(JSON.parse(corps), { jeton: JETON, mode: 'especes' });
  let appels = 0;
  const b = creerAuth(async () => { appels++; return Response.json({ ok: true }); });
  await assert.rejects(b.declarerPaiement(JETON, 'especes', 'REF-1234'), ErreurReglement);
  await assert.rejects(b.declarerPaiement(JETON, 'speedfood', null), ErreurReglement);
  await assert.rejects(b.declarerPaiement(JETON, 'orange_money', 'ab'), ErreurReglement);
  await assert.rejects(b.declarerPaiement('', 'especes', null), ErreurReglement);
  assert.equal(appels, 0);
});
test('client : refus 400/404/409/429 = refus certain ; 500 = incertain ; jamais de relance automatique', async () => {
  for (const [statut, incertain] of [[400, false], [404, false], [409, false], [429, false], [500, true], [503, true]] as const) {
    let appels = 0;
    const a = creerAuth(async () => { appels++; return Response.json({ ok: false, erreur: { code: 'X', message: 'texte brut ' + JETON } }, { status: statut }); });
    await assert.rejects(a.declarerPaiement(JETON, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.incertain === incertain && !e.message.includes(JETON) && !e.message.includes('texte brut'), String(statut));
    assert.equal(appels, 1, 'un seul essai : ' + statut);
  }
});
test('client : le corps d’une réponse de refus est annulé (connexion libérée), jamais lu', async () => {
  let annule = false;
  const flux = new ReadableStream({ cancel() { annule = true; } });
  const a = creerAuth(async () => new Response(flux, { status: 409, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(a.declarerPaiement(JETON, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.genre === 'refus');
  assert.equal(annule, true);
});
test('client : réseau coupé = incertain ; délai dépassé = incertain', async () => {
  const a = creerAuth(async () => { throw new TypeError('network ' + JETON); });
  await assert.rejects(a.declarerPaiement(JETON, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.incertain && e.genre === 'reseau' && !e.message.includes(JETON));
  const lent = creerAuth((_u, init) => new Promise<Response>((_r, rejet) => { init?.signal?.addEventListener('abort', () => rejet(new Error('abort'))); }), 30);
  await assert.rejects(lent.declarerPaiement(JETON, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.incertain);
});
test('client : 200 sans {ok:true}, non JSON ou trop gros = incertain (la déclaration a pu passer)', async () => {
  const corps: Array<() => Response> = [
    () => Response.json({ ok: false }), () => Response.json([]), () => new Response('ok', { headers: { 'content-type': 'text/plain' } }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }), () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json', 'content-length': '999999' } }),
  ];
  for (const f of corps) {
    const a = creerAuth(async () => f());
    await assert.rejects(a.declarerPaiement(JETON, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.incertain && e.genre === 'reponse_invalide');
  }
});
test('client : ni le jeton ni la référence dans les journaux', async () => {
  const lignes: string[] = []; const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(' ')); };
  try { await creerAuth(async () => { throw new Error(JETON); }).declarerPaiement(JETON, 'orange_money', 'OM-123456').catch(() => {}); } finally { Object.assign(console, origine); }
  assert.ok(!lignes.join('\n').includes(JETON) && !lignes.join('\n').includes('OM-123456'));
});

// ---------- suivi : lecture du bloc paiement ----------
const suiviBase = { reference: 'SF-ESSAI', statut: 'acceptee', etatDerive: 'acceptee', mode: 'retrait', estTest: true, restaurant: { nom: 'Essai' }, sousTotal: 25000, fraisLivraisonEstime: 0, pretEstimeeLe: null, propositionActive: null, lignes: [] };
test('suivi : le bloc paiement est lu ; absent ou invalide = null sans casser le reste du suivi', async () => {
  const lire = async (paiement: unknown) => creerAuth(async () => Response.json({ ok: true, suivi: { ...suiviBase, ...(paiement === undefined ? {} : { paiement }) } })).suivi(JETON);
  assert.equal((await lire(brut())).paiement?.statut, 'non_demande');
  assert.equal((await lire(undefined)).paiement, null);
  const s = await lire(brut({ statut: 'inconnu' }));
  assert.equal(s.paiement, null); assert.equal(s.reference, 'SF-ESSAI');
});

// ---------- session ----------
function session(api: Record<string, unknown>) {
  const a = { connecter: async () => ({ accessToken: 'acces', refreshToken: 'r', userId: id, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {},
    commandes: async () => [{ id, reference: 'SF-ESSAI', creeLe: '2026-11-01T11:00:00Z', restaurantNom: 'Essai', mode: 'retrait', statut: 'acceptee', totalGnf: 25000, estTest: true, jeton: JETON }], suivi: async () => { throw Error(); }, ...api };
  return new GestionSession(a as never, { lire: async () => null, ecrire: async () => {}, effacer: async () => {} });
}
test('session : la déclaration exige un compte connecté et une clé de suivi connue ; le jeton ne quitte pas la session', async () => {
  const envoyes: unknown[][] = [];
  const g = session({ declarerPaiement: async (...a: unknown[]) => { envoyes.push(a); } });
  await assert.rejects(g.declarerPaiement(id, 'especes', null), /Connectez-vous/);
  await g.connecter('essai@example.invalid', 'factice');
  await assert.rejects(g.declarerPaiement(id, 'especes', null), /Actualisez vos commandes/);
  assert.equal(envoyes.length, 0);
  await g.commandes();
  await g.declarerPaiement(id, 'orange_money', 'OM-123456');
  assert.deepEqual(envoyes, [[JETON, 'orange_money', 'OM-123456']]);
  await g.deconnecter();
  await assert.rejects(g.declarerPaiement(id, 'especes', null), /Connectez-vous/);
  assert.equal(envoyes.length, 1);
});
test('session : une erreur de déclaration est transmise telle quelle, sans nouvel essai', async () => {
  let appels = 0;
  const g = session({ declarerPaiement: async () => { appels++; throw refusDeclaration(503); } });
  await g.connecter('essai@example.invalid', 'factice'); await g.commandes();
  await assert.rejects(g.declarerPaiement(id, 'especes', null), (e: unknown) => e instanceof ErreurReglement && e.incertain);
  assert.equal(appels, 1);
});
