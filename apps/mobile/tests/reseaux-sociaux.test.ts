import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEMIN_RETOUR_SOCIAL, fournisseursActifsDepuis, lireCodeRetourSocial, preparerVerificateur, urlConnexionSociale, versBase64Url,
} from '../src/connexion/reseaux-sociaux.ts';

const SUPA = 'https://projet.supabase.co/auth/v1';
const SITE = 'https://speedfood.dev';

test('sociaux : adresses de depart PKCE (facebook avec ses portees, retour sur la page relais du site)', () => {
  const fb = urlConnexionSociale(SUPA, SITE, 'facebook', 'DEF123');
  assert.ok(fb.startsWith(SUPA + '/authorize?provider=facebook&scopes=email%20public_profile&code_challenge=DEF123&code_challenge_method=s256&redirect_to='));
  assert.ok(fb.includes(encodeURIComponent(SITE + CHEMIN_RETOUR_SOCIAL)));
  const gg = urlConnexionSociale(SUPA, SITE, 'google', 'DEF123');
  assert.ok(gg.startsWith(SUPA + '/authorize?provider=google&code_challenge=DEF123&code_challenge_method=s256&redirect_to='));
  assert.ok(!gg.includes('scopes='));
});

test('sociaux : verificateur PKCE en base64url sans remplissage, empreinte convertie', () => {
  const octets = new Uint8Array(32).fill(255);
  const v = preparerVerificateur(octets);
  if (v === null) assert.fail('verificateur refuse a tort');
  assert.equal(v.length, 43);
  assert.ok(!/[+/=]/.test(v));
  assert.equal(versBase64Url('ab+cd/ef=='), 'ab-cd_ef');
  assert.equal(preparerVerificateur(new Uint8Array(16)), null);
});

test('sociaux : fournisseurs actifs lus des reglages ; facebook exige en plus l interrupteur de l equipe', () => {
  const reglages = { external: { google: true, facebook: true, apple: false } };
  assert.deepEqual([...fournisseursActifsDepuis(reglages, true)].sort(), ['facebook', 'google']);
  assert.deepEqual([...fournisseursActifsDepuis(reglages, false)], ['google']);
  assert.deepEqual([...fournisseursActifsDepuis({ external: {} }, true)], []);
  assert.deepEqual([...fournisseursActifsDepuis(null, true)], []);
  assert.deepEqual([...fournisseursActifsDepuis({ external: { google: 'oui' } }, true)], [], 'une valeur non booleenne ne vaut pas actif');
});

test('sociaux : code de retour lu seulement sur le retour attendu, jamais sur une erreur', () => {
  assert.equal(lireCodeRetourSocial(SITE + '/auth/application?code=CODE123', SITE), 'CODE123');
  assert.equal(lireCodeRetourSocial('speedfood://auth/application?code=CODE123', SITE), 'CODE123');
  assert.equal(lireCodeRetourSocial('speedfood-demo://auth/application?code=CODE123', SITE), 'CODE123');
  assert.equal(lireCodeRetourSocial(SITE + '/auth/application?error=access_denied&code=CODE123', SITE), null);
  assert.equal(lireCodeRetourSocial('https://exemple.com/auth/application?code=CODE123', SITE), null);
  assert.equal(lireCodeRetourSocial(SITE + '/compte?code=CODE123', SITE), null);
  assert.equal(lireCodeRetourSocial(SITE + '/auth/application', SITE), null);
  assert.equal(lireCodeRetourSocial('pas une adresse', SITE), null);
});
