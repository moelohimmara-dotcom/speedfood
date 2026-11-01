import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoderEtat, encoderEtat, etatLocalVide } from '../src/stockage/codec.ts';
import { SessionLocale } from '../src/stockage/session.ts';
import { plats, restaurants } from '../src/donnees/demo.ts';
const exemple = () => ({ panier: { restaurantId: plats[0].restaurantId, lignes: [{ platId: plats[0].id, quantite: 2 }] }, favoris: [restaurants[0].id] });

test('stockage : aller-retour versionné, uniquement les champs autorisés', () => {
  const etat = { ...exemple(), prix: 1, jeton: 'factice-inutile' };
  const texte = encoderEtat(etat);
  assert.deepEqual(decoderEtat(texte), exemple());
  assert.ok(!texte.includes('prix') && !texte.includes('jeton') && !texte.includes('factice-inutile'));
  assert.deepEqual(decoderEtat(null), etatLocalVide());
});
test('stockage : corruption et version future refusées sans remplacer par un état vide', () => {
  assert.throws(() => decoderEtat('invalide'), /DONNEES_LOCALES_INVALIDES/);
  assert.throws(() => decoderEtat(JSON.stringify({ version: 2, ...exemple() })), /VERSION_LOCALE_INCOMPATIBLE/);
  assert.throws(() => decoderEtat('x'.repeat(65537)), /DONNEES_LOCALES_INVALIDES/);
});
test('stockage : quantités, restaurant et favoris vérifiés au chargement', () => {
  for (const e of [
    { ...exemple(), panier: { ...exemple().panier, lignes: [{ platId: plats[0].id, quantite: 1.5 }] } },
    { ...exemple(), panier: { ...exemple().panier, restaurantId: restaurants[1].id } },
    { ...exemple(), favoris: ['inconnu'] },
  ]) assert.throws(() => decoderEtat(JSON.stringify({ version: 1, ...e })), /DONNEES_LOCALES_INVALIDES/);
});
test('session : aucune sauvegarde avant la fin du chargement, même si la lecture échoue', async () => {
  let ecritures = 0;
  const session = new SessionLocale({ lire: async () => { throw Error('detail-factice'); }, ecrire: async () => { ecritures++; } });
  await assert.rejects(session.sauver(exemple()), /STOCKAGE_NON_CHARGE/);
  await assert.rejects(session.charger());
  await assert.rejects(session.sauver(exemple()), /STOCKAGE_NON_CHARGE/);
  assert.equal(ecritures, 0);
});
test('session : écritures lentes sérialisées, la dernière intention reste la dernière', async () => {
  let liberation!: () => void;
  const attente = new Promise<void>(r => { liberation = r; });
  const textes: string[] = [];
  let appels = 0;
  const session = new SessionLocale({ lire: async () => null, ecrire: async t => { appels++; if (appels === 1) await attente; textes.push(t); } });
  await session.charger();
  const a = session.sauver(exemple());
  const b = session.sauver(etatLocalVide());
  await new Promise<void>(r => setImmediate(r));
  assert.equal(textes.length, 0);
  liberation(); await Promise.all([a, b]);
  assert.deepEqual(textes.map(decoderEtat), [exemple(), etatLocalVide()]);
});
test('session : une erreur n’est pas rejouée et ne bloque pas une action ultérieure explicite', async () => {
  let appels = 0;
  const session = new SessionLocale({ lire: async () => null, ecrire: async () => { appels++; if (appels === 1) throw Error('panne'); } });
  await session.charger();
  await assert.rejects(session.sauver(exemple()));
  assert.equal(appels, 1);
  await session.sauver(etatLocalVide());
  assert.equal(appels, 2);
});
