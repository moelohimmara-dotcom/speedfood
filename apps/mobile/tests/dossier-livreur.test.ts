import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afficherContactDossier, lireDossierLivreur, piecesManquantes, resumeDossier, TEXTE_CONTACT_DOSSIER } from '../src/connexion/dossier-livreur.ts';
const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const piece = (statut: string, libelle = 'Pièce d’identité') => ({ code: 'piece_identite', libelle, statut, explication: 'Contactez l’équipe Speedfood pour compléter cette pièce.' });

test('dossier livreur : compte non livreur = null, dossier sans pièce = complet', () => {
  assert.equal(lireDossierLivreur({ ok: true, dossier: null }), null);
  const d = lireDossierLivreur({ ok: true, dossier: { pieces: [], message: null } })!;
  assert.deepEqual(d, { pieces: [], message: null });
  assert.equal(resumeDossier(d), 'Votre dossier est complet.');
});
test('dossier livreur : les phrases de l’ancienne appli (une pièce, plusieurs pièces, tout à jour)', () => {
  const une = lireDossierLivreur({ ok: true, dossier: { pieces: [piece('manquant'), { ...piece('a_jour', 'Personne à prévenir en cas de problème'), code: 'urgence' }] } })!;
  assert.equal(resumeDossier(une), 'Il manque 1 pièce : Pièce d’identité.');
  assert.equal(piecesManquantes(une).length, 1);
  const deux = lireDossierLivreur({ ok: true, dossier: { pieces: [piece('manquant'), { ...piece('manquant', 'Personne à prévenir en cas de problème'), code: 'urgence' }] } })!;
  assert.equal(resumeDossier(deux), 'Il manque 2 pièces : Pièce d’identité, Personne à prévenir en cas de problème.');
  const tout = lireDossierLivreur({ ok: true, dossier: { pieces: [piece('a_jour')] } })!;
  assert.equal(resumeDossier(tout), 'Votre dossier est complet.');
});
test('dossier livreur : lecture stricte, jamais un dossier « complet » inventé', () => {
  assert.throws(() => lireDossierLivreur({ ok: false }), /ILLISIBLE/);
  assert.throws(() => lireDossierLivreur({ ok: true }), /ILLISIBLE/, 'ni dossier ni null');
  assert.throws(() => lireDossierLivreur({ ok: true, dossier: { pieces: [piece('peut-etre')] } }), /ILLISIBLE/, 'statut inconnu');
  assert.throws(() => lireDossierLivreur({ ok: true, dossier: { pieces: [piece('manquant', '  ')] } }), /ILLISIBLE/, 'libellé vide');
  assert.throws(() => lireDossierLivreur({ ok: true, dossier: { pieces: 'non' } }), /ILLISIBLE/);
  assert.throws(() => lireDossierLivreur({ ok: true, dossier: { pieces: Array.from({ length: 11 }, () => piece('a_jour')) } }), /ILLISIBLE/, 'trop de pièces');
  assert.throws(() => lireDossierLivreur({ ok: true, dossier: { pieces: [], message: 5 } }), /ILLISIBLE/);
});
test('dossier livreur : l’application ne garde que l’état, jamais un contenu de pièce', () => {
  const d = lireDossierLivreur({ ok: true, dossier: { pieces: [{ ...piece('a_jour'), pieceNumero: 'AB12345', urgenceTelephone: '+224622000009' }] } })!;
  assert.ok(!JSON.stringify(d).includes('AB12345') && !JSON.stringify(d).includes('+224'), 'les champs hors contrat sont écartés');
});
test('dossier livreur : câblage (route du site, session, rubrique « Mon dossier » du livreur)', () => {
  assert.match(lire('../src/connexion/client.ts'), /SITE_WEB\+'\/api\/v1\/livreur\/dossier', \{ method:'GET'/);
  assert.match(lire('../src/connexion/session.ts'), /async dossierLivreur\(\): Promise<DossierLivreur \| null>/);
  const livreur = lire('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /titre="Mon dossier" sousTitre="Ce qui manque à votre dossier"/);
  assert.match(livreur, /\{dossierOuvert && <DossierLivreurReel \/>\}/);
  const ecran = lire('../src/connexion/DossierLivreurReel.tsx');
  assert.match(ecran, /DELAI_RELECTURE_DOSSIER_MS/, 'relue toutes les minutes tant que la rubrique est ouverte');
  assert.match(ecran, /Ce que vous voyez est le dernier état connu/, 'une lecture qui échoue le dit et garde le dernier état');
});

test('dossier livreur : le contact de l’assistance n’apparaît que s’il manque une pièce, sans promettre de dépôt', () => {
  const complet = lireDossierLivreur({ ok: true, dossier: { pieces: [], message: null } });
  const manque = lireDossierLivreur({ ok: true, dossier: { pieces: [piece('manquant')], message: null } });
  assert.equal(afficherContactDossier(complet), false);
  assert.equal(afficherContactDossier(manque), true);
  assert.equal(afficherContactDossier(null), false);
  assert.equal(afficherContactDossier(undefined), false);
  assert.ok(!/déposez|téléversez|envoyez votre/i.test(TEXTE_CONTACT_DOSSIER));
});
