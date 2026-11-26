import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import {
  COMMANDES_APPAREIL_MAX, cleAppareil, cleCoffreSuivi, commandeAppareilValide, decoderMetadonnees, depuisCompte, encoderMetadonnees, fusionnerCommandes, jetonSuiviValide, referenceDeCle, versVue,
  type CommandeAppareil, type MemoireAppareil,
} from '../src/connexion/commandes-appareil.ts';
const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const J1 = 'A'.repeat(40); const J2 = 'b'.repeat(39) + '-'; const J3 = 'c'.repeat(40);
const cmd = (reference: string, jeton: string, plus: Partial<CommandeAppareil> = {}): CommandeAppareil => ({ reference, jeton, restaurantNom: 'Barbie food', creeLe: 1_000, totalGnf: 25000, mode: 'retrait', ...plus });

test('commandes de l’appareil : forme du jeton, références et lignes douteuses refusées', () => {
  assert.equal(jetonSuiviValide(J1), true); assert.equal(jetonSuiviValide(J2), true);
  for (const j of ['', 'court', 'x'.repeat(41), 'é'.repeat(40), null, 5]) assert.equal(jetonSuiviValide(j), false);
  assert.throws(() => commandeAppareilValide(cmd('SF-1', 'court')), /INVALIDE/);
  assert.throws(() => commandeAppareilValide(cmd('a b', J1)), /INVALIDE/, 'référence avec espace');
  assert.throws(() => commandeAppareilValide(cmd('SF-1', J1, { mode: 'inconnu' })), /INVALIDE/);
  assert.throws(() => commandeAppareilValide(cmd('SF-1', J1, { totalGnf: 1.5 })), /INVALIDE/);
  assert.throws(() => commandeAppareilValide(cmd('SF-1', J1, { creeLe: -1 })), /INVALIDE/);
  assert.deepEqual(commandeAppareilValide(cmd('SF-1', J1)).reference, 'SF-1');
});
test('commandes de l’appareil : une commande par référence, plus récentes d’abord, 50 au plus, une information plus complète remplace une vide', () => {
  const stub = cmd('SF-1', J1, { restaurantNom: '', totalGnf: 0, creeLe: 9_999 });
  const complete = cmd('SF-1', J1, { restaurantNom: 'Barbie food', totalGnf: 25000, creeLe: 1_000 });
  const f = fusionnerCommandes([stub], [complete]);
  assert.equal(f.length, 1); assert.equal(f[0].restaurantNom, 'Barbie food'); assert.equal(f[0].totalGnf, 25000); assert.equal(f[0].creeLe, 1_000, 'la date du serveur remplace celle du stub');
  const inverse = fusionnerCommandes([complete], [stub]);
  assert.equal(inverse[0].restaurantNom, 'Barbie food', 'un stub ne vide jamais une information'); assert.equal(inverse[0].totalGnf, 25000); assert.equal(inverse[0].creeLe, 1_000);
  const ordre = fusionnerCommandes([], [cmd('SF-A', J1, { creeLe: 1 }), cmd('SF-B', J2, { creeLe: 3 }), cmd('SF-C', J3, { creeLe: 2 })]);
  assert.deepEqual(ordre.map(c => c.reference), ['SF-B', 'SF-C', 'SF-A']);
  const beaucoup = Array.from({ length: 60 }, (_, i) => cmd('SF-' + String(i).padStart(3, '0'), J1, { creeLe: i + 1 }));
  const plafonnee = fusionnerCommandes([], beaucoup);
  assert.equal(plafonnee.length, COMMANDES_APPAREIL_MAX); assert.equal(plafonnee[0].reference, 'SF-059');
  assert.deepEqual(fusionnerCommandes([cmd('SF-1', 'court')], [cmd('SF-2', 'court')]), [], 'lignes invalides écartées');
});
test('commandes de l’appareil : les métadonnées n’écrivent JAMAIS le jeton et se relisent prudemment', () => {
  const texte = encoderMetadonnees([cmd('SF-1', J1), cmd('SF-2', J2)]);
  assert.ok(!texte.includes(J1) && !texte.includes(J2) && !texte.includes('jeton'), 'aucun jeton dans la base');
  assert.deepEqual(decoderMetadonnees(texte).map(m => m.reference), ['SF-1', 'SF-2']);
  assert.deepEqual(decoderMetadonnees(null), []); assert.deepEqual(decoderMetadonnees('pas du json'), []);
  assert.deepEqual(decoderMetadonnees(JSON.stringify({ version: 2, commandes: [] })), [], 'version inconnue');
  assert.deepEqual(decoderMetadonnees('x'.repeat(70000)), [], 'texte trop long');
  assert.deepEqual(decoderMetadonnees(JSON.stringify({ version: 1, commandes: [{ reference: 'SF-1', restaurantNom: 'R', creeLe: 1, totalGnf: 1, mode: 'retrait' }, { reference: 'SF-1', restaurantNom: 'R', creeLe: 1, totalGnf: 1, mode: 'retrait' }, { reference: 'mauvaise ligne' }] })).map(m => m.reference), ['SF-1'], 'doublon et ligne douteuse écartés');
});
test('commandes de l’appareil : depuis le compte, clés du coffre et vue sans jeton', () => {
  const lignes = [
    { reference: 'SF-1', creeLe: '2026-11-18T10:00:00Z', restaurantNom: 'Barbie food', mode: 'livraison', totalGnf: 30000, jeton: J1 },
    { reference: 'SF-2', creeLe: '2026-11-18T10:00:00Z', restaurantNom: 'R', mode: 'retrait', totalGnf: 1, jeton: null },
    { reference: 'SF-3', creeLe: 'pas une date', restaurantNom: 'R', mode: 'retrait', totalGnf: 1, jeton: J2 },
    { reference: 'SF-4', creeLe: '2026-11-18T10:00:00Z', restaurantNom: 'R', mode: 'retrait', totalGnf: 1, jeton: 'court' },
  ];
  assert.deepEqual(depuisCompte(lignes).map(c => c.reference), ['SF-1'], 'sans jeton valable ou sans date lisible : ignorée');
  assert.equal(cleCoffreSuivi('SF-EPKB4'), 'suivi_SF-EPKB4'); assert.match(cleCoffreSuivi('SF 1/é'), /^suivi_[A-Za-z0-9._-]+$/);
  const v = versVue(cmd('SF-1', J1)); assert.equal(JSON.stringify(v).includes(J1), false, 'la vue n’a pas de jeton'); assert.equal(v.cle, cleAppareil('SF-1'));
  assert.equal(referenceDeCle(cleAppareil('SF-1')), 'SF-1'); assert.equal(referenceDeCle('SF-1'), null); assert.equal(referenceDeCle('appareil:a b'), null);
});

