import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import {
  ETAT_REPOS, ErreurRestaurateur, MESSAGE_SECURITE, actionVerrouillee, actionsAffichees, actionsPossibles, erreurReponseRestaurateur, erreurReseauRestaurateur, evoluer, grouper, lireListeRestaurateur, lireRaisonSecurite,
  libellePaiement, ligneClient, lireReponseAction, lireRoles, peutEnvoyer, refusRestaurateur, verdictAction, type CommandeRestaurateur, type EtatAction,
} from '../src/connexion/restaurateur.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const brute = (id: string, surcharge: Record<string, unknown> = {}) => ({
  id, reference: 'SF-' + id.slice(-1).toUpperCase(), statut: 'en_attente', etatDerive: 'en_attente', mode: 'retrait', tableNumero: null, clientNom: 'Awa Diallo', clientTelephone: '+224 622 00 00 00', clientAdresse: null,
  sousTotal: 45000, fraisLivraisonEstime: 5000, creeLe: '2026-11-03T10:00:00.000Z', estTest: false, lignes: [{ nom: 'Poulet braisé', prix: 45000, quantite: 1, options: [{ nom: 'Piment', prix: 0 }] }],
  propositionActive: null, propositions: [], paiementStatut: 'non_demande', paiementMode: null, paiementReference: null, paiementRecuLe: null, paiementVisible: false, paiementLibelle: 'Paiement non demandé',
  documents: { recu: null, facture: null }, lienRecuWhatsApp: null, lienFactureWhatsApp: null, ...surcharge,
});
const reponse = (commandes: unknown[] = [brute(A)], restaurant: unknown = { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Fatou', ouvert: true, accepteCommandes: true }) => ({ ok: true, restaurant, commandes });
const lue = (surcharge: Record<string, unknown> = {}) => lireListeRestaurateur(reponse([brute(A, surcharge)])).commandes[0];
const attente = lue();

// ---------- lecture stricte ----------
test('lecture : commandes lues, total = sous-total + frais (entiers), ordre conservé', () => {
  const l = lireListeRestaurateur(reponse([brute(A), brute(B, { statut: 'acceptee' })]));
  assert.deepEqual(l.commandes.map(c => c.id), [A, B]);
  assert.equal(l.commandes[0].totalGnf, 50000);
  assert.deepEqual(l.commandes[0].lignes, [{ nom: 'Poulet braisé', quantite: 1, prixGnf: 45000, options: ['Piment'] }]);
  assert.equal(l.restaurant?.nom, 'Chez Fatou');
});
test('lecture : AUCUN jeton n’est retenu, même si le serveur en envoyait (reçu, suivi) ; les liens WhatsApp non plus', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { jetonRecu: 'r'.repeat(64), jetonSuivi: 's'.repeat(40), lienRecuWhatsApp: 'https://wa.me/224622000000?text=' + 'r'.repeat(64) })]));
  const texte = JSON.stringify(l);
  assert.ok(!texte.includes('jeton') && !texte.includes('r'.repeat(64)) && !texte.includes('s'.repeat(40)) && !texte.includes('wa.me'));
});
test('lecture : une ligne à valeur inconnue ou hors bornes est ÉCARTÉE et comptée (jamais toute la liste, jamais en silence)', () => {
  const cas: Array<unknown[]> = [
    [brute(A, { statut: 'attente_confirmation_client' })], [brute(A, { mode: 'drone' })], [brute(A, { sousTotal: 1.5 })], [brute(A, { sousTotal: -1 })], [brute(A, { id: 'pas-un-uuid' })],
    [brute(A), brute(A)], [brute(A, { creeLe: 'hier' })], [brute(A, { lignes: 'x' })], [brute(A, { lignes: [{ nom: 'x', prix: 1, quantite: 0, options: [] }] })], [brute(A, { estTest: 'non' })], [brute(A, { clientNom: '' })],
  ];
  for (const commandes of cas) {
    const l = lireListeRestaurateur(reponse([...commandes, brute(B)]));
    assert.deepEqual(l.commandes.map(c => c.id), commandes.length === 2 ? [A, B] : [B], 'la ligne valide voisine reste lisible : ' + JSON.stringify(commandes).slice(0, 80));
    assert.equal(l.illisibles, commandes.length === 2 ? 1 : commandes.length, 'chaque ligne écartée est comptée');
  }
  assert.throws(() => lireListeRestaurateur({ ok: false, commandes: [] }));
  assert.throws(() => lireListeRestaurateur({ ok: true, restaurant: null }));
  assert.throws(() => lireListeRestaurateur({ ok: true, commandes: 'x', restaurant: null }));
  assert.throws(() => lireListeRestaurateur(reponse([], { id: 'x', nom: 'N', ouvert: 'oui', accepteCommandes: true })));
  assert.equal(lireListeRestaurateur(reponse([], null)).restaurant, null);
});
test('lecture D2 : statut et mode de paiement lus (valeurs du contrat), référence nettoyée ; valeur inconnue = ligne écartée et comptée', () => {
  const c = lue({ statut: 'acceptee', paiementStatut: 'declare', paiementMode: 'orange_money', paiementReference: 'OM\n123456' });
  assert.deepEqual([c.paiementStatut, c.paiementMode, c.paiementReference], ['declare', 'orange_money', 'OM 123456']);
  assert.equal(lue({ paiementReference: '' }).paiementReference, null);
  for (const surcharge of [{ paiementStatut: 'rembourse' }, { paiementStatut: null }, { paiementMode: 'cheque' }, { paiementMode: 3 }]) {
    const l = lireListeRestaurateur(reponse([brute(A, surcharge), brute(B)]));
    assert.deepEqual(l.commandes.map(x => x.id), [B], JSON.stringify(surcharge));
    assert.equal(l.illisibles, 1);
  }
});
// ---------- commandes atypiques (revue I-1) ----------
const CONTROLES = String.fromCharCode(0, 7, 27, 127, 0x202e, 0x200f);
test('lecture I-1 : commande à table sans numéro de téléphone (chaîne vide) : lue, téléphone vide', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { mode: 'sur_place', tableNumero: '4', clientTelephone: '' })]));
  assert.equal(l.illisibles, 0);
  assert.equal(l.commandes[0].clientTelephone, '');
  assert.equal(l.commandes[0].mode, 'sur_place');
});
test('lecture I-1 : saut de ligne dans l’adresse : lue, saut de ligne devenu espace', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { mode: 'livraison', clientAdresse: 'Kaloum\nrue 12\r\nporte 3' })]));
  assert.equal(l.illisibles, 0);
  assert.equal(l.commandes[0].clientAdresse, 'Kaloum rue 12 porte 3');
});
test('lecture I-1 : tabulation dans le nom (et dans un plat) : lue, tabulation devenue espace', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { clientNom: 'Awa\tDiallo', lignes: [{ nom: 'Poulet\tbraisé', prix: 1000, quantite: 1, options: [{ nom: 'Sans\npiment', prix: 0 }] }] })]));
  assert.equal(l.illisibles, 0);
  assert.equal(l.commandes[0].clientNom, 'Awa Diallo');
  assert.deepEqual(l.commandes[0].lignes[0], { nom: 'Poulet braisé', quantite: 1, prixGnf: 1000, options: ['Sans piment'] });
});
test('lecture I-1 : caractères de contrôle et marques de direction retirés (jamais affichés) ; adresse vide = aucune adresse', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { clientNom: 'A' + CONTROLES + 'wa', clientAdresse: '  \n ' })]));
  assert.equal(l.commandes[0].clientNom, 'Awa');
  assert.equal(l.commandes[0].clientAdresse, null);
  assert.equal(JSON.stringify(l).split('').some(ch => { const k = ch.charCodeAt(0); return k < 32 || k === 127 || k === 0x202e || k === 0x200f; }), false);
});
test('lecture I-1 : liste mixte, une seule ligne invalide : les autres restent lisibles, la ligne écartée est comptée', () => {
  const C = '00000000-0000-4000-8000-00000000000c';
  const l = lireListeRestaurateur(reponse([brute(A), brute(B, { sousTotal: 1.5 }), brute(C, { clientTelephone: '' })]));
  assert.deepEqual(l.commandes.map(c => c.id), [A, C]);
  assert.equal(l.illisibles, 1);
  assert.equal(lireListeRestaurateur(reponse([brute(A)])).illisibles, 0);
});
test('lecture I-1 : un élément qui n’est pas un objet, un doublon d’identifiant : écartés et comptés', () => {
  const l = lireListeRestaurateur(reponse([brute(A), 'x', null, brute(A)]));
  assert.equal(l.commandes.length, 1);
  assert.equal(l.illisibles, 3);
});
test('rôles : lecture stricte de /moi', () => {
  assert.deepEqual(lireRoles({ ok: true, roles: { restaurateur: { restaurant: 'Chez Fatou' }, livreur: false, equipe: null } }), { restaurateur: { restaurant: 'Chez Fatou' }, livreur: false, equipe: null });
  assert.equal(lireRoles({ ok: true, roles: { restaurateur: null, livreur: true, equipe: 'support' } }).restaurateur, null);
  for (const roles of [null, {}, { restaurateur: {}, livreur: false, equipe: null }, { restaurateur: null, livreur: 'oui', equipe: null }]) assert.throws(() => lireRoles({ ok: true, roles }));
  assert.throws(() => lireRoles({ ok: false }));
});

