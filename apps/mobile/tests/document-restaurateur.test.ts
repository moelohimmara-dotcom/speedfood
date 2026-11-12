import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerAuth } from '../src/connexion/client.ts';
import {
  ErreurRestaurateur, documentsDisponibles, libelleDocument, lireListeRestaurateur, type CommandeRestaurateur,
} from '../src/connexion/restaurateur.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const brute = (id: string, surcharge: Record<string, unknown> = {}) => ({
  id, reference: 'SF-' + id.slice(-1).toUpperCase(), statut: 'terminee', mode: 'retrait', tableNumero: null, clientNom: 'Awa Diallo', clientTelephone: '+224 622 00 00 00', clientAdresse: null,
  sousTotal: 45000, fraisLivraisonEstime: 5000, creeLe: '2026-11-03T10:00:00.000Z', estTest: false, lignes: [{ nom: 'Poulet braisé', prix: 45000, quantite: 1, options: [] }],
  propositionActive: null, paiementStatut: 'recu', paiementMode: 'orange_money', paiementReference: null, paiementVisible: true,
  documents: { recu: null, facture: null }, lienRecuWhatsApp: null, lienFactureWhatsApp: null, ...surcharge,
});
const reponse = (commandes: unknown[]) => ({ ok: true, restaurant: { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Fatou', ouvert: true, accepteCommandes: true }, commandes });
const lue = (surcharge: Record<string, unknown> = {}) => lireListeRestaurateur(reponse([brute(A, surcharge)])).commandes[0];

// ---------- lecture des documents ----------
test('document : numeros de recu et facture lus, visibilite du paiement lue', () => {
  const c = lue({ documents: { recu: 'R-2026-001', facture: null } });
  assert.deepEqual(c.documents, { recu: 'R-2026-001', facture: null });
  assert.equal(c.paiementVisible, true);
});

test('document : documents illisibles = ligne ecartee et comptee (les voisines restent)', () => {
  for (const documents of [{ recu: 123, facture: null }, null, 'x', { recu: 'R'.repeat(61), facture: null }]) {
    const l = lireListeRestaurateur(reponse([brute(A, { documents }), brute(B)]));
    assert.deepEqual(l.commandes.map(x => x.id), [B], JSON.stringify(documents));
    assert.equal(l.illisibles, 1);
  }
  for (const paiementVisible of ['oui', 1, null]) {
    const l = lireListeRestaurateur(reponse([brute(A, { paiementVisible }), brute(B)]));
    assert.deepEqual(l.commandes.map(x => x.id), [B], JSON.stringify(paiementVisible));
    assert.equal(l.illisibles, 1);
  }
});

test('document : une cle de document absente vaut « pas encore etabli » (comme l ancienne appli), un type faux ecarte la ligne', () => {
  const c = lue({ documents: { recu: 'R-1' } });
  assert.deepEqual(c.documents, { recu: 'R-1', facture: null });
});

test('document : les liens WhatsApp et jetons ne sont toujours pas retenus, les numeros oui', () => {
  const l = lireListeRestaurateur(reponse([brute(A, { documents: { recu: 'R-9', facture: 'F-9' }, lienRecuWhatsApp: 'https://wa.me/224622000000?text=' + 'j'.repeat(64), lienFactureWhatsApp: 'https://wa.me/224622000000?text=' + 'k'.repeat(64) })]));
  const texte = JSON.stringify(l);
  assert.ok(texte.includes('R-9') && texte.includes('F-9'));
  assert.ok(!texte.includes('wa.me') && !texte.includes('j'.repeat(64)) && !texte.includes('k'.repeat(64)));
});

// ---------- actions disponibles ----------
const commande = (surcharge: Partial<CommandeRestaurateur> = {}): CommandeRestaurateur => ({
  ...lue(), ...surcharge,
});
test('document : recu seulement si paiement recu et pas encore de recu ; facture tant qu il n y en a pas', () => {
  assert.deepEqual(documentsDisponibles(commande()), ['recu', 'facture']);
  assert.deepEqual(documentsDisponibles(commande({ documents: { recu: 'R-1', facture: null } })), ['facture']);
  assert.deepEqual(documentsDisponibles(commande({ documents: { recu: null, facture: 'F-1' } })), ['recu']);
  assert.deepEqual(documentsDisponibles(commande({ documents: { recu: 'R-1', facture: 'F-1' } })), []);
});
test('document : rien hors paiement visible, recu jamais hors paiement recu', () => {
  assert.deepEqual(documentsDisponibles(commande({ paiementVisible: false })), []);
  for (const paiementStatut of ['non_demande', 'declare', 'non_recu', 'especes'] as const) {
    assert.deepEqual(documentsDisponibles(commande({ paiementStatut })), ['facture'], paiementStatut);
  }
});
test('document : libelles des numeros existants', () => {
  assert.equal(libelleDocument('recu', 'R-2026-001'), 'Reçu R-2026-001');
  assert.equal(libelleDocument('facture', 'F-2026-002'), 'Facture F-2026-002');
  assert.equal(libelleDocument('recu', null), null);
});

// ---------- client ----------
const ACCES = 'acces-factice';
type Appel = { url: string; options: RequestInit };
function api(repondre: (appel: Appel) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const a = creerAuth(async (url, options) => { const appel = { url: String(url), options: options ?? {} }; appels.push(appel); return repondre(appel); });
  return { a, appels };
}
const json = (corps: unknown, status = 200) => Response.json(corps, { status });

test('client document : POST {commandeId, type} sur la route document, jeton porteur, un seul appel', async () => {
  for (const type of ['recu', 'facture'] as const) {
    const { a, appels } = api(() => json({ ok: true }));
    await a.emettreDocumentRestaurateur(ACCES, A, type);
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, 'https://speedfood-api.moelohimmara.workers.dev/api/v1/restaurant/commandes/document');
    assert.equal(appels[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(String(appels[0].options.body)), { commandeId: A, type });
    assert.equal((appels[0].options.headers as Record<string, string>).Authorization, 'Bearer ' + ACCES);
  }
});
test('client document : type inconnu ou identifiant invalide refuse AVANT le reseau', async () => {
  const { a, appels } = api(() => json({ ok: true }));
  for (const type of ['ticket', 'RECU', '', 'recu ']) await assert.rejects(a.emettreDocumentRestaurateur(ACCES, A, type as never), ErreurRestaurateur);
  await assert.rejects(a.emettreDocumentRestaurateur(ACCES, 'pas-un-uuid', 'recu'), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('client document : un seul essai apres 500 (jamais de relance : emettre deux fois doit rester un choix)', async () => {
  const { a, appels } = api(() => json({ ok: false }, 503));
  await assert.rejects(a.emettreDocumentRestaurateur(ACCES, A, 'recu'), ErreurRestaurateur);
  assert.equal(appels.length, 1);
});
