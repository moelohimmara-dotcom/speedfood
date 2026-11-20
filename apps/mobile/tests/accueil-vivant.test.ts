import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DELAI_ACCUEIL_MS, DELAI_COMMANDE_EN_COURS_MS, FENETRE_COMMANDE_EN_COURS_MS, RELECTURES_ACCUEIL_MAX, TITRE_PAR_DEFAUT, delaiRelectureAccueil, aRelirePourAccueil, choisirCommandeEnCours, heureConakry, libelleHeure, enteteAccueil,
} from '../src/catalogue/accueil-vivant.ts';
import {
  PHRASE_ATTENTE_RESTAURANT, PHRASE_A_REGLER, PHRASE_EN_PREPARATION, PHRASE_PROPOSITION, phraseProchaineEtape, type EtatPourPhrase,
} from '../src/connexion/suivi-acteur.ts';
import type { ReglementSuivi } from '../src/connexion/reglement.ts';
import type { VueCommandeAppareil } from '../src/connexion/commandes-appareil.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const ouvert = { ouvert: true, accepteCommandes: true };
const ferme = { ouvert: false, accepteCommandes: false };
const pauseCommandes = { ouvert: true, accepteCommandes: false };
const NUIT = new Date('2026-11-19T19:00:00Z');

test('titre d’accueil : l’heure de Conakry est l’heure GMT, minuit et midi sont dits en toutes lettres', () => {
  assert.equal(heureConakry(new Date('2026-11-19T19:45:00Z')), 19);
  assert.equal(libelleHeure(0), 'minuit');
  assert.equal(libelleHeure(12), 'midi');
  assert.equal(libelleHeure(7), '7 h');
});

test('en-tête d’accueil : compte seulement les restaurants ouverts qui prennent des commandes, sur deux niveaux', () => {
  const e = enteteAccueil({ maintenant: NUIT, restaurants: [ouvert, ouvert, ferme, pauseCommandes], listeComplete: true });
  assert.deepEqual(e, { titre: 'Il est 19 h à Conakry', ligne: '2 restaurants prennent des commandes.' });
});

test('en-tête d’accueil : singulier pour un seul restaurant', () => {
  assert.deepEqual(enteteAccueil({ maintenant: NUIT, restaurants: [ouvert, ferme], listeComplete: true }), { titre: 'Il est 19 h à Conakry', ligne: '1 restaurant prend des commandes.' });
});

test('en-tête d’accueil : aucun restaurant ouvert est dit seulement quand toute la liste est connue', () => {
  const nuit = new Date('2026-11-19T03:00:00Z');
  assert.deepEqual(enteteAccueil({ maintenant: nuit, restaurants: [ferme, pauseCommandes], listeComplete: true }), { titre: 'Il est 3 h à Conakry', ligne: 'Aucun restaurant ne prend de commandes pour le moment.' });
  assert.deepEqual(enteteAccueil({ maintenant: nuit, restaurants: [ferme], listeComplete: false }), { titre: 'Il est 3 h à Conakry', ligne: null });
});

test('en-tête d’accueil : liste incomplète donne « Au moins N », jamais un total inventé', () => {
  assert.deepEqual(enteteAccueil({ maintenant: new Date('2026-11-19T12:00:00Z'), restaurants: [ouvert, ouvert], listeComplete: false }), { titre: 'Il est midi à Conakry', ligne: 'Au moins 2 restaurants prennent des commandes.' });
  assert.equal(enteteAccueil({ maintenant: NUIT, restaurants: [ouvert], listeComplete: false }).ligne, 'Au moins 1 restaurant prend des commandes.');
});

test('en-tête d’accueil : le titre reste court (une ligne) et la liste vide garde le titre d’origine', () => {
  assert.deepEqual(enteteAccueil({ maintenant: NUIT, restaurants: [], listeComplete: true }), { titre: TITRE_PAR_DEFAUT, ligne: null });
  assert.ok(enteteAccueil({ maintenant: NUIT, restaurants: [ouvert], listeComplete: true }).titre.length <= 30);
});

const maintenant = Date.parse('2026-11-19T20:00:00Z');
const commande = (ref: string, ilYaMinutes: number, nom = 'Restaurant Opera'): VueCommandeAppareil => ({ cle: 'appareil:' + ref, reference: ref, restaurantNom: nom, creeLe: maintenant - ilYaMinutes * 60000, totalGnf: 1000, mode: 'retrait' });