// ---------- groupes et boutons ----------
test('groupes : à traiter (en attente), en cours (acceptée, prête), historique (terminée, refusée, annulée) ; ordre du serveur conservé', () => {
  const ids = ['en_attente', 'acceptee', 'prete', 'terminee', 'refusee', 'annulee'].map((statut, i) => brute(`00000000-0000-4000-8000-00000000001${i}`, { statut }));
  const g = grouper(lireListeRestaurateur(reponse(ids)).commandes);
  assert.deepEqual(g.map(x => x.titre), ['À traiter', 'En cours', 'Historique récent']);
  assert.deepEqual(g.map(x => x.commandes.map(c => c.statut)), [['en_attente'], ['acceptee', 'prete'], ['terminee', 'refusee', 'annulee']]);
});
const STATUTS_TOUS = ['en_attente', 'acceptee', 'prete', 'terminee', 'refusee', 'annulee'] as const;
const PAIEMENTS_TOUS = ['non_demande', 'especes', 'declare', 'recu', 'non_recu'] as const;
const MODES_TOUS = [null, 'especes', 'orange_money', 'mtn_momo', 'speedfood'] as const;
test('boutons : accepter et refuser seulement sur une commande en attente sans proposition en cours', () => {
  assert.deepEqual(actionsPossibles(attente), ['accepter', 'refuser']);
  assert.deepEqual(actionsPossibles(lue({ propositionActive: { id: 'p' } })), []);
});
test('boutons D2 : « Marquer prête » sur une commande acceptée, « Marquer terminée » sur une commande prête, rien d’autre', () => {
  assert.deepEqual(actionsPossibles(lue({ statut: 'acceptee' })), ['prete']);
  assert.deepEqual(actionsPossibles(lue({ statut: 'prete' })), ['terminee']);
  for (const statut of ['terminee', 'refusee', 'annulee']) assert.deepEqual(actionsPossibles(lue({ statut })), [], statut);
});
test('boutons D2 : « Marquer prête » JAMAIS sur une commande en attente (ni « terminée »), « terminée » jamais sur une commande acceptée', () => {
  assert.ok(!actionsPossibles(attente).includes('prete') && !actionsPossibles(attente).includes('terminee'));
  assert.ok(!actionsPossibles(lue({ statut: 'acceptee' })).includes('terminee'));
  assert.ok(!actionsPossibles(lue({ statut: 'prete' })).includes('prete'));
  assert.ok(!actionsPossibles(lue({ statut: 'prete' })).includes('accepter'));
});
test('boutons D2 : « Paiement reçu / non reçu » UNIQUEMENT pour un paiement déclaré par code marchand, sur une commande acceptée, prête ou terminée', () => {
  for (const statut of ['acceptee', 'prete', 'terminee']) {
    for (const mode of ['orange_money', 'mtn_momo']) {
      const a = actionsPossibles(lue({ statut, paiementStatut: 'declare', paiementMode: mode }));
      assert.ok(a.includes('paiement_recu') && a.includes('paiement_non_recu'), statut + ' ' + mode);
    }
  }
});
test('boutons D2 : toutes les combinaisons statut × paiement × mode — aucun bouton de paiement hors « déclaré par code marchand » (jamais d’espèces, jamais de paiement en ligne Speedfood)', () => {
  for (const statut of STATUTS_TOUS) for (const paiementStatut of PAIEMENTS_TOUS) for (const paiementMode of MODES_TOUS) {
    const a = actionsPossibles(lue({ statut, paiementStatut, paiementMode }));
    const attendu = ['acceptee', 'prete', 'terminee'].includes(statut) && paiementStatut === 'declare' && (paiementMode === 'orange_money' || paiementMode === 'mtn_momo');
    assert.equal(a.includes('paiement_recu'), attendu, [statut, paiementStatut, paiementMode].join(' '));
    assert.equal(a.includes('paiement_non_recu'), attendu, [statut, paiementStatut, paiementMode].join(' '));
    // Statut : exactement l’étape suivante, indépendamment du paiement.
    const statutAttendu = statut === 'en_attente' ? ['accepter', 'refuser'] : statut === 'acceptee' ? ['prete'] : statut === 'prete' ? ['terminee'] : [];
    assert.deepEqual(a.filter(x => !x.startsWith('paiement')), statutAttendu, [statut, paiementStatut, paiementMode].join(' '));
  }
});
test('boutons D2 : aucun bouton du tout pour les états finaux sans paiement à trancher, ni pour une proposition en cours (hors paiement)', () => {
  for (const statut of ['terminee', 'refusee', 'annulee']) assert.deepEqual(actionsPossibles(lue({ statut, paiementStatut: 'recu', paiementMode: 'orange_money' })), [], statut);
  assert.deepEqual(actionsPossibles(lue({ statut: 'acceptee', propositionActive: { id: 'p' } })), []);
});
test('affichage D2 : libellés de paiement fixes, jamais « espèces » ; ligne client sans séparateur vide (T2-1)', () => {
  const l = (surcharge: Record<string, unknown>) => libellePaiement(lue({ statut: 'acceptee', ...surcharge }));
  assert.equal(l({ paiementStatut: 'declare', paiementMode: 'orange_money', paiementReference: 'ABC1234' }), 'Paiement déclaré par le client · Orange Money · réf. ABC1234');
  assert.equal(l({ paiementStatut: 'recu', paiementMode: 'mtn_momo' }), 'Paiement reçu · MTN MoMo');
  assert.equal(l({ paiementStatut: 'non_demande', paiementMode: null }), 'Paiement non demandé');
  for (const paiementStatut of PAIEMENTS_TOUS) for (const paiementMode of MODES_TOUS) {
    const texte = l({ paiementStatut, paiementMode }) ?? '';
    assert.ok(!/esp[eè]ces/i.test(texte), texte);
  }
  assert.equal(l({ paiementStatut: 'especes', paiementMode: 'especes' }), null);
  assert.equal(libellePaiement(attente), null, 'rien à montrer avant l’acceptation');
  assert.equal(ligneClient(lue({ clientNom: 'Awa', clientTelephone: '' })), 'Awa');
  assert.equal(ligneClient(lue({ clientNom: 'Awa', clientTelephone: '+224 622 00 00 00' })), 'Awa · +224 622 00 00 00');
});
test('boutons D2 : liste À JOUR après une acceptation confirmée : le bouton de l’étape suivante (« prête ») apparaît ; liste PÉRIMÉE : rien', () => {
  const confirme: EtatAction = { phase: 'verdict', commandeId: A, action: 'accepter', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee' }), confirme), ['prete']);
  assert.deepEqual(actionsAffichees(attente, confirme), []);
  const pret: EtatAction = { phase: 'verdict', commandeId: A, action: 'prete', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(lue({ statut: 'prete' }), pret), ['terminee']);
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee' }), pret), [], 'liste périmée : pas de second envoi');
  const paye: EtatAction = { phase: 'verdict', commandeId: A, action: 'paiement_recu', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  const encoreDeclare = lue({ statut: 'acceptee', paiementStatut: 'declare', paiementMode: 'orange_money' });
  assert.deepEqual(actionsAffichees(encoreDeclare, paye), ['prete'], 'le paiement n’est plus proposé, la préparation reste possible');
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee', paiementStatut: 'recu', paiementMode: 'orange_money' }), paye), ['prete']);
});
test('boutons : retirés pour la commande dont l’action vient d’être confirmée (liste relue absente ou périmée)', () => {
  const confirme: EtatAction = { phase: 'verdict', commandeId: A, action: 'accepter', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(attente, confirme), []);
  assert.deepEqual(actionsAffichees({ ...attente, id: B }, confirme), ['accepter', 'refuser']);
  assert.deepEqual(actionsAffichees(attente, ETAT_REPOS), ['accepter', 'refuser']);
});

// ---------- table des refus ----------
test('refus : messages fixes par statut HTTP ; 403 avec raison = sécurité (message vers le site) ; 5xx = incertain', () => {
  assert.equal(MESSAGE_SECURITE, 'Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.');
  for (const raison of ['mfa', 'questions'] as const) {
    const e = refusRestaurateur(403, raison);
    assert.equal(e.genre, 'securite'); assert.equal(e.raison, raison); assert.equal(e.message, MESSAGE_SECURITE); assert.equal(e.incertain, false);
  }
  assert.equal(refusRestaurateur(403).genre, 'refus');
  for (const s of [400, 404, 409]) { const e = refusRestaurateur(s); assert.equal(e.genre, 'refus'); assert.equal(e.incertain, false); }
  assert.equal(refusRestaurateur(429).genre, 'limite');
  for (const s of [500, 502, 503]) { const e = refusRestaurateur(s); assert.equal(e.genre, 'serveur'); assert.equal(e.incertain, true); }
  assert.equal(erreurReseauRestaurateur().incertain, true);
  assert.equal(erreurReponseRestaurateur().incertain, true);
});
test('refus : la raison de sécurité est lue dans erreur.champs.securite, uniquement mfa ou questions', () => {
  assert.equal(lireRaisonSecurite({ ok: false, erreur: { code: 'NON_AUTORISE', champs: { securite: 'mfa' } } }), 'mfa');
  assert.equal(lireRaisonSecurite({ erreur: { champs: { securite: 'questions' } } }), 'questions');
  for (const corps of [null, 'x', {}, { erreur: {} }, { erreur: { champs: { securite: 'autre' } } }, { erreur: { champs: null } }]) assert.equal(lireRaisonSecurite(corps), null);
});
test('réponse 2xx : seul {ok:true} est un succès', () => {
  assert.doesNotThrow(() => lireReponseAction({ ok: true }));
  for (const v of [null, {}, { ok: false }, [], 'ok', { ok: 'true' }]) assert.throws(() => lireReponseAction(v));
});

// ---------- verdict ----------
const incertain = refusRestaurateur(503);
test('verdict : succès, refus certain, sécurité, session', () => {
  assert.deepEqual(verdictAction({ erreur: null, action: 'accepter', relue: undefined }), { genre: 'confirme', message: 'Commande acceptée.' });
  assert.equal(verdictAction({ erreur: null, action: 'refuser', relue: undefined }).message, 'Commande refusée.');
  const refus = verdictAction({ erreur: refusRestaurateur(409), action: 'accepter', relue: attente });
  assert.equal(refus.genre, 'refus');
  assert.deepEqual(verdictAction({ erreur: refusRestaurateur(403, 'mfa'), action: 'accepter', relue: undefined }), { genre: 'securite', message: MESSAGE_SECURITE });
  assert.equal(verdictAction({ erreur: null, sessionTerminee: 'Votre session a pris fin.', action: 'accepter', relue: undefined }).genre, 'session');
});
test('verdict : réponse incertaine, la liste relue décide ; jamais « réessayer » à l’aveugle', () => {
  assert.equal(verdictAction({ erreur: incertain, action: 'accepter', relue: lue({ statut: 'acceptee' }) }).genre, 'confirme');
  assert.equal(verdictAction({ erreur: incertain, action: 'accepter', relue: lue({ statut: 'prete' }) }).genre, 'confirme');
  assert.equal(verdictAction({ erreur: incertain, action: 'refuser', relue: lue({ statut: 'refusee' }) }).genre, 'confirme');
  const encore = verdictAction({ erreur: incertain, action: 'accepter', relue: attente });
  assert.deepEqual([encore.genre, (encore as { reessayer: boolean }).reessayer], ['incertain', true]);
  const aveugle = verdictAction({ erreur: incertain, action: 'accepter', relue: undefined });
  assert.deepEqual([aveugle.genre, (aveugle as { reessayer: boolean }).reessayer], ['incertain', false]);
  assert.equal(verdictAction({ erreur: incertain, action: 'accepter', relue: lue({ statut: 'refusee' }) }).genre, 'refus', 'autre état : jamais converti en succès');
  assert.equal(verdictAction({ erreur: incertain, action: 'refuser', relue: lue({ statut: 'acceptee' }) }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'accepter', relue: null }).genre, 'refus');
});

test('verdict D2 : messages de succès fixes pour prête, terminée, paiement reçu, non reçu', () => {
  const v = (action: never) => verdictAction({ erreur: null, action, relue: undefined }).message;
  assert.equal(v('prete' as never), 'Commande marquée prête.');
  assert.equal(v('terminee' as never), 'Commande marquée terminée.');
  assert.equal(v('paiement_recu' as never), 'Paiement confirmé comme reçu.');
  assert.equal(v('paiement_non_recu' as never), 'Paiement signalé comme non reçu.');
});
test('verdict D2 : réponse incertaine, la liste relue décide pour prête, terminée et paiement', () => {
  assert.equal(verdictAction({ erreur: incertain, action: 'prete', relue: lue({ statut: 'prete' }) }).genre, 'confirme');
  assert.equal(verdictAction({ erreur: incertain, action: 'prete', relue: lue({ statut: 'terminee' }) }).genre, 'confirme');
  const encore = verdictAction({ erreur: incertain, action: 'prete', relue: lue({ statut: 'acceptee' }) });
  assert.deepEqual([encore.genre, (encore as { reessayer: boolean }).reessayer], ['incertain', true]);
  assert.equal(verdictAction({ erreur: incertain, action: 'prete', relue: undefined }).genre, 'incertain');
  assert.equal((verdictAction({ erreur: incertain, action: 'prete', relue: undefined }) as { reessayer: boolean }).reessayer, false);
  assert.equal(verdictAction({ erreur: incertain, action: 'terminee', relue: lue({ statut: 'terminee' }) }).genre, 'confirme');
  assert.equal(verdictAction({ erreur: incertain, action: 'terminee', relue: lue({ statut: 'prete' }) }).genre, 'incertain');
  assert.equal(verdictAction({ erreur: incertain, action: 'terminee', relue: lue({ statut: 'annulee' }) }).genre, 'refus');
  const declare = { statut: 'acceptee', paiementMode: 'orange_money' };
  assert.equal(verdictAction({ erreur: incertain, action: 'paiement_recu', relue: lue({ ...declare, paiementStatut: 'recu' }) }).genre, 'confirme');
  assert.equal(verdictAction({ erreur: incertain, action: 'paiement_non_recu', relue: lue({ ...declare, paiementStatut: 'non_recu' }) }).genre, 'confirme');
  const encoreDeclare = verdictAction({ erreur: incertain, action: 'paiement_recu', relue: lue({ ...declare, paiementStatut: 'declare' }) });
  assert.deepEqual([encoreDeclare.genre, (encoreDeclare as { reessayer: boolean }).reessayer], ['incertain', true]);
  assert.equal(verdictAction({ erreur: incertain, action: 'paiement_recu', relue: lue({ ...declare, paiementStatut: 'non_recu' }) }).genre, 'refus', 'jamais converti en succès : l’autre décision a été prise');
  assert.equal(verdictAction({ erreur: incertain, action: 'paiement_non_recu', relue: lue({ ...declare, paiementStatut: 'recu' }) }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'paiement_recu', relue: null }).genre, 'refus');
  assert.equal(verdictAction({ erreur: refusRestaurateur(409), action: 'paiement_recu', relue: lue({ ...declare, paiementStatut: 'declare' }) }).genre, 'refus', 'refus certain : jamais converti');
  assert.deepEqual(verdictAction({ erreur: refusRestaurateur(403, 'mfa'), action: 'terminee', relue: undefined }), { genre: 'securite', message: MESSAGE_SECURITE });
});

