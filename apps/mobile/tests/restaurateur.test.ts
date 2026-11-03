import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth, ErreurConnexion } from '../src/connexion/client.ts';
import { GestionSession } from '../src/connexion/session.ts';
import {
  ETAT_REPOS, ErreurRestaurateur, MESSAGE_SECURITE, actionVerrouillee, actionsAffichees, actionsPossibles, erreurReponseRestaurateur, erreurReseauRestaurateur, evoluer, grouper, lireListeRestaurateur, lireRaisonSecurite,
  libellePaiement, ligneClient, commandePayee, annulationRefuseePourPaiement, MESSAGE_DEJA_PAYEE, lireReponseAction, lireRoles, peutEnvoyer, refusRestaurateur, verdictAction, type CommandeRestaurateur, type EtatAction,
  CONFIRMATIONS, analyserMontantGnf, formaterGnf, formulaireOuvert, libelleStatut, lignesRecapProposition, preparerProposition, recapProposition,
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
test('boutons : accepter, refuser, proposer un autre prix et annuler sur une commande en attente sans proposition en cours ; seule l’annulation pendant une proposition', () => {
  assert.deepEqual(actionsPossibles(attente), ['accepter', 'refuser', 'proposer', 'annuler']);
  assert.deepEqual(actionsPossibles(lue({ propositionActive: { id: 'p' } })), ['annuler']);
});
test('boutons D2 : « Marquer prête » sur une commande acceptée, « Marquer terminée » sur une commande prête, rien d’autre', () => {
  assert.deepEqual(actionsPossibles(lue({ statut: 'acceptee' })), ['prete', 'annuler']);
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
    const annulable = (paiementStatut === 'non_demande' || paiementStatut === 'non_recu') && paiementMode !== 'speedfood'; // option prudente : jamais d’annulation d’une commande payée
    const statutAttendu = statut === 'en_attente' ? ['accepter', 'refuser', 'proposer', ...(annulable ? ['annuler'] : [])] : statut === 'acceptee' ? ['prete', ...(annulable ? ['annuler'] : [])] : statut === 'prete' ? ['terminee'] : [];
    assert.deepEqual(a.filter(x => !x.startsWith('paiement')), statutAttendu, [statut, paiementStatut, paiementMode].join(' '));
  }
});
test('boutons D2 : aucun bouton du tout pour les états finaux sans paiement à trancher, ni pour une proposition en cours (hors paiement)', () => {
  for (const statut of ['terminee', 'refusee', 'annulee']) assert.deepEqual(actionsPossibles(lue({ statut, paiementStatut: 'recu', paiementMode: 'orange_money' })), [], statut);
  assert.deepEqual(actionsPossibles(lue({ statut: 'acceptee', propositionActive: { id: 'p' } })), ['prete', 'annuler'], 'une proposition ne concerne que les commandes en attente');
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
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee' }), confirme), ['prete', 'annuler']);
  assert.deepEqual(actionsAffichees(attente, confirme), []);
  const pret: EtatAction = { phase: 'verdict', commandeId: A, action: 'prete', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(lue({ statut: 'prete' }), pret), ['terminee']);
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee' }), pret), [], 'liste périmée : pas de second envoi');
  const paye: EtatAction = { phase: 'verdict', commandeId: A, action: 'paiement_recu', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  const encoreDeclare = lue({ statut: 'acceptee', paiementStatut: 'declare', paiementMode: 'orange_money' });
  assert.deepEqual(actionsAffichees(encoreDeclare, paye), ['prete'], 'le paiement n’est plus proposé, la préparation reste possible, l’annulation non (commande payée)');
  assert.deepEqual(actionsAffichees(lue({ statut: 'acceptee', paiementStatut: 'recu', paiementMode: 'orange_money' }), paye), ['prete']);
});
test('boutons : retirés pour la commande dont l’action vient d’être confirmée (liste relue absente ou périmée)', () => {
  const confirme: EtatAction = { phase: 'verdict', commandeId: A, action: 'accepter', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(attente, confirme), []);
  assert.deepEqual(actionsAffichees({ ...attente, id: B }, confirme), ['accepter', 'refuser', 'proposer', 'annuler']);
  assert.deepEqual(actionsAffichees(attente, ETAT_REPOS), ['accepter', 'refuser', 'proposer', 'annuler']);
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
  for (const action of ['accepter', 'refuser', 'prete', 'terminee', 'annuler'] as const) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.actionRestaurateur(ACCES, A, action);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/action');
    assert.equal(appels[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, action });
    assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  }
});
test('client : toute autre action (livrer, « proposer » sans montants, valeur inconnue…) ou identifiant invalide est refusé AVANT le réseau', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  for (const action of ['proposer', 'Annuler', 'livree', 'partir', 'recu', 'non_recu', 'especes', 'inconnue', '']) await assert.rejects(a.actionRestaurateur(ACCES, A, action as never), ErreurRestaurateur);
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

// ======================= lot D3 : annuler et proposer un autre prix =======================
const PRIX = { sousTotalGnf: 45000, fraisGnf: 5000 };
const brouillon = (surcharge: Partial<{ sousTotal: string; frais: string; conditions: string }> = {}) => ({ sousTotal: '45000', frais: '5000', conditions: '', ...surcharge });
const repos = ETAT_REPOS;

test('lecture D3 : sous-total et frais de livraison lus séparément (entiers) pour le récapitulatif, le total reste leur somme', () => {
  assert.deepEqual([attente.sousTotalGnf, attente.fraisGnf, attente.totalGnf], [45000, 5000, 50000]);
});

// ---------- saisie des montants ----------
test('montant D3 : chiffres seuls ou groupés par milliers (espace, insécable, fine), avec espaces autour', () => {
  const ok: Array<[string, number]> = [['0', 0], ['7', 7], ['007', 7], ['25000', 25000], ['25 000', 25000], ['25\u00a0000', 25000], ['25\u202f000', 25000], [' 25 000 ', 25000], ['1 000 000', 1000000], ['10000000', 10000000], ['10 000 000', 10000000], ['999', 999]];
  for (const [saisie, attendu] of ok) assert.equal(analyserMontantGnf(saisie), attendu, JSON.stringify(saisie));
});
test('montant D3 : virgule, point, lettres, signes, vide, groupement faux, hors bornes et non-textes sont REFUSÉS (jamais NaN ni Infinity)', () => {
  const refus: unknown[] = ['', ' ', '25,5', '25.5', '1.000', '1,000', '1 000,00', '12a', 'abc', 'mille', '-5', '+5', '1e3', '0x10', 'NaN', 'Infinity', '-Infinity', '10000001', '10 000 001', '99999999', '2 5000', '25 00', '1 0000', '١٢٣', '１２３',
    '5 \n', '5\t0', 'GNF 5000', '5000 GNF', '5000€', '1  000', '25 000 000 000', 'x'.repeat(41), '9'.repeat(30), null, undefined, 5000, NaN, Infinity, true, ['5000'], { v: 1 }];
  for (const saisie of refus) assert.equal(analyserMontantGnf(saisie), null, JSON.stringify(saisie) ?? String(saisie));
  for (const saisie of ['0', '1 000', '10000000']) { const n = analyserMontantGnf(saisie); assert.ok(Number.isSafeInteger(n)); }
});
test('affichage D3 : montants GNF groupés par milliers, sans décimale', () => {
  assert.equal(formaterGnf(0), '0');
  assert.equal(formaterGnf(999), '999');
  assert.equal(formaterGnf(25000), '25\u00a0000');
  assert.equal(formaterGnf(10000000), '10\u00a0000\u00a0000');
});

// ---------- préparation de la proposition ----------
test('proposition D3 : saisie valide → valeurs entières et récapitulatif ancien → nouveau (l’ancien prix à gauche)', () => {
  const p = preparerProposition(PRIX, brouillon({ sousTotal: '52 000', frais: '7000', conditions: '  Un plat est remplacé.  ' }));
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.deepEqual(p.valeurs, { nouveauSousTotal: 52000, nouveauxFraisLivraison: 7000, conditionsModifiees: 'Un plat est remplacé.' });
  assert.deepEqual(p.recap, { ancienSousTotal: 45000, nouveauSousTotal: 52000, ancienFrais: 5000, nouveauxFrais: 7000, ancienTotal: 50000, nouveauTotal: 59000, conditions: 'Un plat est remplacé.' });
  assert.deepEqual(lignesRecapProposition(p.recap), [
    'Sous-total : 45\u00a0000 GNF → 52\u00a0000 GNF', 'Frais de livraison : 5\u00a0000 GNF → 7\u00a0000 GNF', 'Total : 50\u00a0000 GNF → 59\u00a0000 GNF',
  ]);
});
test('récapitulatif D3 : l’ancien et le nouveau prix ne sont JAMAIS confondus (valeurs toutes différentes)', () => {
  const r = recapProposition({ sousTotalGnf: 1000, fraisGnf: 200 }, { nouveauSousTotal: 3000, nouveauxFraisLivraison: 400, conditionsModifiees: null });
  assert.deepEqual([r.ancienSousTotal, r.nouveauSousTotal, r.ancienFrais, r.nouveauxFrais, r.ancienTotal, r.nouveauTotal], [1000, 3000, 200, 400, 1200, 3400]);
  const [sousTotal, frais, total] = lignesRecapProposition(r);
  assert.equal(sousTotal, 'Sous-total : 1\u00a0000 GNF → 3\u00a0000 GNF');
  assert.equal(frais, 'Frais de livraison : 200 GNF → 400 GNF');
  assert.equal(total, 'Total : 1\u00a0200 GNF → 3\u00a0400 GNF');
});
test('proposition D3 : seules des conditions, ou un seul montant modifié, suffisent ; rien de modifié est refusé', () => {
  assert.ok(preparerProposition(PRIX, brouillon({ conditions: 'Livraison possible vers Kaloum seulement.' })).ok);
  assert.ok(preparerProposition(PRIX, brouillon({ sousTotal: '46000' })).ok);
  assert.ok(preparerProposition(PRIX, brouillon({ frais: '0' })).ok);
  for (const b of [brouillon(), brouillon({ conditions: '   \n  ' }), brouillon({ sousTotal: '45 000' })]) {
    const p = preparerProposition(PRIX, b);
    assert.ok(!p.ok, JSON.stringify(b));
    if (!p.ok) assert.match(p.erreurs.general ?? '', /Changez le montant/);
  }
});
test('proposition D3 : saisie invalide = erreur par champ, JAMAIS de valeurs (donc rien à envoyer) : virgule, lettre, négatif, énorme, vide, conditions trop longues', () => {
  const cas: Array<[string, Partial<{ sousTotal: string; frais: string; conditions: string }>, 'sousTotal' | 'frais' | 'conditions']> = [
    ['virgule', { sousTotal: '45000,50' }, 'sousTotal'], ['point', { sousTotal: '45.000' }, 'sousTotal'], ['lettre', { frais: '5000F' }, 'frais'], ['négatif', { frais: '-5000' }, 'frais'],
    ['énorme', { sousTotal: '10000001' }, 'sousTotal'], ['vide', { sousTotal: '' }, 'sousTotal'], ['frais vide', { frais: ' ' }, 'frais'], ['NaN', { sousTotal: 'NaN' }, 'sousTotal'],
    ['Infinity', { frais: 'Infinity' }, 'frais'], ['conditions 501', { conditions: 'x'.repeat(501) }, 'conditions'],
  ];
  for (const [nom, surcharge, champ] of cas) {
    const p = preparerProposition(PRIX, brouillon(surcharge));
    assert.equal(p.ok, false, nom);
    if (!p.ok) assert.ok(typeof p.erreurs[champ] === 'string' && p.erreurs[champ]!.length > 0, nom);
    assert.ok(!('valeurs' in p), nom);
  }
  assert.ok(preparerProposition(PRIX, brouillon({ conditions: 'x'.repeat(500), sousTotal: '46000' })).ok, '500 caractères acceptés');
  const deux = preparerProposition(PRIX, brouillon({ sousTotal: 'a', frais: 'b' }));
  assert.ok(!deux.ok && deux.erreurs.sousTotal && deux.erreurs.frais, 'les deux champs fautifs sont signalés ensemble');
});

// ---------- machine : proposition ----------
test('machine D3 : « Proposer un autre prix » ouvre la saisie, préremplie avec les prix actuels (texte), sans rien envoyer', () => {
  const e = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  assert.deepEqual(e, { phase: 'saisie', commandeId: A, actuel: PRIX, brouillon: { sousTotal: '45000', frais: '5000', conditions: '' }, erreurs: {} });
  assert.ok(formulaireOuvert(e));
  assert.equal(actionVerrouillee(e, 0), false);
});
test('machine D3 : la saisie évolue champ par champ ; hors saisie, « saisir » est sans effet ; une nouvelle frappe efface les erreurs', () => {
  let e: EtatAction = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  e = evoluer(e, { type: 'saisir', champ: 'sousTotal', valeur: '52 000' });
  e = evoluer(e, { type: 'saisir', champ: 'conditions', valeur: 'Un plat est remplacé.' });
  assert.deepEqual(e.phase === 'saisie' && e.brouillon, { sousTotal: '52 000', frais: '5000', conditions: 'Un plat est remplacé.' });
  assert.equal(evoluer(repos, { type: 'saisir', champ: 'frais', valeur: '1' }), repos);
  const mauvais = evoluer(evoluer(e, { type: 'saisir', champ: 'frais', valeur: 'x' }), { type: 'valider_saisie' });
  assert.ok(mauvais.phase === 'saisie' && mauvais.erreurs.frais);
  assert.deepEqual(evoluer(mauvais, { type: 'saisir', champ: 'frais', valeur: '5000' }).phase === 'saisie' && (evoluer(mauvais, { type: 'saisir', champ: 'frais', valeur: '5000' }) as { erreurs: unknown }).erreurs, {});
});
test('machine D3 : « Continuer » avec une saisie invalide RESTE en saisie avec les erreurs ; valide → récapitulatif portant les valeurs ET l’ancien/nouveau prix', () => {
  let e: EtatAction = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  const invalide = evoluer(evoluer(e, { type: 'saisir', champ: 'sousTotal', valeur: '45,5' }), { type: 'valider_saisie' });
  assert.equal(invalide.phase, 'saisie');
  assert.ok(invalide.phase === 'saisie' && invalide.erreurs.sousTotal);
  assert.equal(evoluer(e, { type: 'valider_saisie' }).phase, 'saisie', 'rien de modifié : reste en saisie');
  e = evoluer(evoluer(e, { type: 'saisir', champ: 'sousTotal', valeur: '52000' }), { type: 'valider_saisie' });
  assert.equal(e.phase, 'recapitulatif');
  if (e.phase !== 'recapitulatif') return;
  assert.deepEqual(e.valeurs, { nouveauSousTotal: 52000, nouveauxFraisLivraison: 5000, conditionsModifiees: null });
  assert.equal(e.recap.ancienSousTotal, 45000);
  assert.equal(e.recap.nouveauSousTotal, 52000);
  assert.equal(evoluer(repos, { type: 'valider_saisie' }), repos);
});
test('machine D3 : « Modifier » revient à la saisie en gardant le brouillon ; « Fermer » revient au repos depuis la saisie comme depuis le récapitulatif', () => {
  const saisie = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  const recap = evoluer(evoluer(saisie, { type: 'saisir', champ: 'frais', valeur: '0' }), { type: 'valider_saisie' });
  const retour = evoluer(recap, { type: 'modifier_saisie' });
  assert.ok(retour.phase === 'saisie' && retour.brouillon.frais === '0');
  assert.equal(evoluer(retour, { type: 'annuler_confirmation' }), repos);
  assert.equal(evoluer(recap, { type: 'annuler_confirmation' }), repos);
  assert.equal(evoluer(saisie, { type: 'modifier_saisie' }), saisie);
});
test('machine D3 : la proposition ne part JAMAIS sans son récapitulatif (repos, saisie, confirmation d’une autre action, autre commande)', () => {
  const saisie = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  const recap = evoluer(evoluer(saisie, { type: 'saisir', champ: 'frais', valeur: '0' }), { type: 'valider_saisie' });
  assert.equal(recap.phase, 'recapitulatif');
  for (const etat of [repos, saisie, { phase: 'confirmation', commandeId: A, action: 'refuser' } as EtatAction, { phase: 'confirmation', commandeId: A, action: 'annuler' } as EtatAction]) {
    assert.equal(peutEnvoyer(etat, A, 'proposer', 0), false, etat.phase);
    assert.equal(evoluer(etat, { type: 'envoyer', commandeId: A, action: 'proposer', lecture: 0 }), etat, etat.phase);
  }
  assert.equal(peutEnvoyer(recap, B, 'proposer', 0), false, 'autre commande');
  assert.equal(evoluer(recap, { type: 'envoyer', commandeId: B, action: 'proposer', lecture: 0 }), recap);
  assert.equal(peutEnvoyer(recap, A, 'proposer', 0), true);
});
test('machine D3 : le récapitulatif confirmé → envoi qui PORTE exactement les valeurs du récapitulatif (celles qui partent au réseau)', () => {
  const saisie = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  const recap = evoluer(evoluer(evoluer(saisie, { type: 'saisir', champ: 'sousTotal', valeur: '52 000' }), { type: 'saisir', champ: 'conditions', valeur: 'Un plat est remplacé.' }), { type: 'valider_saisie' });
  const envoi = evoluer(recap, { type: 'envoyer', commandeId: A, action: 'proposer', lecture: 0 });
  assert.deepEqual(envoi, { phase: 'envoi', commandeId: A, action: 'proposer', valeurs: { nouveauSousTotal: 52000, nouveauxFraisLivraison: 5000, conditionsModifiees: 'Un plat est remplacé.' } });
  assert.equal(actionVerrouillee(envoi, 0), true);
  assert.equal(evoluer(envoi, { type: 'envoyer', commandeId: A, action: 'proposer', lecture: 0 }), envoi, 'un seul envoi');
});
test('machine D3 : tant que le formulaire est ouvert, aucune AUTRE action ne part et aucune confirmation ne s’ouvre ; un formulaire ne s’ouvre pas pendant un verrou', () => {
  const saisie = evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 });
  for (const action of ['accepter', 'prete', 'terminee', 'paiement_recu'] as const) {
    assert.equal(evoluer(saisie, { type: 'envoyer', commandeId: B, action, lecture: 0 }), saisie, action);
    assert.equal(peutEnvoyer(saisie, B, action, 0), false, action);
  }
  for (const action of ['refuser', 'annuler', 'paiement_non_recu'] as const) assert.equal(evoluer(saisie, { type: 'demander_confirmation', commandeId: B, action, lecture: 0 }), saisie, action);
  assert.equal(evoluer(saisie, { type: 'ouvrir_proposition', commandeId: B, actuel: PRIX, lecture: 0 }), saisie, 'un seul formulaire à la fois');
  const envoi: EtatAction = { phase: 'envoi', commandeId: A, action: 'accepter' };
  assert.equal(evoluer(envoi, { type: 'ouvrir_proposition', commandeId: B, actuel: PRIX, lecture: 0 }), envoi);
  const incertain: EtatAction = { phase: 'verdict', commandeId: A, action: 'prete', verdict: { genre: 'incertain', message: 'x', reessayer: false }, lectureVerdict: 3 };
  assert.equal(evoluer(incertain, { type: 'ouvrir_proposition', commandeId: B, actuel: PRIX, lecture: 3 }), incertain, 'verrouillé jusqu’à relecture réussie');
  assert.equal(evoluer(incertain, { type: 'ouvrir_proposition', commandeId: B, actuel: PRIX, lecture: 4 }).phase, 'saisie');
});
test('machine D3 : réponse incertaine à une proposition, relecture échouée → verrouillé jusqu’à une relecture réussie ; jamais de nouvel envoi automatique', () => {
  const recap = evoluer(evoluer(evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 }), { type: 'saisir', champ: 'frais', valeur: '0' }), { type: 'valider_saisie' });
  let e = evoluer(recap, { type: 'envoyer', commandeId: A, action: 'proposer', lecture: 1 });
  e = evoluer(e, { type: 'repondre', erreur: incertain });
  assert.equal(e.phase, 'relecture');
  e = evoluer(e, { type: 'relire', relue: undefined, lecture: 1 });
  assert.equal(e.phase, 'verdict');
  assert.equal(actionVerrouillee(e, 1), true);
  assert.equal(actionVerrouillee(e, 2), false);
});
test('machine D3 : erreur MFA/questions sur une proposition → verdict « sécurité » avec le message vers le site', () => {
  const recap = evoluer(evoluer(evoluer(repos, { type: 'ouvrir_proposition', commandeId: A, actuel: PRIX, lecture: 0 }), { type: 'saisir', champ: 'frais', valeur: '0' }), { type: 'valider_saisie' });
  let e = evoluer(recap, { type: 'envoyer', commandeId: A, action: 'proposer', lecture: 0 });
  e = evoluer(e, { type: 'repondre', erreur: refusRestaurateur(403, 'mfa') });
  e = evoluer(e, { type: 'relire', relue: attente, lecture: 1 });
  assert.deepEqual(e.phase === 'verdict' && e.verdict, { genre: 'securite', message: MESSAGE_SECURITE });
});

