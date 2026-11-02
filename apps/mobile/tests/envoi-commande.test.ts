import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnvoiCommande } from '../src/catalogue/envoi-commande.ts';
import { ErreurCommande, refusServeur, erreurReseau } from '../src/catalogue/commande-reelle.ts';
import { ErreurConnexion } from '../src/connexion/client.ts';
import { ajouter, quantite, vide } from '../src/catalogue/panier-reel.ts';
import type { CreationCommandePayload } from '../../../packages/shared/src/contracts/commande.ts';
import type { PlatCataloguePublic } from '../../../packages/shared/src/contracts/catalogue.ts';

const resto = '00000000-0000-4000-8000-0000000000aa';
const id1 = '00000000-0000-4000-8000-000000000001';
const plat: PlatCataloguePublic = { id: id1, nom: 'Plat', description: '', prixGnf: 25000, disponibilite: 'disponible', confirmeLe: null };
const plats = [plat];
const panier1 = ajouter(vide(), resto, plat);
const panier2 = quantite(panier1, id1, 3);
let n = 0; const generer = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
type Reponse = () => Promise<{ reference: string; idempotent: boolean }>;
function remplir(m: EnvoiCommande) { m.saisir('nom', 'Mariama Diallo'); m.saisir('telephone', '622123456'); m.saisir('consentement', true); }
function creer(reponses: Reponse[]) {
  const envoyes: CreationCommandePayload[] = [];
  const m = new EnvoiCommande({ generer, envoyer: async p => { envoyes.push(p); const r = reponses.shift(); if (!r) throw Error('plus de réponse prévue'); return r(); } });
  m.lierCompte('A'); remplir(m);
  return { m, envoyes };
}
const ok = (reference = 'SF-ABCDE'): Reponse => async () => ({ reference, idempotent: false });
const incertain: Reponse = async () => { throw erreurReseau(); };
let videCompte = 0; const vider = () => { videCompte++; };
const go = (m: EnvoiCommande, p = panier1) => m.envoyer(p, plats, vider, true, true);

test('machine : succès = panier vidé APRÈS la réponse, formulaire remis à zéro, clé oubliée', async () => {
  videCompte = 0; let videAvantReponse = -1;
  const m = new EnvoiCommande({ generer, envoyer: async () => { videAvantReponse = videCompte; return { reference: 'SF-ABCDE', idempotent: false }; } });
  m.lierCompte('A'); remplir(m);
  assert.deepEqual(await go(m), { type: 'succes', reference: 'SF-ABCDE', panierVide: true });
  assert.equal(videAvantReponse, 0); assert.equal(videCompte, 1); assert.equal(m.nom, ''); assert.equal(m.phase, 'succes');
  const b = creer([ok(), ok()]);
  await go(b.m); remplir(b.m); await go(b.m);
  assert.notEqual(b.envoyes[0].cleIdempotence, b.envoyes[1].cleIdempotence); // contenu identique mais clé oubliée après succès
});

test('machine : refus définitif, le panier n’est PAS vidé', async () => {
  videCompte = 0;
  const { m } = creer([async () => { throw refusServeur(409, 'CONFLIT_ETAT', 30000); }]);
  assert.deepEqual(await go(m), { type: 'echec', incertain: false }); assert.equal(videCompte, 0); assert.equal(m.phase, 'refuse');
});

test('I1 : après un envoi incertain, Réessayer renvoie le MÊME corps et la MÊME clé même si le panier a changé', async () => {
  videCompte = 0;
  const { m, envoyes } = creer([incertain, ok()]);
  await go(m); assert.equal(m.phase, 'incertain');
  assert.deepEqual(await go(m, panier2), { type: 'succes', reference: 'SF-ABCDE', panierVide: false }); // panier modifié entre-temps : jamais effacé
  assert.equal(videCompte, 0);
  assert.deepEqual(envoyes[1], envoyes[0]); assert.equal(envoyes[1].sousTotalAffiche, 25000);
});

test('I1/I3 : fermeture interdite pendant l’envoi et tant que l’incertitude n’est pas levée ; double appui ignoré', async () => {
  let libere!: () => void;
  const { m } = creer([() => new Promise(r => { libere = () => r({ reference: 'SF-ABCDE', idempotent: false }); })]);
  const p = go(m);
  assert.equal(m.phase, 'envoi'); assert.equal(m.peutFermer(), false);
  assert.equal((await go(m)).type, 'ignore');
  libere(); await p; assert.equal(m.peutFermer(), true);
  const b = creer([incertain]); await go(b.m);
  assert.equal(b.m.peutFermer(), false);
  b.m.saisir('nom', 'Autre'); assert.equal(b.m.nom, 'Mariama Diallo'); // formulaire verrouillé
});

