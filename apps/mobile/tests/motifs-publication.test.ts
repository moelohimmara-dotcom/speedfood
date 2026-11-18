import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FILTRES_ETABLISSEMENT, compterEtablissements, correspondFiltre, filtrerEtablissements, lireFicheRestaurantEquipe, lireRestaurantsEquipe, type RestaurantEquipe,
} from '../src/connexion/catalogue-equipe.ts';
import {
  MESSAGE_CORRECTION_SANS_TEXTE, MESSAGE_NON_PUBLIE, MESSAGE_SUSPENDU, PREFIXE_CORRECTION, lireEtatPublication, messagePublication,
} from '../src/connexion/etat-restaurateur.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const ID = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const resto = (n: number, surcharge: Record<string, unknown> = {}) => ({
  id: ID(n), nom: 'Resto ' + n, categorie: 'Grillades', quartier: 'Kaporo', publie: true, ouvert: true, suspendu: false,
  motifCorrection: null, modeVente: 'speedfood', horaires: '9h à 22h', consignes: '', telephoneCommandes: null, plats: 3, platsDisponibles: 2, ...surcharge,
});
// Un établissement dans chaque état que le site distingue.
const LISTE: RestaurantEquipe[] = lireRestaurantsEquipe({
  ok: true,
  restaurants: [
    resto(1),                                                                  // publié
    resto(2, { publie: false }),                                               // en attente
    resto(3, { publie: false, motifCorrection: 'Corriger les horaires' }),     // correction
    resto(4, { publie: false, suspendu: true }),                               // suspendu (le serveur envoie publie = false pour un suspendu)
    resto(5, { publie: false, suspendu: true, motifCorrection: 'Photo floue' }), // suspendu et en correction
  ],
}).restaurants;

// --- équipe : filtres des établissements
test('établissements de l’équipe : les cinq filtres suivent les définitions du site', () => {
  assert.deepEqual(FILTRES_ETABLISSEMENT.map(f => f.id), ['tous', 'en_attente', 'publies', 'suspendus', 'correction']);
  const ids = (f: Parameters<typeof filtrerEtablissements>[1]) => filtrerEtablissements(LISTE, f).map(r => r.id);
  assert.deepEqual(ids('tous'), [1, 2, 3, 4, 5].map(ID));
  assert.deepEqual(ids('en_attente'), [ID(2)], 'ni publié, ni suspendu, ni en correction');
  assert.deepEqual(ids('publies'), [ID(1)]);
  assert.deepEqual(ids('suspendus'), [ID(4), ID(5)]);
  assert.deepEqual(ids('correction'), [ID(3), ID(5)], 'une correction demandée compte même si l’établissement est suspendu');
  assert.deepEqual(compterEtablissements(LISTE), { tous: 5, en_attente: 1, publies: 1, suspendus: 2, correction: 2 });
  assert.deepEqual(compterEtablissements([]), { tous: 0, en_attente: 0, publies: 0, suspendus: 0, correction: 0 });
  assert.equal(correspondFiltre(LISTE[0], 'tous'), true);
});

// --- équipe : motif de suspension et motifs multilignes
test('fiche de l’équipe : le motif de suspension est lu, absent ou vide = aucun, jamais une fiche refusée', () => {
  const fiche = (surcharge: Record<string, unknown>) => lireFicheRestaurantEquipe({ ok: true, restaurant: { ...resto(4, { publie: false, suspendu: true }), platsDetail: [], ...surcharge } });
  assert.equal(fiche({ motifSuspension: 'Plainte hygiène' }).motifSuspension, 'Plainte hygiène');
  assert.equal(fiche({}).motifSuspension, null, 'une API qui ne l’envoie pas encore (version précédente du site)');
  assert.equal(fiche({ motifSuspension: null }).motifSuspension, null);
  assert.equal(fiche({ motifSuspension: '   ' }).motifSuspension, null);
  assert.equal(fiche({ motifSuspension: 'Ligne 1\nLigne 2\tfin' }).motifSuspension, 'Ligne 1\nLigne 2\tfin', 'un motif multiligne reste lisible');
  assert.equal(fiche({ motifCorrection: 'Corriger :\n- horaires\n- photo' }).motifCorrection, 'Corriger :\n- horaires\n- photo', 'idem pour une correction');
  assert.throws(() => fiche({ motifSuspension: 'x'.repeat(1001) }), /ILLISIBLE/);
  assert.throws(() => fiche({ motifSuspension: 'a\u0000b' }), /ILLISIBLE/, 'un caractère de contrôle refuse la fiche');
  assert.throws(() => fiche({ motifSuspension: 42 }), /ILLISIBLE/);
});