// ---------- machine : annuler (avec confirmation) ----------
test('machine D3 : « Annuler la commande » demande d’abord sa confirmation (même commande, même action) ; jamais d’envoi sans elle', () => {
  assert.equal(peutEnvoyer(repos, A, 'annuler', 0), false);
  assert.equal(evoluer(repos, { type: 'envoyer', commandeId: A, action: 'annuler', lecture: 0 }), repos);
  const conf = evoluer(repos, { type: 'demander_confirmation', commandeId: A, action: 'annuler', lecture: 0, paiementStatut: 'non_demande', paiementMode: null });
  assert.deepEqual(conf, { phase: 'confirmation', commandeId: A, action: 'annuler' });
  assert.equal(peutEnvoyer(conf, B, 'annuler', 0, 'non_demande', null), false, 'autre commande');
  const refuserConf = evoluer(repos, { type: 'demander_confirmation', commandeId: A, action: 'refuser', lecture: 0 });
  assert.equal(peutEnvoyer(refuserConf, A, 'annuler', 0, 'non_demande', null), false, 'la confirmation d’un refus ne vaut pas pour une annulation');
  assert.equal(peutEnvoyer(conf, A, 'refuser', 0), false, 'ni l’inverse');
  assert.deepEqual(evoluer(conf, { type: 'envoyer', commandeId: A, action: 'annuler', lecture: 0, paiementStatut: 'non_demande', paiementMode: null }), { phase: 'envoi', commandeId: A, action: 'annuler' });
  assert.equal(evoluer(conf, { type: 'annuler_confirmation' }), repos);
});
test('machine D3 : les textes de confirmation sont fixes, sans « espèces », et chaque action à confirmer a la sienne', () => {
  for (const action of ['refuser', 'annuler', 'paiement_non_recu'] as const) {
    const c = CONFIRMATIONS[action];
    assert.ok(c.question.length > 10 && c.oui.length > 0 && c.non.length > 0, action);
    assert.ok(!/esp[eè]ces/i.test(c.question + c.oui + c.non), action);
  }
  assert.match(CONFIRMATIONS.annuler.oui, /annuler/i);
});

