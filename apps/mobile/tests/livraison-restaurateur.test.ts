import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import {
  ACTIONS_A_CONFIRMER, CONFIRMATIONS, ETAT_REPOS, ErreurRestaurateur, MESSAGE_SECURITE, actionLivraisonDe, actionVerrouillee, actionsAffichees, actionsPossibles, chiffresDuCode, evoluer, ligneLivraison, lireListeRestaurateur, peutEnvoyer,
  preparerCodeLivraison, refusLivraisonRestaurateur, verdictAction, type CommandeRestaurateur, type EtatAction,
} from '../src/connexion/restaurateur.ts';

/**
 * Lot D5 : la livraison par le restaurant dans l'application. Domaine pur (lecture, boutons, machine d'états, verdicts), client réseau (un seul essai, code validé AVANT le réseau, aucun code dans les
 * messages) et écran (texte source). L'essai réel sur émulateur est le seul juge du réseau natif : ces tests ne le remplacent pas.
 */
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const LIV = '00000000-0000-4000-8000-0000000000c1';
const CODE = '4821';
const ACCES = 'acces-factice';

const brute = (id: string, surcharge: Record<string, unknown> = {}) => ({
  id, reference: 'SF-' + id.slice(-1).toUpperCase(), statut: 'prete', etatDerive: 'prete', mode: 'livraison', tableNumero: null, clientNom: 'Awa Diallo', clientTelephone: '+224 622 00 00 00', clientAdresse: 'Kaloum, rue 12',
  sousTotal: 45000, fraisLivraisonEstime: 5000, creeLe: '2026-11-04T10:00:00.000Z', estTest: false, lignes: [{ nom: 'Poulet braisé', prix: 45000, quantite: 1, options: [] }],
  propositionActive: null, propositions: [], paiementStatut: 'recu', paiementMode: 'orange_money', paiementReference: null, paiementRecuLe: null, paiementVisible: true, paiementLibelle: 'Paiement reçu',
  documents: { recu: null, facture: null }, lienRecuWhatsApp: null, lienFactureWhatsApp: null, livraison: { id: LIV, statut: 'assignee', mode: 'propre' }, ...surcharge,
});
const reponse = (commandes: unknown[] = [brute(A)], extra: Record<string, unknown> = {}) => ({ ok: true, restaurant: { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Fatou', ouvert: true, accepteCommandes: true }, commandes, ...extra });
const lue = (surcharge: Record<string, unknown> = {}): CommandeRestaurateur => lireListeRestaurateur(reponse([brute(A, surcharge)])).commandes[0];
const avecLivraison = (statut: string, mode = 'propre', commande: Record<string, unknown> = {}) => lue({ livraison: { id: LIV, statut, mode }, ...commande });

// ---------- lecture ----------
test('D5 lecture : le bloc livraison (identifiant, statut, mode) est lu ; absent ou null = pas de livraison, sans compte', () => {
  assert.deepEqual(lue().livraison, { id: LIV, statut: 'assignee', mode: 'propre' });
  for (const surcharge of [{ livraison: null }, { livraison: undefined }]) {
    const l = lireListeRestaurateur(reponse([brute(A, surcharge)]));
    assert.equal(l.commandes[0].livraison, null);
    assert.equal(l.livraisonsIllisibles, 0);
  }
  const retrait = lireListeRestaurateur(reponse([brute(A, { mode: 'retrait', livraison: { id: LIV, statut: 'assignee', mode: 'propre' } })]));
  assert.equal(retrait.commandes[0].livraison, null, 'un retrait n’a pas de livraison');
});

test('D5 lecture : une livraison illisible n’écarte JAMAIS la commande : livraison null ET comptée (en plus du compte du serveur)', () => {
  for (const livraison of [{ id: 'x', statut: 'assignee', mode: 'propre' }, { id: LIV, statut: 'perdue', mode: 'propre' }, { id: LIV, statut: 'assignee', mode: 'drone' }, 'texte', 42, [], {}]) {
    const l = lireListeRestaurateur(reponse([brute(A, { livraison }), brute(B)]));
    assert.deepEqual(l.commandes.map(c => c.id), [A, B], JSON.stringify(livraison));
    assert.equal(l.commandes[0].livraison, null);
    assert.equal(l.illisibles, 0, 'la commande reste lisible');
    assert.equal(l.livraisonsIllisibles, 1);
  }
  assert.equal(lireListeRestaurateur(reponse([brute(A, { livraison: null })], { livraisonsIllisibles: 3 })).livraisonsIllisibles, 3, 'compte du serveur');
  assert.equal(lireListeRestaurateur(reponse([brute(A, { livraison: 'x' })], { livraisonsIllisibles: 2 })).livraisonsIllisibles, 3, 'serveur + application');
  for (const mauvais of [-1, 1.5, 'deux', null, 99999]) assert.equal(lireListeRestaurateur(reponse([brute(A)], { livraisonsIllisibles: mauvais })).livraisonsIllisibles, 0, String(mauvais));
});

test('D5 lecture : jamais de code ni de livreur retenu, même si le serveur en envoyait', () => {
  const c = lue({ livraison: { id: LIV, statut: 'vers_client', mode: 'propre', code: CODE, livreurTelephone: '+224 600 00 00 00', livreur_id: 'x', latitude: 9.5 } });
  assert.deepEqual(c.livraison, { id: LIV, statut: 'vers_client', mode: 'propre' });
  const texte = JSON.stringify(lireListeRestaurateur(reponse([brute(A, { livraison: { id: LIV, statut: 'vers_client', mode: 'propre', code: CODE } })])));
  assert.ok(!texte.includes(CODE) && !texte.includes('+224 600'));
});

// ---------- boutons ----------
const possibles = (c: CommandeRestaurateur) => actionsPossibles(c).filter(a => a.startsWith('livraison_'));

test('D5 boutons : mode propre, prête à partir, commande prête = « Parti livrer » + « Annuler la livraison »', () => {
  assert.deepEqual(possibles(avecLivraison('assignee')), ['livraison_partir', 'livraison_annuler']);
});
test('D5 boutons : « Parti livrer » exige la commande PRÊTE (comme la console du site)', () => {
  assert.deepEqual(possibles(avecLivraison('assignee', 'propre', { statut: 'acceptee' })), ['livraison_annuler']);
});
test('D5 boutons : en route vers le client = « Livrée » (code) seulement ; plus d’annulation (la machine du site la refuse)', () => {
  assert.deepEqual(possibles(avecLivraison('vers_client')), ['livraison_livree']);
});
test('D5 boutons : mode speedfood = « Annuler la livraison » seulement, jamais « Parti livrer » ni « Livrée »', () => {
  for (const statut of ['a_assigner', 'offre_envoyee', 'assignee', 'vers_restaurant']) assert.deepEqual(possibles(avecLivraison(statut, 'speedfood')), ['livraison_annuler'], statut);
  for (const statut of ['recuperee', 'vers_client', 'livree', 'echec', 'annulee']) assert.deepEqual(possibles(avecLivraison(statut, 'speedfood')), [], statut);
});
test('D5 boutons : livraison terminée, absente, illisible, commande refusée/annulée ou retrait = aucun bouton de livraison', () => {
  for (const statut of ['livree', 'echec', 'annulee']) assert.deepEqual(possibles(avecLivraison(statut)), [], statut);
  assert.deepEqual(possibles(lue({ livraison: null })), []);
  assert.deepEqual(possibles(lue({ livraison: { id: 'x', statut: 'assignee', mode: 'propre' } })), []);
  assert.deepEqual(possibles(avecLivraison('assignee', 'propre', { statut: 'annulee' })), []);
  assert.deepEqual(possibles(avecLivraison('assignee', 'propre', { statut: 'refusee' })), []);
  assert.deepEqual(possibles(lue({ mode: 'retrait', livraison: null })), []);
  assert.deepEqual(possibles(lue({ mode: 'sur_place', livraison: null })), []);
});
test('D5 boutons : les boutons de statut et de paiement existants sont inchangés à côté de ceux de la livraison', () => {
  assert.deepEqual(actionsPossibles(avecLivraison('assignee')), ['terminee', 'livraison_partir', 'livraison_annuler']);
  assert.deepEqual(actionsPossibles(lue({ statut: 'en_attente', livraison: null, paiementStatut: 'non_demande', paiementMode: null })), ['accepter', 'refuser', 'proposer', 'annuler']);
});
test('D5 libellés : l’état de la livraison affiché est celui du serveur, avec les mots du restaurant qui livre lui-même', () => {
  assert.equal(ligneLivraison(avecLivraison('assignee')), 'Livraison : Prête à partir');
  assert.equal(ligneLivraison(avecLivraison('vers_client')), 'Livraison : En route vers le client');
  assert.equal(ligneLivraison(avecLivraison('livree')), 'Livraison : Livrée');
  assert.equal(ligneLivraison(avecLivraison('annulee')), 'Livraison : Livraison annulée');
  assert.equal(ligneLivraison(avecLivraison('vers_restaurant', 'speedfood')), 'Livraison : Le livreur va au restaurant');
  assert.equal(ligneLivraison(lue({ livraison: null })), null);
  assert.equal(ligneLivraison(lue({ mode: 'retrait', livraison: null })), null);
});

// ---------- code ----------
test('D5 code : le clavier ne laisse passer que des chiffres, quatre au plus ; la validation locale refuse tout autre code sans le citer', () => {
  assert.equal(chiffresDuCode('48 21'), '4821');
  assert.equal(chiffresDuCode('48a2b1c9'), '4821');
  assert.equal(chiffresDuCode('123456'), '1234');
  assert.equal(chiffresDuCode(undefined), '');
  assert.deepEqual(preparerCodeLivraison('0042'), { ok: true, code: '0042' });
  for (const mauvais of ['', '1', '123', '12345', 'abcd', '12 34', ' 1234', undefined, null, 1234]) {
    const p = preparerCodeLivraison(mauvais);
    assert.deepEqual(p, { ok: false, message: 'Le code doit avoir exactement 4 chiffres.' }, JSON.stringify(mauvais));
  }
  assert.ok(!JSON.stringify(preparerCodeLivraison('98765')).includes('98765'));
});

// ---------- machine d'états ----------
const attente = avecLivraison('assignee');
const enRoute = avecLivraison('vers_client');
const envoyerEv = (etat: EtatAction, action: 'livraison_partir' | 'livraison_livree' | 'livraison_annuler', extra: Record<string, unknown> = {}, id = A, lecture = 1) =>
  evoluer(etat, { type: 'envoyer', commandeId: id, action, lecture, ...extra } as never);

test('D5 machine : « Parti livrer » = un envoi ; verrouillé pendant l’envoi et la relecture ; le double appui ne produit AUCUN second envoi', () => {
  let e = envoyerEv(ETAT_REPOS, 'livraison_partir');
  assert.equal(e.phase, 'envoi');
  assert.equal(envoyerEv(e, 'livraison_partir'), e, 'double appui pendant l’envoi');
  e = evoluer(e, { type: 'repondre', erreur: null });
  assert.equal(e.phase, 'relecture');
  assert.equal(envoyerEv(e, 'livraison_partir'), e, 'double appui pendant la relecture');
  assert.equal(envoyerEv(e, 'livraison_annuler'), e);
  assert.equal(actionVerrouillee(e, 1), true);
});
test('D5 machine : « Livrée » ne part JAMAIS sans un code validé par l’écran (échec local : état inchangé, aucun verrou) ; avec un code validé, un seul envoi, verrouillé ensuite', () => {
  assert.equal(peutEnvoyer(ETAT_REPOS, A, 'livraison_livree', 1), false);
  assert.equal(peutEnvoyer(ETAT_REPOS, A, 'livraison_livree', 1, undefined, undefined, false), false);
  assert.equal(envoyerEv(ETAT_REPOS, 'livraison_livree'), ETAT_REPOS);
  assert.equal(envoyerEv(ETAT_REPOS, 'livraison_livree', { codeValide: false }), ETAT_REPOS);
  assert.equal(actionVerrouillee(ETAT_REPOS, 1), false);
  const e = envoyerEv(ETAT_REPOS, 'livraison_livree', { codeValide: true });
  assert.equal(e.phase, 'envoi');
  assert.equal(envoyerEv(e, 'livraison_livree', { codeValide: true }), e, 'double appui sur « Livrée »');
  assert.ok(!JSON.stringify(e).includes(CODE), 'l’état ne contient jamais de code');
});
test('D5 machine : « Annuler la livraison » exige sa confirmation (même commande, même action) avant l’envoi', () => {
  assert.ok((ACTIONS_A_CONFIRMER as readonly string[]).includes('livraison_annuler'));
  assert.equal(envoyerEv(ETAT_REPOS, 'livraison_annuler'), ETAT_REPOS, 'sans confirmation, pas d’envoi');
  let e = evoluer(ETAT_REPOS, { type: 'demander_confirmation', commandeId: A, action: 'livraison_annuler', lecture: 1 });
  assert.deepEqual(e, { phase: 'confirmation', commandeId: A, action: 'livraison_annuler' });
  assert.equal(envoyerEv(e, 'livraison_annuler', {}, B), e, 'confirmation d’une autre commande');
  e = envoyerEv(e, 'livraison_annuler');
  assert.equal(e.phase, 'envoi');
});
test('D5 confirmation : texte honnête (livraison annulée, client informé sur son suivi, non rétablissable, commande non annulée) et sans espèces', () => {
  const c = CONFIRMATIONS.livraison_annuler;
  assert.match(c.question, /livraison sera annulée/);
  assert.match(c.question, /client verra sur son suivi/);
  assert.match(c.question, /ne pourra pas être rétablie depuis l’application/);
  assert.match(c.question, /commande elle-même n’est pas annulée/);
  assert.ok(!/esp[eè]ces|cash|liquide/i.test(JSON.stringify(c)));
  assert.equal(actionLivraisonDe('livraison_partir'), 'partir');
  assert.equal(actionLivraisonDe('livraison_livree'), 'livree');
  assert.equal(actionLivraisonDe('livraison_annuler'), 'annuler');
  assert.equal(actionLivraisonDe('annuler'), null);
});

function parcours(action: 'livraison_partir' | 'livraison_livree' | 'livraison_annuler', erreur: ErreurRestaurateur | null, relue: CommandeRestaurateur | null | undefined, lectureRelue = 2) {
  let e: EtatAction = ETAT_REPOS;
  if (action === 'livraison_annuler') e = evoluer(e, { type: 'demander_confirmation', commandeId: A, action, lecture: 1 });
  e = envoyerEv(e, action, { codeValide: true });
  e = evoluer(e, { type: 'repondre', erreur });
  e = evoluer(e, { type: 'relire', relue, lecture: lectureRelue });
  return e as Extract<EtatAction, { phase: 'verdict' }>;
}
const incertaine = () => refusLivraisonRestaurateur(503);

test('D5 verdict : le serveur a répondu {ok:true} = confirmé ; « livrée » n’est confirmé QUE par le serveur (jamais par le seul envoi)', () => {
  assert.equal(parcours('livraison_partir', null, avecLivraison('vers_client')).verdict.genre, 'confirme');
  assert.equal(parcours('livraison_livree', null, avecLivraison('livree')).verdict.genre, 'confirme');
  // Pas de verdict « confirmé » au simple envoi : la machine passe par envoi puis relecture.
  const envoi = envoyerEv(ETAT_REPOS, 'livraison_livree', { codeValide: true });
  assert.equal(envoi.phase, 'envoi');
});
test('D5 verdict INCERTAIN (500) sans relecture réussie : verrouillé, jamais « pas enregistré, réessayez »', () => {
  for (const action of ['livraison_partir', 'livraison_livree', 'livraison_annuler'] as const) {
    const v = parcours(action, incertaine(), undefined, 1);
    assert.equal(v.verdict.genre, 'incertain');
    assert.equal((v.verdict as { reessayer: boolean }).reessayer, false);
    assert.ok(!/pas été enregistrée|n’a pas été enregistré|Vous pouvez réessayer|réessayez/i.test(v.verdict.message.replace('avant de réessayer', '')), v.verdict.message);
    assert.equal(actionVerrouillee(v, 1), true, 'verrouillé tant que la liste n’a pas été relue');
    assert.equal(envoyerEv(v, action, { codeValide: true }, A, 1), v, 'aucun nouvel envoi');
    assert.equal(actionVerrouillee(v, 2), false, 'déverrouillé par une relecture réussie');
  }
});
test('D5 verdict INCERTAIN puis relecture : l’état attendu = enregistré ; l’état d’avant avec bouton = nouvel essai MANUEL permis ; livraison introuvable = pas de réessai', () => {
  assert.equal(parcours('livraison_partir', incertaine(), avecLivraison('vers_client')).verdict.genre, 'confirme');
  assert.equal(parcours('livraison_livree', incertaine(), avecLivraison('livree')).verdict.genre, 'confirme');
  assert.equal(parcours('livraison_annuler', incertaine(), avecLivraison('annulee')).verdict.genre, 'confirme');
  const avant = parcours('livraison_livree', incertaine(), enRoute).verdict as { genre: string; reessayer: boolean; message: string };
  assert.equal(avant.genre, 'incertain');
  assert.equal(avant.reessayer, true);
  assert.match(avant.message, /remise n’est pas enregistrée/);
  const partir = parcours('livraison_partir', incertaine(), attente).verdict as { genre: string; reessayer: boolean };
  assert.deepEqual([partir.genre, partir.reessayer], ['incertain', true]);
  for (const absente of [lue({ livraison: null }), lue({ livraison: { id: 'x', statut: 'assignee', mode: 'propre' } })]) {
    const v = parcours('livraison_partir', incertaine(), absente).verdict as { genre: string; reessayer: boolean };
    assert.deepEqual([v.genre, v.reessayer], ['incertain', false], 'une livraison absente de la liste relue ne prouve rien');
  }
  const disparue = parcours('livraison_partir', incertaine(), null).verdict;
  assert.equal(disparue.genre, 'refus');
});
test('D5 verdict : « réessayer » n’est proposé que si le bouton existe encore (jamais sans bouton)', () => {
  // La livraison est partie (vers_client) alors qu’on tentait « partir » : état APRÈS, donc confirmé et non réessayable.
  const v = parcours('livraison_partir', incertaine(), avecLivraison('vers_client')).verdict;
  assert.equal(v.genre, 'confirme');
  // Livraison annulée entre-temps pendant qu’on tentait « partir » : ni avant ni après, aucun réessai.
  const annulee = parcours('livraison_partir', incertaine(), avecLivraison('annulee')).verdict as { genre: string; reessayer?: boolean };
  assert.equal(annulee.genre, 'refus');
  assert.notEqual(annulee.reessayer, true);
  // « Livrée » tenté alors que la commande n’est plus visible comme prête (pas de bouton) : jamais de réessai.
  const sansBouton = parcours('livraison_partir', incertaine(), avecLivraison('assignee', 'propre', { statut: 'acceptee' })).verdict as { genre: string; reessayer: boolean };
  assert.equal(sansBouton.reessayer, false);
});
test('D5 verdict : refus certain du serveur (code faux, 409) = refus, jamais converti en succès, déverrouillé', () => {
  const faux = refusLivraisonRestaurateur(400, null, { ok: false, erreur: { code: 'VALIDATION', message: 'Code incorrect.', champs: { raison: 'code_incorrect', essaisRestants: '3' } } });
  const v = parcours('livraison_livree', faux, enRoute).verdict as { genre: string; message: string };
  assert.equal(v.genre, 'refus');
  assert.match(v.message, /^Code incorrect\. Il reste 3 essais\.$/);
  assert.equal(actionVerrouillee(parcours('livraison_livree', faux, enRoute), 2), false);
  const securite = parcours('livraison_partir', refusLivraisonRestaurateur(403, 'mfa'), undefined).verdict;
  assert.deepEqual(securite, { genre: 'securite', message: 'Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.' });
});
test('D5 actions affichées : après une action confirmée sur une liste périmée, ses boutons de livraison ne reviennent pas', () => {
  const v = parcours('livraison_partir', null, attente);
  assert.equal(v.verdict.genre, 'confirme');
  assert.deepEqual(actionsAffichees(attente, v).filter(a => a.startsWith('livraison_')), [], 'liste encore à l’état d’avant : la famille livraison est retirée');
  assert.deepEqual(actionsAffichees(attente, ETAT_REPOS).filter(a => a.startsWith('livraison_')), ['livraison_partir', 'livraison_annuler']);
  assert.deepEqual(actionsAffichees(enRoute, v).filter(a => a.startsWith('livraison_')), ['livraison_livree'], 'liste à jour : l’étape suivante apparaît');
});

// ---------- messages du serveur reformulés ----------
test('D5 refus : code faux = essais restants reformulés (0, 1, n, inconnu) ; plafond atteint ; aucun message ne reprend le texte du serveur ni un code', () => {
  const faux = (essais?: string) => refusLivraisonRestaurateur(400, null, { erreur: { code: 'VALIDATION', message: 'Code incorrect. 4821 detail-confidentiel-serveur', champs: { raison: 'code_incorrect', ...(essais === undefined ? {} : { essaisRestants: essais }) } } });
  assert.equal(faux('3').message, 'Code incorrect. Il reste 3 essais.');
  assert.equal(faux('1').message, 'Code incorrect. Il reste 1 essai.');
  assert.equal(faux('0').message, 'Code incorrect. Il ne reste plus aucun essai : contactez l’assistance Speedfood.');
  assert.equal(faux().message, 'Code incorrect. Demandez-le au client et saisissez-le à nouveau.');
  assert.equal(faux('beaucoup').message, 'Code incorrect. Demandez-le au client et saisissez-le à nouveau.');
  assert.equal(faux('999').message, 'Code incorrect. Demandez-le au client et saisissez-le à nouveau.');
  const epuise = refusLivraisonRestaurateur(409, null, { erreur: { champs: { raison: 'essais_epuises' } } });
  assert.match(epuise.message, /Trop d’essais de code/);
  assert.equal(epuise.incertain, false);
  for (const e of [faux('3'), faux('0'), epuise, refusLivraisonRestaurateur(404), refusLivraisonRestaurateur(409), refusLivraisonRestaurateur(429), refusLivraisonRestaurateur(400), refusLivraisonRestaurateur(403), refusLivraisonRestaurateur(418)]) {
    assert.ok(!e.message.includes('detail-confidentiel-serveur') && !e.message.includes('4821'), e.message);
    assert.equal(e.incertain, false);
  }
  assert.equal(refusLivraisonRestaurateur(429).genre, 'limite');
  assert.equal(refusLivraisonRestaurateur(503).incertain, true);
  assert.equal(refusLivraisonRestaurateur(403, 'questions').genre, 'securite');
});

// ---------- client réseau ----------
type Appel = { url: string; options: RequestInit };
function api(repondre: (appel: Appel) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const a = creerAuth(async (url, options) => { const appel = { url: String(url), options: options ?? {} }; appels.push(appel); return repondre(appel); });
  return { a, appels };
}
const json = (corps: unknown, status = 200) => Response.json(corps, { status });
const URL_LIVRAISON = 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/livraison/action';

test('D5 client : « partir » et « annuler » = UN POST {livraisonId, action} sur la route de livraison, jeton porteur, sans code ni restaurant', async () => {
  for (const action of ['partir', 'annuler'] as const) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.actionLivraisonRestaurateur(ACCES, LIV, action, CODE);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, URL_LIVRAISON);
    assert.equal(appels[0].options.method, 'POST');
    assert.equal(appels[0].options.credentials, 'omit');
    assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), { livraisonId: LIV, action }, 'même avec un code fourni, il ne part pas');
  }
});
test('D5 client : « livree » = UN POST {livraisonId, action, code} avec le code à 4 chiffres, rien d’autre', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  await a.actionLivraisonRestaurateur(ACCES, LIV, 'livree', '0042');
  assert.equal(appels.length, 1);
  assert.deepEqual(JSON.parse(String(appels[0].options.body)), { livraisonId: LIV, action: 'livree', code: '0042' });
});
test('D5 client : un code mal formé, une action inconnue ou une livraison invalide n’atteignent JAMAIS le réseau (échec LOCAL, non incertain)', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  for (const code of [undefined, '', '1', '123', '12345', 'abcd', '12 34', ' 1234', '1234 ', '１２３４']) {
    await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, 'livree', code as never), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'local' && !e.incertain && e.message === 'Le code doit avoir exactement 4 chiffres.');
  }
  for (const action of ['echec', 'recuperee', 'PARTIR', '', 'accepter', 'vers_client']) await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, action as never), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'local' && !e.incertain);
  for (const id of ['', 'pas-un-uuid', 'x'.repeat(40)]) await assert.rejects(a.actionLivraisonRestaurateur(ACCES, id, 'partir'), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'local');
  assert.equal(appels.length, 0, 'aucun appel réseau');
});
test('D5 client : les actions de livraison ne passent PAS par les routes des commandes (actionRestaurateur les refuse avant le réseau)', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  for (const action of ['livraison_partir', 'livraison_livree', 'livraison_annuler']) await assert.rejects(a.actionRestaurateur(ACCES, A, action as never), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('D5 client : UN SEUL essai, même après 500, coupure réseau, délai ou réponse illisible ; l’erreur est incertaine et ne cite jamais le code', async () => {
  const cas: Array<() => Response | Promise<Response>> = [() => json({ ok: false }, 503), () => { throw new TypeError('réseau 4821'); }, () => new Response('pas du json', { status: 200, headers: { 'content-type': 'text/html' } }), () => json({ ok: 'oui' })];
  for (const repondre of cas) for (const action of ['partir', 'livree', 'annuler'] as const) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, action, CODE), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true && !e.message.includes(CODE));
    assert.equal(appels.length, 1);
  }
});
test('D5 client : refus certains (400 code faux, 404, 409, 429) non incertains ; le message du serveur n’est jamais repris', async () => {
  const corps = (champs: Record<string, string> = {}) => ({ ok: false, erreur: { code: 'X', message: 'detail-confidentiel-serveur ' + CODE, champs } });
  const cas: Array<[number, Record<string, string>, RegExp]> = [
    [400, { raison: 'code_incorrect', essaisRestants: '3' }, /^Code incorrect\. Il reste 3 essais\.$/],
    [400, {}, /n’a pas été acceptée/], [404, {}, /Livraison introuvable/], [409, {}, /ne peut pas avancer maintenant/], [409, { raison: 'essais_epuises' }, /Trop d’essais de code/], [429, {}, /Trop de tentatives/],
  ];
  for (const [statut, champs, motif] of cas) {
    const { a } = api(() => json(corps(champs), statut));
    await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, 'livree', CODE), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain && motif.test(e.message) && !e.message.includes('detail-confidentiel-serveur') && !e.message.includes(CODE));
  }
});
test('D5 client : 403 sécurité du compte = message vers le site ; 401 = session terminée', async () => {
  for (const raison of ['mfa', 'questions']) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE', message: 'texte serveur', champs: { securite: raison } } }, 403));
    await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, 'partir'), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite' && e.raison === raison && e.message === MESSAGE_SECURITE);
  }
  const { a } = api(() => json({ ok: false }, 401));
  await assert.rejects(a.actionLivraisonRestaurateur(ACCES, LIV, 'partir'), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});
