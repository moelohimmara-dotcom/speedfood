import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PISTES, destinationPiste, doitProposerEntree, type EtatEntree } from '../src/connexion/entree.ts';
// Parité Kotlin (G17, `EntreeScreen`) : premier écran « Qui êtes-vous ? » avec des pistes séparées (client, restaurateur, livreur) et un lien Équipe Speedfood.
// Chaque piste mène à son espace si le compte en a le droit ; sinon un message précis, comme l'ancienne appli. Le droit réel reste décidé par le serveur à chaque route.
const nonConnecte: EtatEntree = { connectee: false, roles: null };
const roles = (r: Partial<{ restaurateur: { restaurant: string } | null; livreur: boolean; equipe: string | null }> = {}): EtatEntree => ({ connectee: true, roles: { restaurateur: null, livreur: false, equipe: null, ...r } });
test('les pistes proposées : client, restaurateur, livreur, puis Équipe Speedfood à part', () => {
  assert.deepEqual(PISTES.map(p => p.id), ['client', 'restaurateur', 'livreur']);
  for (const p of PISTES) { assert.ok(p.titre.length > 3 && p.texte.length > 20 && p.bouton.length > 3); }
  assert.equal(PISTES[0].titre, 'Je suis client'); assert.equal(PISTES[1].titre, 'Je suis restaurateur'); assert.equal(PISTES[2].titre, 'Je suis livreur');
});
test('piste client : toujours le catalogue, connecté ou non, rôles lus ou non', () => {
  for (const e of [nonConnecte, roles(), { connectee: true, roles: null } as EtatEntree]) assert.deepEqual(destinationPiste('client', e), { genre: 'catalogue' });
});
test('piste restaurateur : espace si rattaché à un restaurant, connexion si non connecté, refus sinon', () => {
  assert.deepEqual(destinationPiste('restaurateur', roles({ restaurateur: { restaurant: 'Chez Awa' } })), { genre: 'espace', espace: 'restaurateur' });
  const c = destinationPiste('restaurateur', nonConnecte); assert.equal(c.genre, 'connexion'); assert.match((c as { message: string }).message, /compte de votre restaurant/);
  const r = destinationPiste('restaurateur', roles()); assert.equal(r.genre, 'refus');
  assert.match((r as { message: string }).message, /aucun restaurant/); assert.equal((r as { candidature: boolean }).candidature, true, 'proposer « J’ai un restaurant »');
});
test('piste livreur : mêmes règles, messages de l’ancienne appli (les comptes livreurs sont ouverts par l’équipe)', () => {
  assert.deepEqual(destinationPiste('livreur', roles({ livreur: true })), { genre: 'espace', espace: 'livreur' });
  assert.deepEqual(destinationPiste('livreur', nonConnecte), { genre: 'connexion', message: 'Connectez-vous avec le compte livreur que l’équipe Speedfood vous a ouvert.' });
  const r = destinationPiste('livreur', roles()); assert.equal(r.genre, 'refus');
  assert.equal((r as { message: string }).message, 'Ce compte n’est pas un compte livreur. Les comptes livreurs sont créés par l’équipe Speedfood : contactez-la si vous souhaitez livrer.');
  assert.equal((r as { assistance: boolean }).assistance, true, 'proposer de joindre l’assistance');
});
test('piste équipe : espace si le compte est de l’équipe, connexion si non connecté, refus sinon', () => {
  assert.deepEqual(destinationPiste('equipe', roles({ equipe: 'super_admin' })), { genre: 'espace', espace: 'equipe' });
  assert.deepEqual(destinationPiste('equipe', nonConnecte), { genre: 'connexion', message: 'Connectez-vous avec votre compte de l’équipe.' });
  const r = destinationPiste('equipe', roles()); assert.equal(r.genre, 'refus'); assert.equal((r as { message: string }).message, 'Cet espace est réservé à l’équipe Speedfood.');
});
test('un compte à plusieurs espaces accède à chacun par sa piste', () => {
  const e = roles({ restaurateur: { restaurant: 'X' }, livreur: true, equipe: 'support' });
  assert.deepEqual(['restaurateur', 'livreur', 'equipe'].map(p => (destinationPiste(p as 'livreur', e) as { espace: string }).espace), ['restaurateur', 'livreur', 'equipe']);
});
test('droits impossibles à lire (réseau) : jamais un refus à tort, un message neutre à réessayer', () => {
  for (const p of ['restaurateur', 'livreur', 'equipe'] as const) {
    const d = destinationPiste(p, { connectee: true, roles: null });
    assert.equal(d.genre, 'indisponible'); assert.match((d as { message: string }).message, /Réessayez/);
  }
});
test('entrée proposée seulement au premier lancement', () => {
  assert.equal(doitProposerEntree(false), true); assert.equal(doitProposerEntree(true), false);
});