test('commande en cours : la plus récente non terminée gagne, les terminées sont ignorées', () => {
  const liste = [commande('BE-1', 10), commande('BE-2', 60), commande('BE-3', 120)];
  const etats = { 'appareil:BE-1': { statut: 'terminee', etatDerive: 'terminee' }, 'appareil:BE-2': { statut: 'acceptee', etatDerive: 'acceptee' }, 'appareil:BE-3': { statut: 'en_attente', etatDerive: 'en_attente' } };
  assert.equal(choisirCommandeEnCours(liste, etats, maintenant)?.reference, 'BE-2');
});

test('commande en cours : refusée et annulée ne comptent pas', () => {
  const liste = [commande('BE-1', 5), commande('BE-2', 6)];
  const etats = { 'appareil:BE-1': { statut: 'refusee', etatDerive: 'refusee' }, 'appareil:BE-2': { statut: 'annulee', etatDerive: 'annulee' } };
  assert.equal(choisirCommandeEnCours(liste, etats, maintenant), null);
});

test('commande en cours : une commande de plus de 24 h n’est plus relue ni montrée, même sans état final', () => {
  const vieille = commande('BE-1', 24 * 60 + 1);
  assert.deepEqual(aRelirePourAccueil([vieille], maintenant), []);
  assert.equal(choisirCommandeEnCours([vieille], { 'appareil:BE-1': { statut: 'en_attente', etatDerive: 'en_attente' } }, maintenant), null);
  const limite = commande('BE-2', 24 * 60);
  assert.equal(maintenant - limite.creeLe, FENETRE_COMMANDE_EN_COURS_MS);
  assert.equal(aRelirePourAccueil([limite], maintenant).length, 1);
});

test('commande en cours : statut non relu (panne réseau) ou date inconnue, rien n’est deviné', () => {
  assert.equal(choisirCommandeEnCours([commande('BE-1', 5)], {}, maintenant), null);
  const sansDate = { ...commande('BE-2', 5), creeLe: 0 };
  assert.deepEqual(aRelirePourAccueil([sansDate], maintenant), []);
});

test('commande en cours : au plus trois relectures, les plus récentes d’abord, la liste d’entrée n’est pas modifiée', () => {
  const liste = [commande('BE-1', 100), commande('BE-2', 10), commande('BE-3', 50), commande('BE-4', 20), commande('BE-5', 30)];
  const avant = liste.map(c => c.reference).join();
  assert.deepEqual(aRelirePourAccueil(liste, maintenant).map(c => c.reference), ['BE-2', 'BE-4', 'BE-5']);
  assert.equal(RELECTURES_ACCUEIL_MAX, 3);
  assert.equal(liste.map(c => c.reference).join(), avant);
});

test('commande en cours : un restaurant sans nom connu s’appelle « Restaurant »', () => {
  const r = choisirCommandeEnCours([commande('BE-1', 5, '')], { 'appareil:BE-1': { statut: 'en_attente', etatDerive: 'en_attente' } }, maintenant);
  assert.equal(r?.restaurantNom, 'Restaurant');
});

const reglement = (statut: ReglementSuivi['statut'], avecModes = true): ReglementSuivi => ({
  statut, mode: null, reference: null, declareLe: null, recuLe: null, enLigneEtat: null,
  options: avecModes ? [{ mode: 'orange_money', libelle: 'Orange Money', code: '123456' }] : [],
});
const etat = (statut: string, plus: Partial<EtatPourPhrase> = {}): EtatPourPhrase => ({ statut, etatDerive: statut, mode: 'retrait', propositionEnAttente: false, paiement: null, ...plus });

test('qui agit : avant la réponse, le restaurant doit répondre et le client n’a rien à payer', () => {
  assert.equal(phraseProchaineEtape(etat('en_attente')), PHRASE_ATTENTE_RESTAURANT);
  assert.match(PHRASE_ATTENTE_RESTAURANT, /rien à payer/);
});

test('qui agit : une proposition du restaurant passe avant tout, c’est au client de répondre', () => {
  assert.equal(phraseProchaineEtape(etat('en_attente', { etatDerive: 'attente_confirmation_client' })), PHRASE_PROPOSITION);
  assert.equal(phraseProchaineEtape(etat('acceptee', { propositionEnAttente: true })), PHRASE_PROPOSITION);
});

