import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateLisible } from '../src/design/format.ts';
import { avecNouveauxEssais } from '../src/catalogue/nouveaux-essais.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// --- dates lisibles (essai de l'émulateur du 18/11/2026 : « Dernière lecture : 18/11/2026 14:30:00 »)
test('dateLisible : heure de Conakry (UTC), sans secondes, mois en français', () => {
  assert.equal(dateLisible('2026-11-18T14:30:45.000Z'), '18 nov. à 14:30');
  assert.equal(dateLisible('2026-01-05T09:05:00Z'), '5 janv. à 09:05');
  assert.equal(dateLisible('2026-08-31T23:59:59Z'), '31 août à 23:59');
  assert.equal(dateLisible(Date.UTC(2026, 11, 25, 0, 0)), '25 déc. à 00:00');
  assert.equal(dateLisible('pas une date'), 'date inconnue');
  assert.ok(!/\d{2}:\d{2}:\d{2}/.test(dateLisible('2026-11-18T14:30:45Z')), 'jamais de secondes');
});

// --- nouveaux essais silencieux
test('avecNouveauxEssais : réussit au deuxième essai sans erreur visible, attend les délais prévus', async () => {
  const attentes: number[] = [];
  let appels = 0;
  const r = await avecNouveauxEssais(async () => { appels++; if (appels < 2) throw Error('base pas prête'); return 'ok'; }, [300, 900], async ms => { attentes.push(ms); });
  assert.equal(r, 'ok');
  assert.equal(appels, 2);
  assert.deepEqual(attentes, [300]);
});
test('avecNouveauxEssais : relève la dernière erreur après tous les essais', async () => {
  let appels = 0;
  await assert.rejects(avecNouveauxEssais(async () => { appels++; throw Error('échec ' + appels); }, [1, 2], async () => undefined), /échec 3/);
  assert.equal(appels, 3, 'un essai de départ et deux nouveaux');
});
test('avecNouveauxEssais : sans échec, un seul appel, aucune attente', async () => {
  let attentes = 0;
  assert.equal(await avecNouveauxEssais(async () => 7, [300, 900], async () => { attentes++; }), 7);
  assert.equal(attentes, 0);
});

// --- câblage et textes
test('panier : la restauration passe par les nouveaux essais, et un panier vide n’affiche aucun message', () => {
  const hook = lire('../src/catalogue/usePanierReel.ts');
  assert.match(hook, /avecNouveauxEssais\(async \(\) => \{ const s = await ouvrirPanierReel\(\); return \{ s, p: await s\.charger\(\) \}; \}, \[300, 900\]\)/);
  assert.match(hook, /setStatut\(p\.lignes\.length > 0 \? 'Panier restauré sur cet appareil' : ''\)/);
  assert.match(hook, /console\.error\('panier_restauration_echec'/, 'l’échec définitif laisse une trace courte pour le diagnostic');
});
test('panier : « Vider le panier ? » est visible tout de suite, avant la liste, pas sous le bouton Commander', () => {
  const vue = lire('../src/catalogue/PanierReelVue.tsx');
  const confirmation = vue.indexOf('Vider le panier ?');
  assert.ok(confirmation > 0);
  assert.ok(confirmation < vue.indexOf('bilan.lignes.map'), 'la confirmation précède la liste des plats');
  assert.ok(confirmation < vue.indexOf('titre="Commander"'), 'et le bouton Commander');
  assert.ok(vue.includes('Garder le panier') && vue.includes('Confirmer le panier vide'));
});
test('textes du panier : « panier » partout (jamais « sélection »), pas de jargon technique', () => {
  for (const f of ['../src/catalogue/PanierReelVue.tsx', '../src/catalogue/CatalogueReel.tsx', '../src/catalogue/CommandeReelle.tsx']) {
    const t = lire(f);
    assert.ok(!/votre sélection|Vider votre sélection/i.test(t), f + ' : « sélection » à la place de « panier »');
    assert.ok(!t.includes('le stockage du panier'), f + ' : jargon « stockage du panier »');
    assert.ok(!t.includes('Dernière lecture :') && !t.includes('Menu relu le'), f + ' : jargon « lecture »');
  }
  assert.ok(lire('../src/catalogue/PanierReelVue.tsx').includes('Réessayer l’enregistrement du panier'));
});
test('retour Android : depuis Commandes, Panier ou Compte on revient à Restaurants', () => {
  const t = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(t, /if \(selection \|\| onglet === 'restaurants' \|\| Platform\.OS === 'web'\) return;[\s\S]{0,260}choisirOnglet\('restaurants'\); return true;/);
});
