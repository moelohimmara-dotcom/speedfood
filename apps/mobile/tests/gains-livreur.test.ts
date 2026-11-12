import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireGainsLivreur, lirePageCoursesLivreur, preparerPageCourses } from '../src/connexion/gains-livreur.ts';
import { REGLES_LIVREUR, TEXTE_SANS_COURSE, avertissementIdentite, texteIncidentLivreur } from '../src/connexion/aide-livreur.ts';

const COURSE_ID = '00000000-0000-4000-8000-0000000000c1';
const course = (surcharge: Record<string, unknown> = {}) => ({
  id: COURSE_ID, reference: 'SF-AAA111', restaurantNom: 'Chez Fatou', fraisGnf: 5000, livreeLe: '2026-11-10T12:30:00.000Z', ...surcharge,
});
const gains = (surcharge: Record<string, unknown> = {}) => ({
  ok: true,
  gains: {
    aujourdhui: { courses: 2, fraisGnf: 10000 }, semaine: { courses: 9, fraisGnf: 45000 },
    recentes: [course()], ...surcharge,
  },
});

// ---------- D7 gains ----------
test('gains : lecture complete, frais entiers (jamais une paie)', () => {
  const g = lireGainsLivreur(gains());
  assert.ok(g !== null);
  assert.deepEqual(g.aujourdhui, { courses: 2, fraisGnf: 10000 });
  assert.deepEqual(g.semaine, { courses: 9, fraisGnf: 45000 });
  assert.equal(g.recentes[0].fraisGnf, 5000);
  assert.equal(g.illisibles, 0);
});
test('gains : compte non livreur = null, structure invalide = refus', () => {
  assert.equal(lireGainsLivreur({ ok: true, gains: null }), null);
  assert.throws(() => lireGainsLivreur({ ok: false, gains: null }));
  assert.throws(() => lireGainsLivreur(gains({ aujourdhui: { courses: -1, fraisGnf: 0 } })));
  assert.throws(() => lireGainsLivreur(gains({ semaine: { courses: 1.5, fraisGnf: 0 } })));
  assert.throws(() => lireGainsLivreur(gains({ recentes: 'x' })));
});
test('gains : course recente invalide ecartee et comptee, aucune coordonnee retenue', () => {
  const g = lireGainsLivreur(gains({
    recentes: [course({ fraisGnf: -1 }), course({ id: 'pas-un-uuid' }), course({ livreeLe: 'hier' }), course({ reference: 'SF-BBB222', clientNom: 'Awa', clientTelephone: '+224 622 00 00 00' })],
  }));
  assert.ok(g !== null);
  assert.deepEqual(g.recentes.map(r => r.reference), ['SF-BBB222']);
  assert.equal(g.illisibles, 3);
  assert.ok(!JSON.stringify(g).includes('Awa') && !JSON.stringify(g).includes('622'));
});

// ---------- D6 historique des courses ----------
const pageCourses = (surcharge: Record<string, unknown> = {}) => ({
  ok: true, historique: { courses: [course()], page: 1, pages: 3, ...surcharge },
});
test('historique livreur : page lue, suite calculee', () => {
  const p = lirePageCoursesLivreur(pageCourses());
  assert.ok(p !== null);
  assert.equal(p.courses.length, 1);
  assert.equal(p.page, 1);
  assert.equal(p.pages, 3);
  assert.equal(p.page < p.pages, true);
  const derniere = lirePageCoursesLivreur(pageCourses({ page: 3 }));
  assert.equal(derniere !== null && derniere.page < derniere.pages, false);
});
test('historique livreur : non livreur = null, page incoherente ou structure invalide = refus', () => {
  assert.equal(lirePageCoursesLivreur({ ok: true, historique: null }), null);
  assert.throws(() => lirePageCoursesLivreur(pageCourses({ page: 0 })));
  assert.throws(() => lirePageCoursesLivreur(pageCourses({ pages: 0 })));
  assert.throws(() => lirePageCoursesLivreur(pageCourses({ page: 4, pages: 3 })));
  assert.throws(() => lirePageCoursesLivreur(pageCourses({ courses: 'x' })));
});
test('historique livreur : demande de page bornee avant le reseau', () => {
  assert.equal(preparerPageCourses(1), 1);
  assert.equal(preparerPageCourses(12), 12);
  assert.equal(preparerPageCourses(0), null);
  assert.equal(preparerPageCourses(1.5), null);
  assert.equal(preparerPageCourses('2'), null);
});

// ---------- D8 assistance conducteur ----------
test('assistance livreur : les trois regles de la plateforme, fidelement', () => {
  assert.equal(REGLES_LIVREUR.length, 3);
  assert.ok(REGLES_LIVREUR[0].includes('code du client'));
  assert.ok(REGLES_LIVREUR[1].includes("n'encaisse rien"));
  assert.ok(REGLES_LIVREUR[2].includes('déclarée'));
});
test('assistance livreur : texte d incident selon la course en cours, et avertissement identite', () => {
  assert.ok(texteIncidentLivreur('SF-AAA111').includes('SF-AAA111'));
  assert.ok(texteIncidentLivreur('SF-AAA111').includes('déclarez-la'));
  assert.equal(texteIncidentLivreur(null), TEXTE_SANS_COURSE);
  assert.ok(avertissementIdentite().includes("pièce d'identité"));
});
