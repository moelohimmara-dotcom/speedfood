import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS_MODERATION_EQUIPE, libelleAlerteAvis, lireAvisEquipe, lireBannieresEquipe, lireParametresEquipe, motifModerationRequis, preparerModeration,
} from '../src/connexion/contenus-equipe.ts';

const AVIS = '00000000-0000-4000-8000-0000000000a1';
const avis = (surcharge: Record<string, unknown> = {}) => ({
  ok: true,
  signalements: [{
    id: '00000000-0000-4000-8000-0000000000a2', avisId: AVIS, motif: 'Propos insultants', date: '2026-11-10T09:00:00.000Z',
    restaurantNom: 'Chez Fatou', note: 1, commentaire: 'Nul', statutAvis: 'publie', ...surcharge,
  }],
  alertes: [{ type: 'restaurant_sous_seuil', cible: 'Chez Fatou', detail: '3,2 sur 8 avis' }],
});

test('avis equipe : signalements et alertes lus, ligne invalide ecartee et comptee', () => {
  const a = lireAvisEquipe(avis());
  assert.equal(a.signalements[0].note, 1);
  assert.equal(a.alertes[0].type, 'restaurant_sous_seuil');
  const b = lireAvisEquipe(avis({ note: 9 }));
  assert.equal(b.signalements.length, 0);
  assert.equal(b.illisibles, 1);
  assert.equal(libelleAlerteAvis('livreur_trois_mauvaises'), 'Livreur : trois mauvaises notes de suite');
  assert.throws(() => lireAvisEquipe({ ok: true, signalements: 'x', alertes: [] }));
});

test('avis equipe : moderation en liste blanche, motif exige pour retirer du contenu', () => {
  assert.deepEqual(ACTIONS_MODERATION_EQUIPE, ['masquer_commentaire', 'annuler_note', 'retablir', 'classer_sans_suite']);
  assert.equal(motifModerationRequis('masquer_commentaire'), true);
  assert.equal(motifModerationRequis('annuler_note'), true);
  assert.equal(motifModerationRequis('retablir'), false);
  assert.equal(preparerModeration(AVIS, 'masquer_commentaire', 'mal'), null, 'motif de moins de 5 caracteres refuse');
  assert.deepEqual(preparerModeration(AVIS, 'masquer_commentaire', 'propos insultants'), { avisId: AVIS, action: 'masquer_commentaire', motif: 'propos insultants' });
  assert.deepEqual(preparerModeration(AVIS, 'classer_sans_suite'), { avisId: AVIS, action: 'classer_sans_suite', motif: '' });
  assert.equal(preparerModeration(AVIS, 'supprimer'), null);
  assert.equal(preparerModeration('pas-un-uuid', 'retablir'), null);
});

const banniere = (surcharge: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000b1', titre: 'Bienvenue', texte: 'Texte public', lien: null, statut: 'publie', ordre: 1,
  imageUrl: null, creeLe: '2026-11-01T00:00:00.000Z', misAJourLe: '2026-11-02T00:00:00.000Z', ...surcharge,
});

test('bannieres equipe : liste lue avec troncature signalee, statut ferme', () => {
  const b = lireBannieresEquipe({ ok: true, bannieres: [banniere(), banniere({ id: '00000000-0000-4000-8000-0000000000b2', statut: 'brouillon', imageUrl: 'https://x/img.png' })], tronque: true });
  assert.equal(b.bannieres.length, 2);
  assert.equal(b.tronque, true);
  const c = lireBannieresEquipe({ ok: true, bannieres: [banniere({ statut: 'archive' })], tronque: false });
  assert.equal(c.bannieres.length, 0);
  assert.equal(c.illisibles, 1);
});

test('parametres equipe : les quatorze reglages lus strictement', () => {
  const p = lireParametresEquipe({
    ok: true,
    parametres: {
      commandePropositionDelaiMinutes: 15, prixPlatMaxGnf: 1000000, disponibiliteFraicheurHeures: 24, conservationCoordonneesJours: 30,
      conservationNonClotureeJours: 90, conservationAuditMois: 12, whatsappAssistance: '+224 620 00 00 00', delaiValidationHeures: null,
      positionCarteActive: false, promesseSignature: 'Speedfood', promesseSousTitre: 'Bien manger', promessePartage: 'Partagez',
      connexionFacebookActive: false, connexionGoogleActive: true,
    },
  });
  assert.equal(p.commandePropositionDelaiMinutes, 15);
  assert.equal(p.delaiValidationHeures, null);
  assert.equal(p.connexionGoogleActive, true);
  assert.throws(() => lireParametresEquipe({ ok: true, parametres: { commandePropositionDelaiMinutes: 15 } }), 'champ manquant = refus');
  assert.throws(() => lireParametresEquipe({ ok: true, parametres: null }));
});
