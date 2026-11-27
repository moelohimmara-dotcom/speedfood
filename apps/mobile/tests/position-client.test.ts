import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMetres, lienCarte, phraseDistanceLivreur, situerClient, texteDistance, type DependancesPosition } from '../src/connexion/position-client.ts';

const RESTAURANT = { latitude: 9.51, longitude: -13.71 };
const ADRESSE = { latitude: 9.55, longitude: -13.68 };
const jamais = <T>() => new Promise<T>(() => {});
const deps = (p: Partial<DependancesPosition> = {}): DependancesPosition => ({ demanderPermission: async () => 'accordee', lirePosition: async () => RESTAURANT, ...p });

test('position du client : permission accordée et position lue : { ok, point }, copie propre du point', async () => {
  const lue = { latitude: 9.53, longitude: -13.7, precision: 12, altitude: 4 };
  const r = await situerClient(deps({ lirePosition: async () => lue }));
  assert.deepEqual(r, { genre: 'ok', point: { latitude: 9.53, longitude: -13.7 } });
});

test('position du client : permission refusée : { refusee }, et la position n’est jamais lue', async () => {
  let lectures = 0;
  const r = await situerClient(deps({ demanderPermission: async () => 'refusee', lirePosition: async () => { lectures++; return RESTAURANT; } }));
  assert.deepEqual(r, { genre: 'refusee' });
  assert.equal(lectures, 0);
});

test('position du client : module absent, panne ou position invalide : { indisponible }, jamais d’exception', async () => {
  const cas: Array<Partial<DependancesPosition>> = [
    { demanderPermission: async () => { throw new Error('module natif absent'); } },
    { lirePosition: async () => { throw new Error('localisation désactivée'); } },
    { lirePosition: async () => null },
    { lirePosition: async () => ({ latitude: Number.NaN, longitude: 0 }) },
    { lirePosition: async () => ({ latitude: 95, longitude: 0 }) },
    { lirePosition: async () => ({ latitude: 0, longitude: 181 }) },
  ];
  for (const c of cas) assert.deepEqual(await situerClient(deps(c)), { genre: 'indisponible' });
});

test('position du client : une lecture qui ne répond pas est tenue pour indisponible après le délai (jamais d’écran bloqué)', async () => {
  assert.deepEqual(await situerClient(deps({ lirePosition: () => jamais() }), 20), { genre: 'indisponible' });
  assert.deepEqual(await situerClient(deps({ demanderPermission: () => jamais() }), 20), { genre: 'indisponible' });
});

test('position du client : distance à vol d’oiseau (haversine)', () => {
  assert.equal(distanceMetres(RESTAURANT, RESTAURANT), 0);
  const d = distanceMetres(RESTAURANT, ADRESSE);
  assert.ok(d > 5400 && d < 5700, `distance ${d}`);
  assert.ok(Math.abs(d - distanceMetres(ADRESSE, RESTAURANT)) < 1e-6);
  assert.ok(Math.abs(distanceMetres({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111195) < 200);
});

test('position du client : distance dite à la mesure d’une position de téléphone', () => {
  assert.equal(texteDistance(0), 'moins de 50 m');
  assert.equal(texteDistance(49), 'moins de 50 m');
  assert.equal(texteDistance(50), 'environ 50 m');
  assert.equal(texteDistance(347), 'environ 350 m');
  assert.equal(texteDistance(994), 'environ 990 m');
  assert.equal(texteDistance(999), `environ ${(1).toLocaleString('fr-FR')} km`);
  assert.equal(texteDistance(1234), `environ ${(1.2).toLocaleString('fr-FR')} km`);
  assert.equal(texteDistance(12400), `environ ${(12).toLocaleString('fr-FR')} km`);
  assert.equal(texteDistance(-5), '');
  assert.equal(texteDistance(Number.NaN), '');
});

test('position du client : la phrase de distance exige les deux positions', () => {
  assert.equal(phraseDistanceLivreur(null, ADRESSE), null);
  assert.equal(phraseDistanceLivreur(RESTAURANT, null), null);
  assert.match(phraseDistanceLivreur(RESTAURANT, ADRESSE) ?? '', /^Le livreur est à environ .* km de vous\.$/);
});

test('lienCarte : ouvre le point exact dans l’application de cartes, sans clé', () => {
  assert.equal(lienCarte({ latitude: 9.5412, longitude: -13.6781 }), 'https://www.google.com/maps/search/?api=1&query=9.5412,-13.6781');
});