// ---------- machine d'états : une transition par test ----------
test('machine : repos → confirmation du refus (demander_confirmation)', () => {
  assert.deepEqual(evoluer(ETAT_REPOS, { type: 'demander_confirmation', commandeId: A, action: 'refuser', lecture: 0 }), { phase: 'confirmation', commandeId: A, action: 'refuser' });
});
test('machine : confirmation → repos (annuler_confirmation) ; sans confirmation en cours, sans effet', () => {
  assert.deepEqual(evoluer({ phase: 'confirmation', commandeId: A, action: 'refuser' }, { type: 'annuler_confirmation' }), ETAT_REPOS);
  assert.equal(evoluer(ETAT_REPOS, { type: 'annuler_confirmation' }), ETAT_REPOS);
});
test('machine : accepter part directement de repos → envoi', () => {
  assert.deepEqual(evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 0 }), { phase: 'envoi', commandeId: A, action: 'accepter' });
});
test('machine : un refus n’est JAMAIS envoyé sans sa confirmation (repos, ou confirmation d’une autre commande)', () => {
  assert.equal(evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'refuser', lecture: 0 }), ETAT_REPOS);
  const autre: EtatAction = { phase: 'confirmation', commandeId: B, action: 'refuser' };
  assert.equal(evoluer(autre, { type: 'envoyer', commandeId: A, action: 'refuser', lecture: 0 }), autre);
  assert.equal(peutEnvoyer(ETAT_REPOS, A, 'refuser', 0), false);
});
test('machine : confirmation du refus → envoi', () => {
  assert.deepEqual(evoluer({ phase: 'confirmation', commandeId: A, action: 'refuser' }, { type: 'envoyer', commandeId: A, action: 'refuser', lecture: 0 }), { phase: 'envoi', commandeId: A, action: 'refuser' });
});
test('machine D2 : prête, terminée et « paiement reçu » partent directement de repos → envoi (sans confirmation)', () => {
  for (const action of ['prete', 'terminee', 'paiement_recu'] as const) {
    assert.deepEqual(evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action, lecture: 0 }), { phase: 'envoi', commandeId: A, action });
  }
});
test('machine D2 : « paiement non reçu » demande d’abord sa confirmation (même commande, même action) ; jamais d’envoi sans elle', () => {
  assert.deepEqual(evoluer(ETAT_REPOS, { type: 'demander_confirmation', commandeId: A, action: 'paiement_non_recu', lecture: 0 }), { phase: 'confirmation', commandeId: A, action: 'paiement_non_recu' });
  assert.equal(evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'paiement_non_recu', lecture: 0 }), ETAT_REPOS);
  const autreCommande: EtatAction = { phase: 'confirmation', commandeId: B, action: 'paiement_non_recu' };
  assert.equal(evoluer(autreCommande, { type: 'envoyer', commandeId: A, action: 'paiement_non_recu', lecture: 0 }), autreCommande);
  const confirmationRefus: EtatAction = { phase: 'confirmation', commandeId: A, action: 'refuser' };
  assert.equal(evoluer(confirmationRefus, { type: 'envoyer', commandeId: A, action: 'paiement_non_recu', lecture: 0 }), confirmationRefus, 'la confirmation d’un refus ne vaut pas pour un paiement');
  assert.equal(peutEnvoyer(ETAT_REPOS, A, 'paiement_non_recu', 0), false);
  assert.deepEqual(evoluer({ phase: 'confirmation', commandeId: A, action: 'paiement_non_recu' }, { type: 'envoyer', commandeId: A, action: 'paiement_non_recu', lecture: 0 }), { phase: 'envoi', commandeId: A, action: 'paiement_non_recu' });
});
test('machine D2 : seules les actions à confirmer peuvent demander une confirmation ; une action inconnue ne s’envoie jamais', () => {
  for (const action of ['accepter', 'prete', 'terminee', 'paiement_recu'] as const) assert.equal(evoluer(ETAT_REPOS, { type: 'demander_confirmation', commandeId: A, action, lecture: 0 }), ETAT_REPOS, action);
  assert.equal(evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'annuler' as never, lecture: 0 }), ETAT_REPOS);
  assert.equal(peutEnvoyer(ETAT_REPOS, A, 'annuler' as never, 0), false);
});
test('machine D2 : verrouillé pendant l’envoi d’une action de paiement ; réponse incertaine puis relecture échouée : verrouillé jusqu’à une relecture réussie', () => {
  let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'paiement_recu', lecture: 5 });
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: B, action: 'prete', lecture: 5 }), e);
  e = evoluer(e, { type: 'repondre', erreur: incertain });
  e = evoluer(e, { type: 'relire', relue: undefined, lecture: 5 });
  assert.equal(actionVerrouillee(e, 5), true);
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: A, action: 'paiement_recu', lecture: 5 }), e);
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: B, action: 'prete', lecture: 5 }), e);
  assert.equal(evoluer(e, { type: 'demander_confirmation', commandeId: A, action: 'paiement_non_recu', lecture: 5 }), e);
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: A, action: 'paiement_recu', lecture: 6 }).phase, 'envoi');
});
test('machine D2 : erreur MFA/questions sur « terminée » → verdict « sécurité » avec le message vers le site', () => {
  let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'terminee', lecture: 0 });
  e = evoluer(e, { type: 'repondre', erreur: refusRestaurateur(403, 'questions') });
  e = evoluer(e, { type: 'relire', relue: undefined, lecture: 0 });
  assert.deepEqual((e as { verdict: unknown }).verdict, { genre: 'securite', message: MESSAGE_SECURITE });
});
test('machine : verrouillé PENDANT l’envoi et la relecture : ni nouvel envoi, ni nouvelle demande de refus', () => {
  const envoi: EtatAction = { phase: 'envoi', commandeId: A, action: 'accepter' };
  const relecture: EtatAction = { phase: 'relecture', commandeId: A, action: 'accepter', erreur: null, sessionTerminee: null };
  for (const e of [envoi, relecture]) {
    assert.equal(actionVerrouillee(e, 0), true);
    assert.equal(evoluer(e, { type: 'envoyer', commandeId: B, action: 'accepter', lecture: 0 }), e);
    assert.equal(evoluer(e, { type: 'demander_confirmation', commandeId: B, action: 'refuser', lecture: 0 }), e);
  }
});
test('machine : envoi → relecture à la réponse (succès, refus, incertain, session) ; hors envoi, sans effet', () => {
  const envoi: EtatAction = { phase: 'envoi', commandeId: A, action: 'accepter' };
  assert.deepEqual(evoluer(envoi, { type: 'repondre', erreur: null }), { phase: 'relecture', commandeId: A, action: 'accepter', erreur: null, sessionTerminee: null });
  assert.equal((evoluer(envoi, { type: 'repondre', erreur: incertain }) as { erreur: unknown }).erreur, incertain);
  assert.equal((evoluer(envoi, { type: 'repondre', erreur: null, sessionTerminee: 'fin' }) as { sessionTerminee: unknown }).sessionTerminee, 'fin');
  assert.equal(evoluer(ETAT_REPOS, { type: 'repondre', erreur: null }), ETAT_REPOS);
});
test('machine : relecture → verdict (le verdict vient de la liste relue) ; hors relecture, sans effet', () => {
  const relecture: EtatAction = { phase: 'relecture', commandeId: A, action: 'accepter', erreur: incertain, sessionTerminee: null };
  const suivant = evoluer(relecture, { type: 'relire', relue: lue({ statut: 'acceptee' }), lecture: 3 });
  assert.equal(suivant.phase, 'verdict');
  assert.equal((suivant as { verdict: { genre: string } }).verdict.genre, 'confirme');
  assert.equal((suivant as { lectureVerdict: number }).lectureVerdict, 3);
  assert.equal(evoluer(ETAT_REPOS, { type: 'relire', relue: undefined, lecture: 1 }), ETAT_REPOS);
});
test('machine : réponse incertaine puis relecture ÉCHOUÉE : boutons verrouillés jusqu’à une relecture réussie (compteur de lectures)', () => {
  let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 5 });
  e = evoluer(e, { type: 'repondre', erreur: incertain });
  e = evoluer(e, { type: 'relire', relue: undefined, lecture: 5 });
  assert.equal(actionVerrouillee(e, 5), true, 'toujours verrouillé : aucune lecture réussie depuis');
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 5 }), e, 'un nouvel essai est refusé');
  assert.equal(evoluer(e, { type: 'demander_confirmation', commandeId: A, action: 'refuser', lecture: 5 }), e);
  assert.equal(actionVerrouillee(e, 6), false, 'une lecture réussie (compteur 6) déverrouille');
  assert.equal(evoluer(e, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 6 }).phase, 'envoi');
});
test('machine : réponse incertaine puis relecture RÉUSSIE montrant la commande encore en attente : déverrouillé, un seul nouvel essai à la main', () => {
  let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 5 });
  e = evoluer(e, { type: 'repondre', erreur: incertain });
  e = evoluer(e, { type: 'relire', relue: attente, lecture: 6 });
  assert.equal((e as { verdict: { genre: string; reessayer: boolean } }).verdict.reessayer, true);
  assert.equal(actionVerrouillee(e, 6), false);
});
test('machine : refus certain (conflit) ou sécurité : jamais verrouillé par l’incertitude, mais jamais converti en succès', () => {
  for (const erreur of [refusRestaurateur(409), refusRestaurateur(403, 'questions'), refusRestaurateur(429)]) {
    let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'accepter', lecture: 1 });
    e = evoluer(e, { type: 'repondre', erreur });
    e = evoluer(e, { type: 'relire', relue: attente, lecture: 2 });
    assert.notEqual((e as { verdict: { genre: string } }).verdict.genre, 'confirme');
    assert.equal(actionVerrouillee(e, 2), false);
  }
});
test('machine : erreur MFA/questions → verdict « sécurité » avec le message vers le site', () => {
  let e: EtatAction = evoluer(ETAT_REPOS, { type: 'envoyer', commandeId: A, action: 'refuser', lecture: 0 });
  assert.equal(e.phase, 'repos', 'sans confirmation, pas d’envoi');
  e = evoluer(evoluer(ETAT_REPOS, { type: 'demander_confirmation', commandeId: A, action: 'refuser', lecture: 0 }), { type: 'envoyer', commandeId: A, action: 'refuser', lecture: 0 });
  e = evoluer(e, { type: 'repondre', erreur: refusRestaurateur(403, 'mfa') });
  e = evoluer(e, { type: 'relire', relue: undefined, lecture: 0 });
  assert.deepEqual((e as { verdict: unknown }).verdict, { genre: 'securite', message: 'Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.' });
});
test('machine : après un verdict déverrouillé on peut agir sur une autre commande ; effacer revient au repos', () => {
  const verdict: EtatAction = { phase: 'verdict', commandeId: A, action: 'accepter', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.equal(evoluer(verdict, { type: 'envoyer', commandeId: B, action: 'accepter', lecture: 1 }).phase, 'envoi');
  assert.equal(evoluer(verdict, { type: 'effacer' }), ETAT_REPOS);
});

// ---------- client : routes, jeton porteur, un seul essai ----------
const ACCES = 'acces-factice';
type Appel = { url: string; options: RequestInit };
function api(repondre: (appel: Appel) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const a = creerAuth(async (url, options) => { const appel = { url: String(url), options: options ?? {} }; appels.push(appel); return repondre(appel); });
  return { a, appels };
}
const json = (corps: unknown, status = 200) => Response.json(corps, { status });

test('client : liste des commandes = GET sur la route du restaurateur de l’API, jeton porteur, sans cookie', async () => {
  const { a, appels } = api(() => json(reponse()));
  const l = await a.commandesRestaurant(ACCES);
  assert.equal(l.commandes.length, 1);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes');
  assert.equal(appels[0].options.method, 'GET');
  assert.equal(appels[0].options.credentials, 'omit');
  assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
});
test('client D2 : paiement = POST {commandeId, decision} SEULEMENT sur la route paiement, jeton porteur, un seul appel', async () => {
  for (const [action, decision] of [['paiement_recu', 'recu'], ['paiement_non_recu', 'non_recu']] as const) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.actionRestaurateur(ACCES, A, action);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/paiement');
    assert.equal(appels[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, decision });
    assert.equal(appels[0].options.credentials, 'omit');
    assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  }
});
test('client : action = POST {commandeId, action} SEULEMENT (jamais de restaurant), jeton porteur, un seul appel', async () => {
  for (const action of ['accepter', 'refuser', 'prete', 'terminee'] as const) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.actionRestaurateur(ACCES, A, action);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/action');
    assert.equal(appels[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, action });
    assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  }
});
test('client : toute autre action (annuler, livrer, valeur inconnue…) ou identifiant invalide est refusé AVANT le réseau', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  for (const action of ['annuler', 'livree', 'partir', 'recu', 'non_recu', 'especes', 'inconnue', '']) await assert.rejects(a.actionRestaurateur(ACCES, A, action as never), ErreurRestaurateur);
  await assert.rejects(a.actionRestaurateur(ACCES, 'pas-un-uuid', 'accepter'), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('client : UN SEUL essai, même après 500, coupure réseau ou réponse illisible (jamais de relance automatique) ; l’erreur est incertaine', async () => {
  const cas: Array<() => Response | Promise<Response>> = [() => json({ ok: false }, 503), () => { throw new TypeError('réseau'); }, () => new Response('pas du json', { status: 200, headers: { 'content-type': 'text/html' } }), () => json({ ok: 'oui' })];
  for (const repondre of cas) for (const action of ['accepter', 'terminee', 'paiement_recu'] as const) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.actionRestaurateur(ACCES, A, action), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true);
    assert.equal(appels.length, 1);
  }
});
test('client : refus certains (400, 404, 409, 429) non incertains, sans texte du serveur (actions de statut et de paiement)', async () => {
  for (const [statut, action] of [400, 404, 409, 429].flatMap(x => (['accepter', 'prete', 'paiement_recu'] as const).map(y => [x, y] as const))) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'X', message: 'detail-confidentiel-serveur' } }, statut));
    await assert.rejects(a.actionRestaurateur(ACCES, A, action), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain && !e.message.includes('detail-confidentiel-serveur'));
  }
});
test('client : 403 avec champs.securite = erreur « sécurité » (message vers le site), en lecture comme en action', async () => {
  for (const raison of ['mfa', 'questions']) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE', message: 'texte serveur', champs: { securite: raison } } }, 403));
    const attendu = (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite' && e.raison === raison && e.message === MESSAGE_SECURITE;
    await assert.rejects(a.commandesRestaurant(ACCES), attendu);
    await assert.rejects(a.actionRestaurateur(ACCES, A, 'refuser'), attendu);
  }
  const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE' } }, 403));
  await assert.rejects(a.commandesRestaurant(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'refus');
});
test('client M-4 : compte non membre qui LIT la liste : message propre à la lecture (pas « ne peut pas traiter cette commande »)', async () => {
  const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE' } }, 403));
  await assert.rejects(a.commandesRestaurant(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'refus' && /restaurant/.test(e.message) && !/traiter cette commande/.test(e.message));
  await assert.rejects(a.actionRestaurateur(ACCES, A, 'accepter'), (e: unknown) => e instanceof ErreurRestaurateur && /traiter cette commande/.test(e.message));
});
test('client : 401 = session terminée (ErreurConnexion définitive), en lecture comme en action', async () => {
  const { a } = api(() => json({ ok: false }, 401));
  await assert.rejects(a.commandesRestaurant(ACCES), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
  await assert.rejects(a.actionRestaurateur(ACCES, A, 'accepter'), (e: unknown) => e instanceof ErreurConnexion && e.definitive);
});
test('client : lecture en panne ou illisible : erreur de lecture (non incertaine), liste jamais acceptée à moitié', async () => {
  for (const repondre of [() => json({}, 500), () => { throw new TypeError('réseau'); }, () => json({ ok: true, restaurant: null, commandes: 'x' })]) {
    const { a } = api(repondre);
    await assert.rejects(a.commandesRestaurant(ACCES), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain);
  }
});
test('client : /moi = GET avec jeton porteur, rôles lus strictement', async () => {
  const { a, appels } = api(() => json({ ok: true, roles: { restaurateur: { restaurant: 'Chez Fatou' }, livreur: false, equipe: null } }));
  assert.equal((await a.moi(ACCES)).restaurateur?.restaurant, 'Chez Fatou');
  assert.ok(appels[0].url.endsWith('/api/v1/moi'));
  assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  const mauvais = api(() => json({ ok: true, roles: { restaurateur: 3 } }));
  await assert.rejects(mauvais.a.moi(ACCES), ErreurConnexion);
});

// ---------- session ----------
const userId = '00000000-0000-4000-8000-000000000001';
function gestion(surcharge: Record<string, unknown> = {}) {
  const coffre = { v: 'renouvellement-factice' as string | null, lire: async () => coffre.v, ecrire: async (x: string) => { coffre.v = x; }, effacer: async () => { coffre.v = null; } };
  const a = {
    connecter: async () => ({ accessToken: ACCES, refreshToken: 'renouvellement-factice', userId, expiresAt: 9999999999 }), renouveler: async () => { throw Error(); },
    espace: async () => ({ pseudo: null, favoris: 0, adresses: 0 }), deconnecter: async () => {}, commandes: async () => [], annuler: async () => ({ reference: 'x' }), suivi: async () => { throw Error(); }, ...surcharge,
  };
  return { g: new GestionSession(a as never, coffre), coffre };
}
test('session : moi, liste et action passent le jeton d’accès ; l’action ne reçoit que l’identifiant de la commande et l’action', async () => {
  const vus: unknown[][] = [];
  const { g } = gestion({
    moi: async (...x: unknown[]) => { vus.push(['moi', ...x]); return { restaurateur: { restaurant: 'R' }, livreur: false, equipe: null }; },
    commandesRestaurant: async (...x: unknown[]) => { vus.push(['liste', ...x]); return { restaurant: null, commandes: [] }; },
    actionRestaurateur: async (...x: unknown[]) => { vus.push(['action', ...x]); },
  });
  await g.connecter('essai@example.invalid', 'factice');
  await g.moi(); await g.commandesRestaurant(); await g.actionRestaurateur(A, 'accepter');
  assert.deepEqual(vus, [['moi', ACCES], ['liste', ACCES], ['action', ACCES, A, 'accepter']]);
});
test('session : une session terminée (401) pendant l’espace restaurateur ferme et efface la session', async () => {
  for (const methode of ['commandesRestaurant', 'actionRestaurateur', 'moi']) {
    const { g, coffre } = gestion({ [methode]: async () => { throw new ErreurConnexion('Fin', true); } });
    await g.connecter('essai@example.invalid', 'factice');
    await assert.rejects(methode === 'moi' ? g.moi() : methode === 'commandesRestaurant' ? g.commandesRestaurant() : g.actionRestaurateur(A, 'refuser'));
    assert.equal(g.connectee, false, methode);
    assert.equal(coffre.v, null, methode);
  }
});
test('session : une erreur de sécurité (MFA) ne déconnecte pas', async () => {
  const { g } = gestion({ commandesRestaurant: async () => { throw refusRestaurateur(403, 'mfa'); } });
  await g.connecter('essai@example.invalid', 'factice');
  await assert.rejects(g.commandesRestaurant(), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite');
  assert.equal(g.connectee, true);
});
test('session : sans connexion, aucune lecture ni action restaurateur', async () => {
  const { g } = gestion({ commandesRestaurant: async () => ({ restaurant: null, commandes: [] }) });
  await assert.rejects(g.commandesRestaurant(), ErreurConnexion);
  await assert.rejects(g.actionRestaurateur(A, 'accepter'), ErreurConnexion);
});
