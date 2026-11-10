import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ORIGINE_CONTROLE, PORTEURS_CONTROLE, creerTransportControle } from '../controle-reservation/transport.ts';

const chemin = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const lire = (p: string) => readFileSync(chemin(p), 'utf8');
const ID = '33333333-3333-4333-8333-333333333333';

test('M4a banc : le parcours complet (13 parcours : envoi, refus, fautes, capacité, plafond, restaurateur, motif) passe sur la base factice', () => {
  // Le banc importe les fichiers de l'API par le résolveur de l'API : le parcours tourne dans un processus séparé, sans serveur ni réseau.
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--import', pathToFileURL(chemin('../../api/scripts/enregistrer-resolveur.mjs')).href, chemin('../controle-reservation/parcours-reservation.mjs')], { cwd: chemin('../../..'), encoding: 'utf8', timeout: 180000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PARCOURS RESERVATION : 13 parcours OK/);
  assert.doesNotMatch(r.stdout, /ECHEC/);
});

test('M4a transport : seules les routes de réservation, vers le banc local, avec un porteur factice, sans suivi de redirection', async () => {
  const vus: { url: string; init: RequestInit }[] = [];
  const t = creerTransportControle((async (url: string, init: RequestInit) => { vus.push({ url: String(url), init }); return Response.json({ ok: true, reservations: [] }); }) as typeof fetch);
  const entetes = (porteur: string) => ({ headers: { Authorization: 'Bearer ' + porteur } });
  await assert.rejects(() => t.requeteControlee('https://speedfood-app.moelohimmara.workers.dev/api/v1/reservations', entetes(PORTEURS_CONTROLE[0])), /ORIGINE_REFUSEE/);
  await assert.rejects(() => t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/commandes', entetes(PORTEURS_CONTROLE[0])), /ORIGINE_REFUSEE/);
  await assert.rejects(() => t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/reservations', entetes('porteur-non-factice')), /IDENTITE_REFUSEE/);
  await assert.rejects(() => t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/reservations', {}), /IDENTITE_REFUSEE/);
  await assert.rejects(() => t.requeteControlee('http://user:mdp@127.0.0.1:8798/api/v1/reservations', entetes(PORTEURS_CONTROLE[0])), /ORIGINE_REFUSEE/);
  assert.equal(vus.length, 0, 'rien n’est parti');
  await t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/reservations', entetes(PORTEURS_CONTROLE[0]));
  await t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/reservations/' + ID + '/annuler', { method: 'POST', ...entetes(PORTEURS_CONTROLE[0]) });
  await t.requeteControlee(ORIGINE_CONTROLE + '/api/v1/restaurant/reservation-reglage', { method: 'PUT', ...entetes(PORTEURS_CONTROLE[2]) });
  assert.equal(vus.length, 3);
  for (const v of vus) { assert.equal(v.init.redirect, 'error'); assert.equal(v.init.credentials, 'omit'); }
});

test('M4a transport : les méthodes du VRAI client réseau sont réécrites vers le banc (jamais l’adresse de production)', async () => {
  const vus: string[] = [];
  const t = creerTransportControle((async (url: string) => { vus.push(String(url)); return Response.json({ ok: false, erreur: { code: 'INTROUVABLE', message: 'x' } }, { status: 404 }); }) as typeof fetch);
  const jeton = PORTEURS_CONTROLE[0];
  for (const appel of [() => t.api.listerReservations(jeton), () => t.api.lireReservation(jeton, ID), () => t.api.disponibiliteReservation(jeton, ID), () => t.api.reservationsRestaurateur(jeton, null), () => t.api.reglageReservation(jeton)]) await appel().catch(() => undefined);
  assert.ok(vus.length >= 5, vus.join(' '));
  for (const u of vus) assert.ok(u.startsWith('http://127.0.0.1:8798/api/v1/'), u);
});

test('M4a banc : serveur local durci, sans réseau sortant ni secret, journal sans coordonnées, README à jour', () => {
  const serveur = lire('../controle-reservation/serveur.mjs');
  assert.match(serveur, /listen\(8798, '127\.0\.0\.1'/);
  assert.ok(!/0\.0\.0\.0/.test(serveur));
  assert.ok(!/(https?:\/\/(?!127\.0\.0\.1)[a-z])/i.test(serveur.replace(/\/\/ .*$/gm, '')), 'aucune adresse externe dans le serveur du banc');
  assert.ok(!/process\.env|SERVICE_ROLE|supabase\.co|createClient/.test(serveur), 'aucune variable d’environnement ni clé');
  assert.ok(!/console\.(log|error)\((?!'Banc réservation)/.test(serveur), 'aucun journal de données');
  const transport = lire('../controle-reservation/transport.ts');
  assert.match(transport, /redirect: 'error'/); assert.match(transport, /credentials: 'omit'/);
  const readme = lire('../controle-reservation/README.md');
  for (const mot of ['reservation_ouverte', 'reservation_fermee', 'reservations_compte', 'restaurateur_demandes', 'restaurateur_reglage', 'incertain_applique', 'incertain_perdue', 'capacite_pleine', '/__etat', '8798', 'parcours-reservation.mjs', 'PARCOURS RESERVATION : 13']) assert.ok(readme.includes(mot), mot);
  for (const f of ['app.json', 'package.json', 'metro.config.cjs', 'tsconfig.json', 'index.tsx', 'identites.ts']) assert.ok(lire('../controle-reservation/' + f).length > 10, f);
});