test('I1 : abandon d’un envoi incertain seulement après confirmation explicite', async () => {
  const { m, envoyes } = creer([incertain, ok()]);
  await go(m);
  m.confirmerAbandon(); assert.equal(m.phase, 'incertain'); // sans demande préalable : sans effet
  m.demanderAbandon(); m.annulerAbandon(); m.confirmerAbandon(); assert.equal(m.phase, 'incertain');
  m.demanderAbandon(); m.confirmerAbandon(); assert.equal(m.phase, 'refuse'); assert.equal(m.peutFermer(), true);
  m.saisir('nom', 'Autre Nom'); await go(m, panier2);
  assert.notEqual(envoyes[1].cleIdempotence, envoyes[0].cleIdempotence); assert.equal(envoyes[1].client.nom, 'Autre Nom');
});

test('rejeu incertain : une erreur de connexion (rien parti) laisse l’incertitude entière', async () => {
  const { m } = creer([incertain, async () => { throw new ErreurConnexion('Impossible de joindre Speedfood.'); }]);
  await go(m); await go(m);
  assert.equal(m.phase, 'incertain');
});

test('I2 : générateur de clé indisponible = message affiché, phase refus, aucun envoi', async () => {
  const envoyes: unknown[] = [];
  const m = new EnvoiCommande({ generer: () => { throw new ErreurCommande('validation', 'Cet appareil ne peut pas sécuriser l’envoi de la commande.'); }, envoyer: async p => { envoyes.push(p); return { reference: 'x', idempotent: false }; } });
  m.lierCompte('A'); remplir(m);
  assert.equal((await go(m)).type, 'refus'); assert.match(m.message ?? '', /sécuriser/); assert.equal(m.phase, 'refuse'); assert.equal(envoyes.length, 0);
});

test('I4 : changement ou fin de compte = formulaire, envoi incertain et clé effacés ; clé différente par compte', async () => {
  const { m, envoyes } = creer([incertain, ok()]);
  await go(m); assert.equal(m.phase, 'incertain');
  m.lierCompte('B');
  assert.equal(m.phase, 'saisie'); assert.equal(m.nom, ''); assert.equal(m.telephone, ''); assert.equal(m.consentement, false); assert.equal(m.message, null);
  assert.equal((await go(m)).type, 'ignore'); // formulaire vide : rien n'est renvoyé
  remplir(m); await go(m);
  assert.equal(envoyes.length, 2); assert.notEqual(envoyes[1].cleIdempotence, envoyes[0].cleIdempotence); // la clé de A n'est jamais renvoyée sous B
  remplir(m); m.lierCompte(null); assert.equal(m.nom, '');
});

test('compte changé PENDANT l’envoi : le panier n’est pas vidé et l’écran n’est pas touché', async () => {
  videCompte = 0; let libere!: () => void;
  const { m } = creer([() => new Promise(r => { libere = () => r({ reference: 'SF-ABCDE', idempotent: false }); })]);
  const p = go(m);
  m.lierCompte('B'); libere();
  assert.deepEqual(await p, { type: 'session_changee', reference: 'SF-ABCDE' }); assert.equal(videCompte, 0); assert.equal(m.phase, 'saisie');
});

test('M3 : panier impossible à vider = clé conservée, message, rejeu à l’identique possible', async () => {
  const { m, envoyes } = creer([ok(), ok()]);
  const r = await m.envoyer(panier1, plats, () => { throw Error('stockage'); }, true, true);
  assert.deepEqual(r, { type: 'succes', reference: 'SF-ABCDE', panierVide: false }); assert.match(m.message ?? '', /vid/);
  remplir(m); await go(m);
  assert.equal(envoyes[1].cleIdempotence, envoyes[0].cleIdempotence); // même contenu, même clé : le serveur répondra 200
});

test('envoi impossible : pas connecté, panier non prêt, consentement absent', async () => {
  const { m } = creer([ok()]);
  assert.equal((await m.envoyer(panier1, plats, vider, false, true)).type, 'ignore');
  assert.equal((await m.envoyer(panier1, plats, vider, true, false)).type, 'ignore');
  m.saisir('consentement', false); assert.equal((await go(m)).type, 'ignore');
});
