import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGE_MAX_DERNIERE_POSITION_MS, DELAI_POSITION_FRAICHE_MS, distanceMetres, lienCarte, lirePositionAvecRepli, type SourceLocalisation, phraseDistanceLivreur, situerClient, texteDistance, type DependancesPosition } from '../src/connexion/position-client.ts';

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

// ---------- Repli sur la dernière position connue (formulaire de commande) ----------
const FRAICHE = { latitude: 9.5412, longitude: -13.6781 };
const ANCIENNE = { latitude: 9.5371, longitude: -13.6702 };
type Appels = { fraiche: number; derniere: number; age: number[] };
const source = (o: Partial<SourceLocalisation> = {}, a: Appels = { fraiche: 0, derniere: 0, age: [] }): SourceLocalisation => ({
  positionActuelle: () => { a.fraiche++; return o.positionActuelle ? o.positionActuelle() : Promise.resolve(FRAICHE); },
  derniereConnue: (age: number) => { a.derniere++; a.age.push(age); return o.derniereConnue ? o.derniereConnue(age) : Promise.resolve(ANCIENNE); },
});
const jamaisRepondre = () => new Promise<never>(() => {});

test('repli : la position fraîche est préférée, la dernière connue n’est même pas demandée', async () => {
  const appels: Appels = { fraiche: 0, derniere: 0, age: [] };
  assert.deepEqual(await lirePositionAvecRepli(source({}, appels)), FRAICHE);
  assert.deepEqual(appels, { fraiche: 1, derniere: 0, age: [] });
});

test('repli : position fraîche en erreur, absente, invalide ou trop lente = dernière position connue (âge maximal transmis)', async () => {
  const cas: Partial<SourceLocalisation>[] = [
    { positionActuelle: async () => { throw new Error('service de localisation indisponible'); } },
    { positionActuelle: async () => null },
    { positionActuelle: async () => ({ latitude: NaN, longitude: 1 }) },
    { positionActuelle: async () => ({ latitude: 95, longitude: 1 }) },
    { positionActuelle: jamaisRepondre },
  ];
  for (const c of cas) {
    const appels: Appels = { fraiche: 0, derniere: 0, age: [] };
    assert.deepEqual(await lirePositionAvecRepli(source(c, appels), 20), ANCIENNE);
    assert.deepEqual(appels.age, [AGE_MAX_DERNIERE_POSITION_MS]);
  }
});

test('repli : ni fraîche ni connue valable = null, jamais d’exception ni de position hors bornes', async () => {
  const echec = async (): Promise<never> => { throw new Error('rien'); };
  assert.equal(await lirePositionAvecRepli(source({ positionActuelle: echec, derniereConnue: echec }), 20), null);
  assert.equal(await lirePositionAvecRepli(source({ positionActuelle: echec, derniereConnue: async () => null }), 20), null);
  assert.equal(await lirePositionAvecRepli(source({ positionActuelle: echec, derniereConnue: async () => ({ latitude: 0, longitude: 181 }) }), 20), null);
});

test('repli : les bornes du repli sont celles annoncées (8 s de position fraîche, 10 minutes d’âge)', () => {
  assert.equal(DELAI_POSITION_FRAICHE_MS, 8000); assert.equal(AGE_MAX_DERNIERE_POSITION_MS, 600000);
  assert.ok(DELAI_POSITION_FRAICHE_MS < 12000, 'sous le délai global de situerClient, sinon le repli n’aurait jamais lieu');
});

test('repli : branché au formulaire de commande seulement (situerClient + positionTelephoneAvecRepli)', async () => {
  const { readFileSync } = await import('node:fs');
  const lire = (p: string) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
  assert.match(lire('catalogue/CommandeReelle.tsx'), /situerClient\(positionTelephoneAvecRepli\)/);
  for (const ecran of ['catalogue/usePersonnalisation.ts', 'connexion/usePositionClient.ts']) assert.doesNotMatch(lire(ecran), /AvecRepli/, ecran + ' garde la lecture sans repli');
});