test('qui agit : commande acceptée avec un mode de règlement proposé, c’est au client de régler le restaurant', () => {
  assert.equal(phraseProchaineEtape(etat('acceptee', { paiement: reglement('non_demande') })), PHRASE_A_REGLER);
  assert.equal(phraseProchaineEtape(etat('acceptee', { paiement: reglement('declare') }))?.startsWith('Le restaurant a accepté.'), true);
  assert.doesNotMatch(PHRASE_A_REGLER, /Speedfood (reçoit|encaisse)/);
});

test('qui agit : commande acceptée sans règlement lisible ou sans mode, le restaurant prépare', () => {
  assert.equal(phraseProchaineEtape(etat('acceptee')), PHRASE_EN_PREPARATION);
  assert.ok((phraseProchaineEtape(etat('acceptee', { paiement: reglement('non_demande', false) })) ?? '').startsWith(PHRASE_EN_PREPARATION));
});

test('qui agit : prête dit de retirer pour un retrait seulement, états finaux dits sans promesse', () => {
  assert.equal(phraseProchaineEtape(etat('prete')), 'Votre commande est prête : passez la retirer au restaurant.');
  assert.equal(phraseProchaineEtape(etat('prete', { mode: 'livraison' })), 'Votre commande est prête.');
  assert.equal(phraseProchaineEtape(etat('terminee')), 'Commande terminée.');
  assert.equal(phraseProchaineEtape(etat('refusee')), 'Le restaurant a refusé cette commande. Vous pouvez commander ailleurs.');
  assert.equal(phraseProchaineEtape(etat('annulee')), 'Cette commande est annulée.');
  assert.equal(phraseProchaineEtape(etat('statut_inconnu')), null);
});

test('qui agit : aucun tiret long dans les textes ajoutés', () => {
  for (const f of ['../src/connexion/suivi-acteur.ts', '../src/catalogue/accueil-vivant.ts', '../src/catalogue/CarteCommandeEnCours.tsx']) assert.doesNotMatch(lire(f), /[—–]/, f);
});

test('accueil : le titre vivant, la carte et le point de l’onglet sont branchés', () => {
  const accueil = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(accueil, /enteteAccueil\(\{ maintenant: new Date\(\)/);
  assert.match(accueil, /<CarteCommandeEnCours commande=\{enCours\.commande\} suivre=\{voirCommandeEnCours\} \/>/);
  assert.match(accueil, /commandeEnCours=\{enCours\.commande !== null\}/);
  assert.match(lire('../src/catalogue/BarreOnglets.tsx'), /Commandes, une commande en cours/);
});

test('point d’onglet : relecture toutes les 15 s tant qu’une commande est en cours, 45 s sinon', () => {
  assert.equal(delaiRelectureAccueil(true), DELAI_COMMANDE_EN_COURS_MS);
  assert.equal(delaiRelectureAccueil(false), DELAI_ACCUEIL_MS);
  assert.equal(DELAI_COMMANDE_EN_COURS_MS, 15000);
  assert.ok(DELAI_COMMANDE_EN_COURS_MS < DELAI_ACCUEIL_MS);
});

test('point d’onglet : la carte est relue à chaque changement d’onglet, après un envoi, et le délai suit l’état', () => {
  const accueil = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(accueil, /useEffect\(\(\) => \{ enCours\.recharger\(\); \}, \[onglet\]\);/);
  assert.match(accueil, /setTimeout\(\(\) => enCours\.recharger\(\), 2000\)/);
  const crochet = lire('../src/catalogue/useCommandeEnCours.ts');
  assert.match(crochet, /delaiRelectureAccueil\(commandeConnue\)/);
  assert.match(crochet, /\[commandeConnue\]\);/);
});

test('suivi : la phrase « qui agit » est affichée sous la frise, connecté ou non', () => {
  assert.match(lire('../src/connexion/CommandesAppareilReel.tsx'), /phraseProchaineEtape\(suivi\.valeur\)/);
  assert.match(lire('../src/connexion/CompteReel.tsx'), /phraseProchaineEtape\(suivi\.valeur\)/);
});