// ---------- boutons : annuler et proposer, statut × paiement × proposition ----------
test('boutons D3 : « annuler » UNIQUEMENT pour une commande en attente ou acceptée (jamais prête, terminée, refusée, annulée), quel que soit le paiement ou la proposition', () => {
  for (const statut of STATUTS_TOUS) for (const paiementStatut of PAIEMENTS_TOUS) for (const paiementMode of MODES_TOUS) for (const propositionActive of [null, { id: 'p' }]) {
    const a = actionsPossibles(lue({ statut, paiementStatut, paiementMode, propositionActive }));
    const nom = [statut, paiementStatut, paiementMode, propositionActive ? 'proposition' : 'sans'].join(' ');
    const nonPaye = (paiementStatut === 'non_demande' || paiementStatut === 'non_recu') && paiementMode !== 'speedfood';
    assert.equal(a.includes('annuler'), (statut === 'en_attente' || statut === 'acceptee') && nonPaye, nom);
  }
});
test('boutons D3 (I-1, option prudente) : une commande dont le paiement est déclaré, reçu ou enregistré n’a JAMAIS « Annuler » ; l’écran montre le texte « déjà payée » à la place', () => {
  assert.equal(MESSAGE_DEJA_PAYEE, 'Cette commande est déjà payée : pour l’annuler, utilisez le site ou le support (le client doit être remboursé).');
  assert.ok(!/esp[eè]ces/i.test(MESSAGE_DEJA_PAYEE));
  for (const statut of STATUTS_TOUS) for (const paiementStatut of PAIEMENTS_TOUS) {
    const c = lue({ statut, paiementStatut, paiementMode: paiementStatut === 'declare' || paiementStatut === 'recu' ? 'orange_money' : null });
    const payee = paiementStatut === 'declare' || paiementStatut === 'recu' || paiementStatut === 'especes';
    assert.equal(commandePayee(paiementStatut, c.paiementMode), payee, paiementStatut);
    const nom = statut + ' ' + paiementStatut;
    assert.equal(actionsPossibles(c).includes('annuler'), (statut === 'en_attente' || statut === 'acceptee') && !payee, nom);
    assert.equal(annulationRefuseePourPaiement(c), (statut === 'en_attente' || statut === 'acceptee') && payee, nom);
    // Jamais les deux à la fois : soit le bouton, soit le texte, soit rien.
    assert.ok(!(actionsPossibles(c).includes('annuler') && annulationRefuseePourPaiement(c)), nom);
  }
});
test('machine D3 (I-1) : « annuler » ne part jamais pour une commande payée, ni sans statut de paiement connu, même si l’écran est contourné', () => {
  for (const paiementStatut of ['declare', 'recu', 'especes'] as const) {
    assert.equal(evoluer(repos, { type: 'demander_confirmation', commandeId: A, action: 'annuler', lecture: 0, paiementStatut }), repos, paiementStatut);
    const conf: EtatAction = { phase: 'confirmation', commandeId: A, action: 'annuler' };
    assert.equal(peutEnvoyer(conf, A, 'annuler', 0, paiementStatut), false, paiementStatut);
    assert.equal(evoluer(conf, { type: 'envoyer', commandeId: A, action: 'annuler', lecture: 0, paiementStatut }), conf, paiementStatut);
  }
  const conf: EtatAction = { phase: 'confirmation', commandeId: A, action: 'annuler' };
  assert.equal(peutEnvoyer(conf, A, 'annuler', 0), false, 'statut de paiement inconnu : refusé');
  assert.equal(evoluer(conf, { type: 'envoyer', commandeId: A, action: 'annuler', lecture: 0 }), conf);
  assert.equal(evoluer(repos, { type: 'demander_confirmation', commandeId: A, action: 'annuler', lecture: 0 }), repos);
  for (const paiementStatut of ['non_demande', 'non_recu'] as const) {
    assert.equal(peutEnvoyer(conf, A, 'annuler', 0, paiementStatut, null), true, paiementStatut);
    assert.equal(peutEnvoyer(conf, A, 'annuler', 0, paiementStatut), false, 'mode de paiement inconnu : prudence, refusé');
    assert.equal(peutEnvoyer(conf, A, 'annuler', 0, paiementStatut, 'speedfood'), false, 'paiement en ligne Speedfood possible : refusé');
  }
});
test('boutons D3 (R-1) : paiement en ligne Speedfood (Chap Chap Pay) = « déjà payée » pour le bouton ET la garde, même avec le statut « non demandé »', () => {
  for (const statut of ['en_attente', 'acceptee'] as const) for (const paiementStatut of ['non_demande', 'non_recu'] as const) {
    const c = lue({ statut, paiementStatut, paiementMode: 'speedfood' });
    assert.ok(!actionsPossibles(c).includes('annuler'), statut + ' ' + paiementStatut);
    assert.equal(annulationRefuseePourPaiement(c), true, statut + ' ' + paiementStatut);
    const sans = lue({ statut, paiementStatut, paiementMode: null });
    assert.ok(actionsPossibles(sans).includes('annuler'), 'sans mode : annulable');
    assert.equal(annulationRefuseePourPaiement(sans), false);
  }
  assert.equal(commandePayee('non_demande', 'speedfood'), true);
  assert.equal(commandePayee('non_demande', undefined), true, 'mode inconnu : prudence');
  assert.equal(commandePayee('non_demande', null), false);
  assert.equal(evoluer(repos, { type: 'demander_confirmation', commandeId: A, action: 'annuler', lecture: 0, paiementStatut: 'non_demande', paiementMode: 'speedfood' }), repos);
  const conf: EtatAction = { phase: 'confirmation', commandeId: A, action: 'annuler' };
  assert.equal(evoluer(conf, { type: 'envoyer', commandeId: A, action: 'annuler', lecture: 0, paiementStatut: 'non_demande', paiementMode: 'speedfood' }), conf);
  // Le mode arrive bien de la liste du serveur.
  assert.equal(lireListeRestaurateur(reponse([brute('00000000-0000-4000-8000-0000000000ac', { statut: 'acceptee', paiementStatut: 'non_demande', paiementMode: 'speedfood' })])).commandes[0].paiementMode, 'speedfood');
});
test('boutons D3 : « Proposer un autre prix » UNIQUEMENT pour une commande en attente sans proposition en cours', () => {
  for (const statut of STATUTS_TOUS) for (const paiementStatut of PAIEMENTS_TOUS) for (const propositionActive of [null, { id: 'p' }]) {
    const a = actionsPossibles(lue({ statut, paiementStatut, propositionActive }));
    assert.equal(a.includes('proposer'), statut === 'en_attente' && propositionActive === null, [statut, paiementStatut, propositionActive ? 'proposition' : 'sans'].join(' '));
  }
});
test('boutons D3 : une commande en attente de la réponse du client affiche « En attente de la réponse du client », sans accepter/refuser/proposer, seule l’annulation reste', () => {
  const c = lue({ propositionActive: { id: 'p' } });
  assert.equal(libelleStatut(c), 'En attente de la réponse du client');
  assert.deepEqual(actionsPossibles(c), ['annuler']);
  assert.equal(libelleStatut(attente), 'En attente de votre réponse');
});
test('boutons D3 : après une annulation ou une proposition confirmée et une liste PÉRIMÉE, plus aucun bouton de statut ; liste à jour : rien à annuler', () => {
  const annule: EtatAction = { phase: 'verdict', commandeId: A, action: 'annuler', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(attente, annule), [], 'liste périmée : pas de second envoi');
  assert.deepEqual(actionsAffichees(lue({ statut: 'annulee' }), annule), []);
  const propose: EtatAction = { phase: 'verdict', commandeId: A, action: 'proposer', verdict: { genre: 'confirme', message: 'x' }, lectureVerdict: 1 };
  assert.deepEqual(actionsAffichees(attente, propose), [], 'liste périmée : pas de seconde proposition');
  assert.deepEqual(actionsAffichees(lue({ propositionActive: { id: 'p' } }), propose), ['annuler'], 'liste à jour : seule l’annulation');
});