// --- restaurateur : état de publication
const etat = (surcharge: Record<string, unknown> = {}) => ({ ok: true, etat: { publie: true, suspendu: false, correctionDemandee: false, motifCorrection: null, ...surcharge } });
test('état de publication du restaurateur : lecture stricte', () => {
  assert.deepEqual(lireEtatPublication(etat()), { publie: true, suspendu: false, correctionDemandee: false, motifCorrection: null });
  assert.deepEqual(lireEtatPublication(etat({ correctionDemandee: true, motifCorrection: '  Ajouter les horaires\n' })), { publie: true, suspendu: false, correctionDemandee: true, motifCorrection: 'Ajouter les horaires' });
  assert.throws(() => lireEtatPublication({ ok: false }), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication({ ok: true }), /ILLISIBLE/, 'pas d’état');
  assert.throws(() => lireEtatPublication(etat({ publie: 'oui' })), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication(etat({ suspendu: undefined })), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication(etat({ correctionDemandee: 1 })), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication(etat({ motifCorrection: 'x'.repeat(1001), correctionDemandee: true })), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication(etat({ motifCorrection: 'a\u0007b', correctionDemandee: true })), /ILLISIBLE/);
  assert.throws(() => lireEtatPublication(etat({ motifCorrection: 'Un texte sans correction demandée' })), /ILLISIBLE/, 'jamais un texte de correction affiché sans correction');
});
test('état de publication du restaurateur : ce que l’écran affiche, dans l’ordre du site', () => {
  const m = (surcharge: Record<string, unknown>) => messagePublication(lireEtatPublication(etat(surcharge)));
  assert.equal(m({}), null, 'publié et rien à corriger : aucun bandeau');
  assert.equal(m({ publie: false }), MESSAGE_NON_PUBLIE);
  assert.equal(m({ publie: false, correctionDemandee: true, motifCorrection: 'Ajouter une photo' }), PREFIXE_CORRECTION + ' Ajouter une photo', 'la correction passe avant « pas encore visible »');
  assert.equal(m({ publie: false, correctionDemandee: true }), MESSAGE_CORRECTION_SANS_TEXTE, 'le détail illisible est dit, jamais inventé');
  assert.equal(m({ publie: false, suspendu: true, correctionDemandee: true, motifCorrection: 'x' }), MESSAGE_SUSPENDU, 'la suspension passe avant tout');
  assert.ok(!/motif/i.test(MESSAGE_SUSPENDU), 'le motif d’une suspension n’est jamais montré au restaurateur');
});

// --- câblage
test('câblage : route du site, session, bandeau de l’espace restaurateur, filtres de l’équipe', () => {
  const client = lire('../src/connexion/client.ts');
  assert.match(client, /async etatRestaurant\(accessToken: string\)[\s\S]{0,300}\/api\/v1\/restaurant\/etat/, 'client : appel GET de la route /restaurant/etat');
  assert.match(client, /lireEtatPublication\(corps as Record<string, unknown>\)/, 'client : réponse relue strictement');
  const session = lire('../src/connexion/session.ts');
  assert.ok(session.includes("'activiteRestaurant'|'etatRestaurant'|'emettreDocumentRestaurateur'"), 'session : la méthode est dans la liste des appels');
  assert.match(session, /async etatRestaurant\(\)[\s\S]{0,400}this\.api\.etatRestaurant\(acces\)/, 'session : jeton porteur, aucun identifiant de restaurant envoyé');
  assert.match(lire('../src/connexion/RestaurateurReel.tsx'), /<EtatPublicationReel \/>/, 'l’espace restaurateur affiche le bandeau');
  assert.match(lire('../src/connexion/EtatPublicationReel.tsx'), /gestion\.etatRestaurant\(\)/, 'le bandeau lit l’état par la session');
  const equipe = lire('../src/connexion/EquipeCatalogue.tsx');
  assert.ok(equipe.includes('FILTRES_ETABLISSEMENT') && equipe.includes('filtrerEtablissements(restaurants'), 'l’équipe filtre ses établissements');
  assert.ok(equipe.includes('fiche.motifSuspension'), 'l’équipe voit le motif de suspension sur la fiche');
  const route = lire('../../web/src/app/api/v1/restaurant/etat/route.ts');
  assert.ok(route.includes('lireMotifsRestaurants') && !/suspendu_motif|motif_correction/.test(route), 'la route lit le texte par la fonction de la base, jamais en lecture directe');
  assert.ok(!/motifSuspension|suspenduMotif/.test(route), 'la route n’envoie jamais le motif d’une suspension');
});
