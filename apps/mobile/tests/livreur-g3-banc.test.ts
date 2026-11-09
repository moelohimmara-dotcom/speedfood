import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ORIGINE_CONTROLE, PORTEURS_CONTROLE, creerTransportControle } from '../controle-livreur/transport.ts';

const chemin = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const lire = (p: string) => readFileSync(chemin(p), 'utf8');
const OFFRE = '22222222-2222-4222-8222-222222222222';
const LIV = '11111111-1111-4111-8111-111111111111';

test('G3c banc : le parcours complet (offre, course, code, échec, incertain, course changée, propre, lente) passe sur la base factice', () => {
  // Le banc importe les fichiers de l'API par le résolveur de l'API : le parcours tourne dans un processus séparé, sans serveur ni réseau.
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--import', pathToFileURL(chemin('../../api/scripts/enregistrer-resolveur.mjs')).href, chemin('../controle-livreur/parcours-g3.mjs')], { cwd: chemin('../../..'), encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PARCOURS G3 : 11 parcours OK/);
  assert.doesNotMatch(r.stdout, /ECHEC/);
});

test('G3c transport : offre et course ne sortent que vers le banc local, avec un porteur factice, sans suivi de redirection', async () => {
  const vus: { url: string; init: RequestInit }[] = [];
  const t = creerTransportControle((async (url: string, init: RequestInit) => { vus.push({ url: String(url), init }); return Response.json({ ok: true }); }) as typeof fetch);
  await assert.rejects(() => t.repondreOffreLivreur('porteur-non-factice', OFFRE, 'acceptee'));
  await assert.rejects(() => t.avancerCourseLivreur('porteur-non-factice', { livraisonId: LIV, vers: 'recuperee' }));
  assert.equal(vus.length, 0, 'aucun appel avec un porteur non factice');
  await t.repondreOffreLivreur(PORTEURS_CONTROLE[0], OFFRE, 'acceptee');
  await t.avancerCourseLivreur(PORTEURS_CONTROLE[1], { livraisonId: LIV, vers: 'recuperee' });
  assert.equal(vus.length, 2);
  assert.equal(vus[0].url, ORIGINE_CONTROLE + '/api/v1/livreur/offre');
  assert.equal(vus[1].url, ORIGINE_CONTROLE + '/api/v1/livreur/course');
  for (const v of vus) { assert.equal(v.init.redirect, 'error'); assert.equal(v.init.credentials, 'omit'); assert.match(String(new Headers(v.init.headers).get('Authorization')), /^Bearer controle[AB]\./); }
  assert.deepEqual(JSON.parse(String(vus[1].init.body)), { livraisonId: LIV, vers: 'recuperee' });
  // La surface historique ne laisse toujours pas passer les chemins d'écriture.
  await assert.rejects(() => t.requete(ORIGINE_CONTROLE + '/api/v1/livreur/course', { method: 'POST' }));
  await assert.rejects(() => t.requete(ORIGINE_CONTROLE + '/api/v1/livreur/offre', { method: 'POST' }));
});

test('G3c banc : réponse du banc hors contrat (client trop tôt, champ en trop) refusée par le parseur du vrai transport', async () => {
  const etat = (course: unknown) => Response.json({ ok: true, etat: { fiche: { nom: 'L', statut: 'en_course', vehicule: 'moto', cycle: 'actif', motifCycle: null, restaurantNom: null }, offre: null, course } });
  const course = { livraisonId: LIV, statut: 'vers_restaurant', mode: 'speedfood', libelle: 'En route vers le restaurant', commandeReference: 'SF-1', restaurantNom: 'R', fraisGnf: 7000, etapesPossibles: ['recuperee'], client: { nom: 'C', telephone: '1', adresse: null } };
  const t = creerTransportControle((async () => etat(course)) as typeof fetch);
  await assert.rejects(() => t.etatLivreur(PORTEURS_CONTROLE[0]), /illisible/);
  const t2 = creerTransportControle((async () => etat({ ...course, client: null, arriveePoint: { latitude: 1, longitude: 2 } })) as typeof fetch);
  await assert.rejects(() => t2.etatLivreur(PORTEURS_CONTROLE[0]), /illisible/);
  const t3 = creerTransportControle((async () => etat({ ...course, client: null })) as typeof fetch);
  assert.equal((await t3.etatLivreur(PORTEURS_CONTROLE[0]))?.course?.livraisonId, LIV);
});

test('G3c banc : serveur local durci, sans réseau sortant ni secret, README à jour', () => {
  const serveur = lire('../controle-livreur/serveur.mjs');
  assert.doesNotMatch(serveur, /libelleLivraison/, 'reste de G3a retiré');
  assert.match(serveur, /PROJECTION_NON_PREVUE/); assert.match(serveur, /FILTRE_NON_PREVU/); assert.match(serveur, /REQUETE_SANS_FILTRE/); assert.match(serveur, /CLIENT_AVANT_RECUPERATION/);
  assert.match(serveur, /const PROJECTIONS = new Set\(\[[^\]]*'id'/);
  assert.doesNotMatch(serveur, /https?:\/\/(?!127\.0\.0\.1)/); assert.doesNotMatch(serveur, /process\.env|\.env\b|service_role|sb_secret|createClient/);
  assert.doesNotMatch(serveur, /(^|[^.\w])fetch\(/, 'aucun fetch sortant (app.fetch de Hono mis à part)');
  const index = lire('../controle-livreur/index.tsx');
  assert.match(index, /repondreOffreLivreur: transport\.repondreOffreLivreur/); assert.match(index, /avancerCourseLivreur: transport\.avancerCourseLivreur/);
  const readme = lire('../controle-livreur/README.md');
  for (const attendu of ['parcours-g3.mjs', 'g3_offre', 'g3_course_vers_client', 'g3_propre', 'g3_lente', '/__faute', '/__changer-course', 'incertain_applique', 'adb reverse', 'set EXPO_NO_DOTENV=1']) assert.ok(readme.includes(attendu), attendu);
});