// ---------- verdict ----------
test('verdict D3 : messages de succès fixes pour annuler et proposer', () => {
  assert.equal(verdictAction({ erreur: null, action: 'annuler', relue: undefined }).message, 'Commande annulée.');
  assert.equal(verdictAction({ erreur: null, action: 'proposer', relue: undefined }).message, 'Proposition envoyée au client.');
});
test('verdict D3 : annuler après réponse incertaine, la liste relue décide (jamais « réessayer » sans bouton)', () => {
  assert.equal(verdictAction({ erreur: incertain, action: 'annuler', relue: lue({ statut: 'annulee' }) }).genre, 'confirme');
  const encore = verdictAction({ erreur: incertain, action: 'annuler', relue: lue({ statut: 'acceptee' }) });
  assert.deepEqual([encore.genre, (encore as { reessayer: boolean }).reessayer], ['incertain', true]);
  const prete = verdictAction({ erreur: incertain, action: 'annuler', relue: lue({ statut: 'prete' }) });
  assert.equal(prete.genre, 'refus', 'une commande prête ne s’annule plus : pas de bouton, donc pas de « réessayer »');
  assert.ok(!/réessayer/i.test(prete.message));
  assert.equal(verdictAction({ erreur: incertain, action: 'annuler', relue: lue({ statut: 'refusee' }) }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'annuler', relue: undefined }).genre, 'incertain');
  assert.equal((verdictAction({ erreur: incertain, action: 'annuler', relue: undefined }) as { reessayer: boolean }).reessayer, false);
  assert.equal(verdictAction({ erreur: refusRestaurateur(409), action: 'annuler', relue: lue({ statut: 'acceptee' }) }).genre, 'refus', 'refus certain : jamais converti');
});
test('verdict D3 : proposer après réponse incertaine : proposition retrouvée = enregistrée ; sinon JAMAIS « réessayer » (une proposition a pu être enregistrée puis acceptée)', () => {
  const mes = { nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500, conditionsModifiees: null };
  const proposee = (nouveauSousTotal: number, nouveauxFraisLivraison: number) => lue({ propositionActive: { id: 'p', nouveauSousTotal, nouveauxFraisLivraison } });
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue: proposee(12000, 1500) }).genre, 'confirme');
  const aucune = verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue: attente });
  assert.deepEqual([aucune.genre, (aucune as { reessayer: boolean }).reessayer], ['incertain', false]);
  assert.ok(!/Vous pouvez réessayer/.test(aucune.message));
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue: lue({ statut: 'annulee' }) }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue: lue({ statut: 'acceptee' }) }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', relue: null }).genre, 'refus');
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', relue: undefined }).genre, 'incertain');
  assert.equal(verdictAction({ erreur: refusRestaurateur(409), action: 'proposer', relue: lue({ propositionActive: { id: 'p' } }) }).genre, 'refus', 'refus certain (proposition déjà active) : jamais converti en succès');
});
test('verdict D3 (m-1) : « bien enregistrée » SEULEMENT si la proposition relue a les mêmes montants que celle envoyée ; sinon message neutre, jamais de réessai', () => {
  const mes = { nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500, conditionsModifiees: null };
  const proposee = (p: Record<string, unknown>) => lue({ propositionActive: { id: 'p', ...p } });
  for (const [nom, relue] of [
    ['sous-total différent', proposee({ nouveauSousTotal: 11000, nouveauxFraisLivraison: 1500 })],
    ['frais différents', proposee({ nouveauSousTotal: 12000, nouveauxFraisLivraison: 2000 })],
    ['montants illisibles', proposee({})],
    ['montants non entiers', proposee({ nouveauSousTotal: 12000.5, nouveauxFraisLivraison: 1500 })],
  ] as const) {
    const v = verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue });
    assert.deepEqual([v.genre, (v as { reessayer: boolean }).reessayer], ['incertain', false], nom);
    assert.ok(!/bien enregistrée/.test(v.message) && !/réessayer/i.test(v.message), nom + ' : ' + v.message);
  }
  const v = verdictAction({ erreur: incertain, action: 'proposer', relue: proposee({ nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500 }) });
  assert.equal(v.genre, 'incertain', 'sans valeurs envoyées connues : jamais confirmé');
  assert.equal(verdictAction({ erreur: incertain, action: 'proposer', valeurs: mes, relue: proposee({ nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500 }) }).genre, 'confirme');
  // Les montants de la liste sont bien lus.
  const l = lireListeRestaurateur(reponse([brute('00000000-0000-4000-8000-0000000000aa', { propositionActive: { id: 'p', nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500 } })])).commandes[0];
  assert.deepEqual(l.propositionMontants, { sousTotal: 12000, frais: 1500 });
  assert.equal(lireListeRestaurateur(reponse([brute('00000000-0000-4000-8000-0000000000ab', {})])).commandes[0].propositionMontants, null);
});
test('machine D3 (m-1) : les montants envoyés sont gardés jusqu’au verdict', () => {
  const valeurs = { nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500, conditionsModifiees: null };
  const envoi: EtatAction = { phase: 'envoi', commandeId: A, action: 'proposer', valeurs };
  const rel = evoluer(envoi, { type: 'repondre', erreur: incertain });
  assert.deepEqual(rel.phase === 'relecture' && rel.valeurs, valeurs);
  const fin = evoluer(rel, { type: 'relire', lecture: 1, relue: lue({ propositionActive: { id: 'p', nouveauSousTotal: 9000, nouveauxFraisLivraison: 0 } }) });
  assert.ok(fin.phase === 'verdict' && fin.verdict.genre === 'incertain');
  const ok = evoluer(rel, { type: 'relire', lecture: 1, relue: lue({ propositionActive: { id: 'p', nouveauSousTotal: 12000, nouveauxFraisLivraison: 1500 } }) });
  assert.ok(ok.phase === 'verdict' && ok.verdict.genre === 'confirme', 'mêmes montants relus : enregistrée');
});
test('verdict D2-4 corrigé : « Vous pouvez réessayer » seulement quand le bouton existe encore (paiement déclaré mais commande annulée = pas de bouton)', () => {
  const annuleeDeclaree = lue({ statut: 'annulee', paiementStatut: 'declare', paiementMode: 'orange_money' });
  const v = verdictAction({ erreur: incertain, action: 'paiement_recu', relue: annuleeDeclaree });
  assert.equal(v.genre, 'refus');
  assert.ok(!/réessayer/i.test(v.message), v.message);
  const ok = verdictAction({ erreur: incertain, action: 'paiement_recu', relue: lue({ statut: 'acceptee', paiementStatut: 'declare', paiementMode: 'mtn_momo' }) });
  assert.deepEqual([ok.genre, (ok as { reessayer: boolean }).reessayer], ['incertain', true], 'le bouton existe : réessayer permis');
  const propositionEntreTemps = verdictAction({ erreur: incertain, action: 'accepter', relue: lue({ propositionActive: { id: 'p' } }) });
  assert.equal(propositionEntreTemps.genre, 'refus', 'le client a une proposition à traiter : pas de bouton accepter');
});

