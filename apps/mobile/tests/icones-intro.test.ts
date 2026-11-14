import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';

const lire = (relatif: string) => readFileSync(cheminDepuisModule(relatif), 'utf8');

test('icones : le jeu couvre les actions du client (cloche, aide, verrou, photo, document, parametres...)', () => {
  const icone = lire('../src/design/Icone.tsx');
  for (const nom of ['cloche', 'telephone', 'message', 'cadenas', 'deconnexion', 'corbeille', 'crayon', 'camera', 'actualiser', 'externe', 'document', 'engrenage', 'eclair', 'plat', 'liste', 'info', 'alerte', 'partage', 'etoile']) {
    assert.match(icone, new RegExp(`\\b${nom}:\\s*'`), `icone manquante : ${nom}`);
  }
});

test('bouton : icone avant le libelle, et variante icone seule toujours nommee pour l accessibilite', () => {
  const composants = lire('../src/design/Composants.tsx');
  const corps = composants.slice(composants.indexOf('export function Bouton'));
  const fin = corps.indexOf('export function Ecran');
  const bouton = corps.slice(0, fin);
  assert.ok(bouton.indexOf('<Icone') >= 0 && bouton.indexOf('<Icone') < bouton.indexOf('>{titre}</Texte>'), 'l icone precede le libelle rendu');
  assert.match(bouton, /libelleCourt/, 'la forme tuile (icone + mot court) existe');
  assert.match(bouton, /iconeSeule/, 'la variante icone seule existe');
  assert.match(bouton, /accessibilityLabel=\{titre\}/, 'le nom accessible reste le titre, meme en icone seule');
});

test('bouton metier : l alias Action transmet l icone au bouton canonique', () => {
  const alias = lire('../src/connexion/BoutonAction.tsx');
  assert.match(alias, /icone/, 'Action accepte une icone');
  assert.match(alias, /icone=\{icone\}/, 'Action transmet l icone a Bouton');
});

test('intro logo : animation courte montee dans le layout, mouvement reduit respecte, catalogue toujours monte', () => {
  const intro = lire('../src/design/IntroLogo.tsx');
  assert.match(intro, /useMouvementReduit/, 'l intro respecte le mouvement reduit');
  assert.match(intro, /dureeMouvement/, 'les durees passent par le garde-fou du depot');
  assert.match(intro, /speedfood\.png/, 'le logo officiel est anime');
  const layout = lire('../src/app/_layout.tsx');
  assert.match(layout, /IntroLogo/, 'le layout monte l intro');
  assert.match(layout, /<CatalogueReel \/>/, 'le catalogue reste monte sous l intro');
});

test('espaces pro : onglets restaurateur, actions livreur et modules equipe portent une icone', () => {
  const resto = lire('../src/connexion/RestaurateurReel.tsx');
  assert.match(resto, /ICONES_SECTIONS/, 'les onglets du restaurateur ont leurs icones');
  const livreur = lire('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /icone="eclair"/, 'la bascule en ligne du livreur porte l eclair');
  assert.match(livreur, /icone="liste"/, 'la file des courses porte l icone liste');
  const equipe = lire('../src/connexion/EquipeReel.tsx');
  assert.match(equipe, /icone: '/, 'chaque module equipe declare son icone');
  assert.match(equipe, /icone=\{m\.icone\}/, 'les boutons de modules affichent leur icone');
});

test('accueil client : les entrees principales portent une icone (panier, compte, aide, visite, restaurant)', () => {
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  for (const nom of ['panier', 'compte', 'message', 'etoile', 'plat']) {
    assert.match(catalogue, new RegExp(`icone="${nom}"`), `entree sans icone dans le catalogue : ${nom}`);
  }
});
