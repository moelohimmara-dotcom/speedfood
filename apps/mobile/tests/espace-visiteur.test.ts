import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHOIX_ESPACES, LIBELLE_MENU_ESPACE, QUESTION_ESPACE, TEXTE_DEVENIR_LIVREUR, choixEspace, libelleMenuEspace, titreConnexion } from '../src/connexion/espace-visiteur.ts';
import { orienterApresConnexion } from '../src/accueil/parcours-accueil.ts';

/** « Mon compte » en visiteur (audit du 28/11/2026) : l'espace d'abord, le formulaire ensuite ; reprise de la commande après connexion. */
const lire = (p: string) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('espaces : trois choix, libellés de l’audit, actions réellement prises en charge', () => {
  assert.equal(QUESTION_ESPACE, 'Comment souhaitez-vous utiliser Speedfood ?'); assert.equal(LIBELLE_MENU_ESPACE, 'Choisir mon espace');
  assert.deepEqual(CHOIX_ESPACES.map(c => `${c.titre} | ${c.texte}`), ['Client | Je veux commander un repas', 'Restaurateur | Je gère un restaurant', 'Livreur | Je veux effectuer des livraisons']);
  assert.deepEqual(choixEspace('client')!.actions.map(a => a.titre), ['Me connecter à mon compte client', 'Créer un compte client']);
  assert.deepEqual(choixEspace('restaurateur')!.actions.map(a => a.genre), ['connexion', 'referencement']);
  assert.deepEqual(choixEspace('livreur')!.actions.map(a => a.genre), ['connexion', 'devenir-livreur']);
  assert.match(TEXTE_DEVENIR_LIVREUR, /invitation/); assert.match(TEXTE_DEVENIR_LIVREUR, /lien d’activation/); assert.doesNotMatch(TEXTE_DEVENIR_LIVREUR, /inscrivez-vous/i);
  assert.equal(choixEspace(null), null);
  assert.deepEqual([titreConnexion('client'), titreConnexion('restaurateur'), titreConnexion('livreur'), titreConnexion(null)], ['Connexion client', 'Connexion restaurateur', 'Connexion livreur', 'Connexion client']);
});

test('menu accessible : TalkBack entend le nom, aucun choix d’avance, puis l’espace sélectionné', () => {
  assert.equal(libelleMenuEspace(null), 'Choisir mon espace : aucun espace sélectionné');
  assert.equal(libelleMenuEspace('livreur'), 'Choisir mon espace : Livreur sélectionné');
  const sel = lire('connexion/SelecteurEspace.tsx');
  assert.match(sel, /accessibilityState=\{\{ expanded: ouvert \}\}/); assert.match(sel, /accessibilityRole="radio" accessibilityState=\{\{ checked: actif \}\}/);
  assert.match(sel, /useState\(espace === null\)/, 'sans choix, la liste des trois espaces est déjà ouverte : rien à faire défiler');
});

test('Mon compte visiteur : sélecteur en tête, formulaire seulement après le choix, retour en haut à chaque entrée', () => {
  const compte = lire('connexion/CompteReel.tsx');
  assert.match(compte, /const choixVisiteur=vue==='compte'&&!connectee;/);
  assert.match(compte, /const formulaireOuvert=!connectee&&\(vue!=='compte'\|\|formulaireVisiteur\);/);
  assert.match(compte, /:!connectee\?\(!formulaireOuvert\?null:<>/, 'aucun champ e-mail avant le choix d’un espace et d’une action');
  assert.ok(compte.indexOf('<SelecteurEspace') < compte.indexOf('Votre session est protégée'), 'la question passe avant tout texte de session');
  assert.match(compte, /Continuer sans compte/); assert.match(compte, /Changer d’espace/); assert.match(compte, /Mot de passe oublié \?/);
  assert.match(compte, /useEffect\(\(\)=>\{if\(ouvert\)defilement\.current\?\.scrollTo\(\{y:0,animated:false\}\);\},\[ouvert,remonter,vue\]\);/);
  assert.doesNotMatch(compte, /Linking\.openURL\(SITE_WEB/, 'aucune démarche professionnelle n’ouvre le navigateur sans prévenir');
});

test('reprise : « Commander » ouvre directement la connexion client et rouvre la commande après connexion', () => {
  const catalogue = lire('catalogue/CatalogueReel.tsx');
  assert.match(catalogue, /setOrientation\(\{ profil: 'client', action: 'existant', reprise: 'commande' \}\)/);
  assert.match(catalogue, /const reprendre = orientation\?\.reprise === 'commande'; setOrientation\(null\); if \(reprendre\) \{ setCompteOuvert\(false\); setDemandeCompte\(null\); setCommandeOuverte\(true\); \}/);
  assert.match(catalogue, /setVisiteOuverte\(false\); setRemonterCompte\(n => n \+ 1\);/);
  assert.deepEqual(orienterApresConnexion({ profil: 'client', action: 'existant', reprise: 'commande' }, { restaurateur: false, livreur: false }), { genre: 'catalogue' });
});