// ---------- client : proposition ----------
const VALEURS = { nouveauSousTotal: 52000, nouveauxFraisLivraison: 7000, conditionsModifiees: 'Un plat est remplacé.' };
test('client D3 : proposition = POST {commandeId, nouveauSousTotal, nouveauxFraisLivraison, conditionsModifiees} SEULEMENT sur la route proposition, jeton porteur, un seul appel, jamais de restaurant', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  await a.proposerRestaurateur(ACCES, A, VALEURS);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/proposition');
  assert.equal(appels[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, ...VALEURS });
  assert.equal(appels[0].options.credentials, 'omit');
  assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  const sans = api(() => json({ ok: true }));
  await sans.a.proposerRestaurateur(ACCES, A, { nouveauSousTotal: 0, nouveauxFraisLivraison: 10000000, conditionsModifiees: null });
  assert.deepEqual(JSON.parse(String(sans.appels[0].options.body)), { commandeId: A, nouveauSousTotal: 0, nouveauxFraisLivraison: 10000000, conditionsModifiees: null });
});
test('client D3 : une valeur étrangère (restaurantId, jeton…) ajoutée aux montants n’est jamais envoyée', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  await a.proposerRestaurateur(ACCES, A, { ...VALEURS, restaurantId: 'x', restaurant_id: 'x', jeton: 'y' } as never);
  assert.deepEqual(Object.keys(JSON.parse(String(appels[0].options.body))).sort(), ['commandeId', 'conditionsModifiees', 'nouveauSousTotal', 'nouveauxFraisLivraison']);
});
test('client D3 : une saisie INVALIDE ne part JAMAIS au réseau (négatif, décimal, énorme, chaîne, NaN, Infinity, conditions trop longues, identifiant invalide)', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  const mauvais: unknown[] = [-1, 0.5, 52000.5, 10000001, 1e12, '52000', '', NaN, Infinity, -Infinity, null, undefined, true, [1], { v: 1 }];
  for (const champ of ['nouveauSousTotal', 'nouveauxFraisLivraison'] as const) for (const valeur of mauvais) {
    await assert.rejects(a.proposerRestaurateur(ACCES, A, { ...VALEURS, [champ]: valeur } as never), ErreurRestaurateur, `${champ} = ${String(valeur)}`);
  }
  await assert.rejects(a.proposerRestaurateur(ACCES, A, { ...VALEURS, conditionsModifiees: 'x'.repeat(501) }), ErreurRestaurateur);
  await assert.rejects(a.proposerRestaurateur(ACCES, A, { ...VALEURS, conditionsModifiees: 5 as never }), ErreurRestaurateur);
  await assert.rejects(a.proposerRestaurateur(ACCES, A, null as never), ErreurRestaurateur);
  await assert.rejects(a.proposerRestaurateur(ACCES, 'pas-un-uuid', VALEURS), ErreurRestaurateur);
  assert.equal(appels.length, 0, 'aucun appel réseau');
});
test('client D3 : UN SEUL essai, même après 500, coupure réseau ou réponse illisible ; l’erreur est incertaine', async () => {
  const cas: Array<() => Response | Promise<Response>> = [() => json({ ok: false }, 503), () => { throw new TypeError('réseau'); }, () => new Response('pas du json', { status: 200, headers: { 'content-type': 'text/html' } }), () => json({ ok: 'oui' })];
  for (const repondre of cas) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.proposerRestaurateur(ACCES, A, VALEURS), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true);
    assert.equal(appels.length, 1);
  }
});
test('client D3 : refus certains de la proposition (400, 403, 404, 409, 429) non incertains, sans texte du serveur ; 403 sécurité → message vers le site ; 401 → session terminée', async () => {
  for (const statut of [400, 403, 404, 409, 429]) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'X', message: 'TEXTE SECRET DU SERVEUR' } }, statut));
    await assert.rejects(a.proposerRestaurateur(ACCES, A, VALEURS), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain && !e.message.includes('SECRET'), String(statut));
  }
  const securite = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE', message: 'x', champs: { securite: 'questions' } } }, 403));
  await assert.rejects(securite.a.proposerRestaurateur(ACCES, A, VALEURS), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite' && e.message === MESSAGE_SECURITE);
  const session = api(() => json({ ok: false }, 401));
  await assert.rejects(session.a.proposerRestaurateur(ACCES, A, VALEURS), (e: unknown) => e instanceof ErreurConnexion && e.message.includes('session'));
});
test('client D3 : l’annulation passe par la route action avec {commandeId, action:"annuler"} seulement', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  await a.actionRestaurateur(ACCES, A, 'annuler');
  assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/action');
  assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, action: 'annuler' });
});

// ---------- session ----------
test('session D3 : la proposition passe le jeton d’accès, l’identifiant et les montants ; une session terminée (401) ferme et efface la session ; sans connexion, rien ne part', async () => {
  const vus: unknown[][] = [];
  const { g } = gestion({ proposerRestaurateur: async (...x: unknown[]) => { vus.push(x); } });
  await assert.rejects(g.proposerRestaurateur(A, VALEURS), ErreurConnexion);
  assert.deepEqual(vus, []);
  await g.connecter('essai@example.invalid', 'factice');
  await g.proposerRestaurateur(A, VALEURS);
  assert.deepEqual(vus, [[ACCES, A, VALEURS]]);
  const fin = gestion({ proposerRestaurateur: async () => { throw new ErreurConnexion('Fin', true); } });
  await fin.g.connecter('essai@example.invalid', 'factice');
  await assert.rejects(fin.g.proposerRestaurateur(A, VALEURS));
  assert.equal(fin.g.connectee, false);
  assert.equal(fin.coffre.v, null);
});