test('D5 session : l’action de livraison passe le jeton d’accès, la livraison, l’action et le code ; une session terminée ferme la session', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const coffre = { v: 'renouvellement-factice' as string | null, lire: async () => coffre.v, ecrire: async (x: string) => { coffre.v = x; }, effacer: async () => { coffre.v = null; } };
  const vus: unknown[][] = [];
  const base = { connecter: async () => ({ accessToken: ACCES, refreshToken: 'renouvellement-factice', userId, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); }, espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); } };
  const g = new GestionSession({ ...base, actionLivraisonRestaurateur: async (...x: unknown[]) => { vus.push(x); } } as never, coffre);
  await g.connecter('essai@example.invalid', 'factice');
  await g.actionLivraisonRestaurateur(LIV, 'livree', CODE);
  assert.deepEqual(vus, [[ACCES, LIV, 'livree', CODE]]);
  const fin = new GestionSession({ ...base, actionLivraisonRestaurateur: async () => { throw new ErreurConnexion('Fin', true); } } as never, coffre);
  await fin.connecter('essai@example.invalid', 'factice');
  await assert.rejects(fin.actionLivraisonRestaurateur(LIV, 'partir'));
  assert.equal(fin.connectee, false);
});

// ---------- écran (texte source) ----------
const ecran = readFileSync(new URL('../src/connexion/RestaurateurReel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const domaine = readFileSync(new URL('../src/connexion/restaurateur.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('D5 écran : les trois boutons existent avec leurs libellés, verrouillés par `bloque`, et l’annulation passe par la confirmation', () => {
  assert.match(ecran, /titre=\{'Parti livrer ' \+ o\.reference\} disabled=\{bloque\}/);
  assert.match(ecran, /titre=\{'Livrée ' \+ o\.reference\} disabled=\{bloque\}/);
  assert.match(ecran, /titre=\{'Annuler la livraison ' \+ o\.reference\} secondaire disabled=\{bloque\} agir=\{\(\) => appliquer\(\{ type: 'demander_confirmation', commandeId: o\.id, action: 'livraison_annuler', lecture \}\)\}/);
  assert.match(ecran, /possibles\.includes\('livraison_partir'\)/);
  assert.match(ecran, /possibles\.includes\('livraison_livree'\)/);
  assert.match(ecran, /possibles\.includes\('livraison_annuler'\)/);
});
test('D5 écran : le champ du code est numérique, limité à 4, branché sur le clavier de l’écran (visible clavier ouvert) ; le code est validé AVANT l’envoi', () => {
  assert.match(ecran, /ref=\{reference\('code-' \+ o\.id\)\} onFocus=\{auFocus\('code-' \+ o\.id\)\} onBlur=\{auBlur\}/);
  assert.match(ecran, /keyboardType="number-pad" inputMode="numeric" maxLength=\{4\}/);
  assert.match(ecran, /const p = preparerCodeLivraison\(codes\[o\.id\]\);\n\s+if \(!p\.ok\) \{ setErreursCode\(x => \(\{ \.\.\.x, \[o\.id\]: p\.message \}\)\); return; \}\n\s+void envoyer\(o, 'livraison_livree', p\.code\);/);
  assert.match(ecran, /keyboardShouldPersistTaps="handled"/);
  assert.match(ecran, /margeBasseClavier\(hauteurClavier, Platform\.OS\)/);
});
test('D5 écran : le code n’entre jamais dans la machine d’états, est effacé dès l’envoi, ne sert qu’à l’appel, et n’est affiché dans aucun message', () => {
  assert.match(ecran, /envoiEnCours\.current = true;\n\s+oublierCode\(commande\.id\);/);
  assert.match(ecran, /codeValide: codeLivraison !== undefined/);
  assert.ok(!/type: 'envoyer'[^}]*codeLivraison[^!]/.test(ecran.replace('codeValide: codeLivraison !== undefined', '')), 'le code n’est pas dans l’événement de la machine');
  assert.equal((ecran.match(/gestion\.actionLivraisonRestaurateur\(/g) ?? []).length, 1, 'un seul appel réseau de livraison');
  assert.match(ecran, /gestion\.actionLivraisonRestaurateur\(livraison\.id, demande, demande === 'livree' \? codeLivraison : undefined\)/);
  assert.ok(!/console\./.test(ecran + domaine), 'aucune journalisation');
  assert.ok(!/AsyncStorage|SecureStore|setItem|coffre/i.test(ecran), 'le code n’est stocké nulle part');
  assert.ok(!/\{codes\[o\.id\]\}|\{codeLivraison\}|\+ codes\[|\+ codeLivraison/.test(ecran), 'le code n’est jamais concaténé dans un texte affiché');
});
test('D5 écran : la livraison est relue après chaque écriture (relecture de la liste), « livrée » vient de la liste du serveur, aucun libellé d’espèces', () => {
  assert.match(ecran, /try \{ const l = await gestion\.commandesRestaurant\(\); accepterListe\(l\); relue = l\.commandes\.find\(x => x\.id === commande\.id\) \?\? null; \}/);
  assert.match(ecran, /\{ligneLivraison\(o\) && <Text style=\{s\.texte\}>\{ligneLivraison\(o\)\}<\/Text>\}/);
  assert.ok(!/esp[eè]ces/i.test(ecran.replace(/Aucun bouton « espèces » : Speedfood ne manipule jamais d'espèces\./, '')), 'aucun libellé d’espèces dans l’écran');
  assert.ok(!/optimiste|setListe\(\(?[^)]*livree/i.test(ecran), 'aucune mise à jour optimiste de la liste');
  assert.match(ecran, /livraisonsIllisibles > 0/, 'une livraison illisible est signalée');
});

test('D5 commande TERMINÉE : livraison « livrée » = aucun bouton d’action (et la ligne « Livrée » s’affiche) ; terminée avant la remise (en route) = « Livrée » et « Annuler la livraison » restent', () => {
  const livree = avecLivraison('livree', 'propre', { statut: 'terminee' });
  assert.deepEqual(actionsPossibles(livree).filter(a => a.startsWith('livraison_')), []);
  assert.equal(ligneLivraison(livree), 'Livraison : Livrée');
  assert.deepEqual(actionsAffichees(livree, ETAT_REPOS).filter(a => a.startsWith('livraison_')), []);
  assert.deepEqual(possibles(avecLivraison('vers_client', 'propre', { statut: 'terminee' })), ['livraison_livree']);
  // Remise dont la réponse s'est perdue : la relecture montre la commande terminée avec sa livraison livrée = confirmé.
  assert.equal(parcours('livraison_livree', incertaine(), livree).verdict.genre, 'confirme');
});
