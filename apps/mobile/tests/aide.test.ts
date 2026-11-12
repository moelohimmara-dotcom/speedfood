import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIENS_AIDE, QUESTIONS_AIDE, adresseAppel, adresseWhatsApp, lireAide, lireNumeroAide } from '../src/connexion/aide.ts';

// Parité Kotlin (lot 1, A11) : « Aide et contact » = numéro WhatsApp de l'assistance (chiffres seuls, 8 à 15), centre d'aide du site, questions fréquentes, liens légaux.
const json = (corps: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(corps), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('le numéro d\'assistance est lu en chiffres seuls, de 8 à 15 chiffres', () => {
  assert.equal(lireNumeroAide({ ok: true, whatsapp: '224620000000' }), '224620000000');
  assert.equal(lireNumeroAide({ ok: true, whatsapp: '+224 620 00 00 00' }), '224620000000', 'les séparateurs sont retirés');
  assert.equal(lireNumeroAide({ ok: true, whatsapp: '1234567' }), null, 'moins de 8 chiffres');
  assert.equal(lireNumeroAide({ ok: true, whatsapp: '1'.repeat(16) }), null, 'plus de 15 chiffres');
});

test('toute réponse inattendue donne « pas de numéro », jamais une erreur affichée', () => {
  for (const mauvais of [null, undefined, [], 'texte', 12, { ok: false, whatsapp: '224620000000' }, { ok: true }, { ok: true, whatsapp: null }, { ok: true, whatsapp: 224620000000 }, { ok: true, whatsapp: 'abc' }])
    assert.equal(lireNumeroAide(mauvais), null);
});

test('adresses WhatsApp et appel : construites seulement avec un numéro valide', () => {
  assert.equal(adresseWhatsApp('224620000000'), 'https://wa.me/224620000000');
  assert.equal(adresseAppel('224620000000'), 'tel:+224620000000');
  assert.equal(adresseWhatsApp(null), null);
  assert.equal(adresseAppel(null), null);
  assert.equal(adresseWhatsApp('22462; DROP'), null, 'jamais un texte libre dans une adresse');
  assert.equal(adresseAppel('12'), null);
});

test('lecture de l\'aide : numéro, ou null si le réseau, le statut ou le format échouent', async () => {
  assert.equal(await lireAide((async () => json({ ok: true, whatsapp: '224620000000' })) as typeof fetch), '224620000000');
  assert.equal(await lireAide((async () => json({ ok: true, whatsapp: null })) as typeof fetch), null);
  assert.equal(await lireAide((async () => { throw new Error('réseau'); }) as typeof fetch), null);
  assert.equal(await lireAide((async () => json({ ok: true, whatsapp: '224620000000' }, { status: 500 })) as typeof fetch), null);
  assert.equal(await lireAide((async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch), null);
});

test('la lecture de l\'aide est publique : aucun jeton ni cookie, un seul essai', async () => {
  let appels = 0; let options: RequestInit | undefined; let url = '';
  await lireAide((async (u: string, o: RequestInit) => { appels++; url = u; options = o; return json({ ok: true, whatsapp: '224620000000' }); }) as unknown as typeof fetch);
  assert.equal(appels, 1);
  assert.match(url, /\/api\/v1\/aide$/);
  assert.equal(options?.credentials, 'omit');
  assert.equal((options?.headers as Record<string, string> | undefined)?.Authorization, undefined);
});

test('liens du site : tous en HTTPS sur le site de Speedfood', () => {
  for (const lien of Object.values(LIENS_AIDE)) assert.match(lien, /^https:\/\/speedfood-app\.moelohimmara\.workers\.dev\/[a-z-]+$/);
  assert.deepEqual(Object.keys(LIENS_AIDE).sort(), ['apropos', 'centre', 'conditions', 'confidentialite']);
});

test('questions fréquentes : renseignées, sans doublon, et fidèles à CETTE application', () => {
  assert.ok(QUESTIONS_AIDE.length >= 4);
  assert.equal(new Set(QUESTIONS_AIDE.map(q => q.question)).size, QUESTIONS_AIDE.length);
  for (const q of QUESTIONS_AIDE) {
    assert.ok(q.question.endsWith('?') || q.question.endsWith('.'), q.question);
    assert.ok(q.reponse.length >= 40 && q.reponse.length <= 600, q.question);
    // Cette appli n'a ni onglets ni connexion Google : une réponse ne doit pas décrire une fonction qui n'existe pas ici.
    // (Les « services Google du téléphone », nécessaires aux notifications, existent bel et bien : seul le compte ou la connexion Google est interdit.)
    assert.doesNotMatch(q.reponse, /onglet|connexion (avec )?Google|compte Google|e-mail ou Google|ou Google/i, q.question);
  }
});