// Session : dépôt factice, API factice.
const id = '00000000-0000-4000-8000-000000000001';
function depot(): MemoireAppareil & { liste: CommandeAppareil[]; ecritures: number } {
  const d = { liste: [] as CommandeAppareil[], ecritures: 0,
    lire: async () => [...d.liste], enregistrer: async (n: readonly CommandeAppareil[]) => { d.ecritures++; d.liste = fusionnerCommandes(d.liste, n); }, oublier: async () => { d.liste = []; } };
  return d;
}
function api(suiviLu: string[], plus: Record<string, unknown> = {}) {
  return { connecter: async () => ({ accessToken: 'acces-factice', refreshToken: 'renouvellement-factice', userId: id, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => undefined,
    commandes: async () => [{ id, reference: 'SF-ESSAI', creeLe: '2026-11-18T10:00:00Z', restaurantNom: 'Barbie food', mode: 'retrait', statut: 'en_attente', totalGnf: 25000, estTest: true, jeton: J1 }],
    creerCommande: async () => ({ reference: 'SF-NEUF', jeton: J3, idempotent: false }),
    suivi: async (jeton: string) => { suiviLu.push(jeton); return { reference: jeton === J1 ? 'SF-ESSAI' : 'SF-NEUF', statut: 'acceptee', etatDerive: 'acceptee', mode: 'retrait', estTest: false, restaurantNom: 'Barbie food', totalGnf: 25000, pretEstimeeLe: null, propositionEnAttente: false, proposition: null, lignes: [], sousTotalGnf: 25000, fraisLivraisonGnf: 0, delaiPreparationMinutes: null }; },
    ...plus } as never;
}
const coffreVide = { lire: async () => null, ecrire: async () => {}, effacer: async () => {} };
const attendre = () => new Promise<void>(r => setImmediate(r));

test('session : la lecture des commandes du compte garde référence et jeton sur l’appareil (sans jeton côté écran)', async () => {
  const d = depot(); const g = new GestionSession(api([]), coffreVide, d);
  await g.connecter('essai@example.invalid', 'factice'); const liste = await g.commandes(); await attendre();
  assert.equal(JSON.stringify(liste).includes(J1), false);
  assert.deepEqual(d.liste.map(c => [c.reference, c.jeton, c.restaurantNom]), [['SF-ESSAI', J1, 'Barbie food']]);
});
test('session : une commande envoyée est gardée tout de suite avec son jeton, puis complétée par la lecture du compte', async () => {
  const d = depot(); const g = new GestionSession(api([]), coffreVide, d);
  await g.connecter('essai@example.invalid', 'factice');
  const r = await g.creerCommande({ mode: 'retrait' } as never); await attendre();
  assert.equal(r.reference, 'SF-NEUF'); assert.equal('jeton' in r, false, 'le jeton ne remonte pas à l’écran');
  assert.deepEqual(d.liste.map(c => [c.reference, c.jeton, c.restaurantNom, c.mode]), [['SF-NEUF', J3, '', 'retrait']]);
});
test('session : déconnecté, les commandes de l’appareil restent lisibles et suivies SANS session ; le suivi reçu doit porter la bonne référence', async () => {
  const d = depot(); d.liste = [cmd('SF-ESSAI', J1)]; const lus: string[] = [];
  const g = new GestionSession(api(lus), coffreVide, d);
  await g.connecter('essai@example.invalid', 'factice'); await g.deconnecter(); assert.equal(g.connectee, false);
  const vues = await g.commandesAppareil(); assert.deepEqual(vues.map(v => v.reference), ['SF-ESSAI']); assert.equal(JSON.stringify(vues).includes(J1), false);
  const suivi = await g.suiviAppareil(vues[0].cle); assert.equal(suivi.reference, 'SF-ESSAI'); assert.deepEqual(lus, [J1], 'lu avec le jeton gardé, sans session');
  await assert.rejects(g.suiviAppareil('appareil:SF-INCONNUE'), /plus sur cet appareil/);
  await assert.rejects(g.suiviAppareil('SF-ESSAI'), /plus sur cet appareil/, 'une clé qui n’est pas de l’appareil est refusée');
  d.liste = [cmd('SF-AUTRE', J1)]; const g2 = new GestionSession(api([]), coffreVide, d);
  await assert.rejects(g2.suiviAppareil('appareil:SF-AUTRE'), /ne correspond pas/, 'le serveur répond une autre commande : refusé');
});
test('session : annuler, répondre et régler restent impossibles sans session, même pour une commande de l’appareil', async () => {
  const d = depot(); d.liste = [cmd('SF-ESSAI', J1)]; const g = new GestionSession(api([]), coffreVide, d);
  await g.commandesAppareil();
  await assert.rejects(g.annuler('appareil:SF-ESSAI')); await assert.rejects(g.repondreProposition('appareil:SF-ESSAI', 'p', true)); await assert.rejects(g.declarerPaiement('appareil:SF-ESSAI', 'especes', null));
});
test('session : « oublier » efface les commandes de l’appareil ; la suppression du compte aussi ; la déconnexion et l’expiration non', async () => {
  const d = depot(); d.liste = [cmd('SF-ESSAI', J1)]; const g = new GestionSession(api([], { supprimerCompte: async () => undefined }), coffreVide, d);
  await g.connecter('essai@example.invalid', 'factice'); await g.deconnecter(); assert.equal(d.liste.length, 1, 'la déconnexion garde les commandes');
  await g.oublierCommandesAppareil(); assert.equal(d.liste.length, 0); assert.deepEqual(await g.commandesAppareil(), []);
  await assert.rejects(g.suiviAppareil('appareil:SF-ESSAI'), /plus sur cet appareil/, 'la clé gardée en mémoire est oubliée aussi');
  const d2 = depot(); d2.liste = [cmd('SF-ESSAI', J1)]; const g2 = new GestionSession(api([], { supprimerCompte: async () => undefined }), coffreVide, d2);
  await g2.connecter('essai@example.invalid', 'factice'); await g2.supprimerCompte('SUPPRIMER'); await attendre(); assert.equal(d2.liste.length, 0, 'compte supprimé : plus rien du compte sur l’appareil');
});
test('session : sans dépôt (ou si le dépôt échoue), l’envoi et la lecture des commandes ne sont jamais gênés', async () => {
  const g = new GestionSession(api([]), coffreVide); await g.connecter('essai@example.invalid', 'factice');
  assert.equal((await g.creerCommande({ mode: 'retrait' } as never)).reference, 'SF-NEUF'); assert.equal((await g.commandes()).length, 1); assert.deepEqual(await g.commandesAppareil(), []);
  const casse: MemoireAppareil = { lire: async () => { throw Error('coffre'); }, enregistrer: async () => { throw Error('coffre'); }, oublier: async () => { throw Error('coffre'); } };
  const g2 = new GestionSession(api([]), coffreVide, casse); await g2.connecter('essai@example.invalid', 'factice');
  assert.equal((await g2.creerCommande({ mode: 'retrait' } as never)).reference, 'SF-NEUF'); assert.equal((await g2.commandes()).length, 1);
});
test('commandes de l’appareil : câblage (stockage au coffre, écran sans connexion, déconnexion, oubli, textes)', () => {
  const stockage = lire('../src/stockage/commandes-appareil.ts');
  assert.match(stockage, /SecureStore\.setItemAsync\(cleCoffreSuivi\(c\.reference\), c\.jeton\)/, 'le jeton va au coffre');
  assert.match(stockage, /speedfood-client-appareil\.db/); assert.doesNotMatch(stockage, /depot\.ecrire\([^)]*jeton/, 'jamais le jeton dans la base');
  assert.match(lire('../src/connexion/gestion.ts'), /new GestionSession\(creerAuth\(fetchHttp\), coffreSession, memoireCommandesAppareil\)/);
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /vue==='commandes'&&<CommandesAppareilReel oublier=\{parametres\?parametres\.oublierCommandes:\(\)=>gestion\.oublierCommandesAppareil\(\)\} apresOubli=\{\(\)=>setMessage\('Les commandes de cet appareil ont été oubliées\.'\)\}\/>/);
  assert.match(compte, /Vos commandes restent consultables dans l’onglet Commandes/);
  assert.match(lire('../src/catalogue/CatalogueReel.tsx'), /await m\.oublier\(\); setMemos\(\[\]\); await gestion\.oublierCommandesAppareil\(\);/);
  const ecran = lire('../src/connexion/CommandesAppareilReel.tsx');
  assert.match(ecran, /MESSAGE_ANNULER_CONNECTEZ_VOUS/); assert.match(ecran, /MESSAGE_PROPOSITION_CONNECTEZ_VOUS/);
  assert.doesNotMatch(ecran, /gestion\.(annuler|repondreProposition|declarerPaiement)/, 'lecture seule : aucune écriture sans connexion');
  assert.match(lire('../src/connexion/ParametresReel.tsx'), /avec leur clé de suivi/);
});test('commandes de l’appareil : le suivi s’affiche au-dessus de la liste, la liste est limitée aux plus récentes (la connexion reste à portée), « Oublier » ferme tout', () => {
  const ecran = lire('../src/connexion/CommandesAppareilReel.tsx');
  assert.ok(ecran.indexOf('{suivi !== null && <View') < ecran.indexOf('.map(v => <View key={v.cle}'), 'la carte de suivi est rendue avant la liste');
  assert.match(ecran, /VISIBLES_MAX = 5/); assert.match(ecran, /\(toutes \? liste : liste\.slice\(0, VISIBLES_MAX\)\)\.map\(/);
  assert.match(ecran, /liste\.length > VISIBLES_MAX && <Action titre=\{'Afficher les ' \+ liste\.length/, 'les autres s’affichent à la demande');
  assert.match(ecran, /setSuivi\(null\); setToutes\(false\); apresOubli\?\.\(\)/);
});