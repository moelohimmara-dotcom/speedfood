import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Refonte des boutons et des icônes (16 novembre 2026) : cinq niveaux de boutons, un seul jeu d'icônes (Lucide), des lignes de navigation pour les destinations.
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(n) ? [p] : []; });
}
const racine = decodeURIComponent(new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
test('un seul jeu d’icônes : Lucide, importé icône par icône (jamais le jeu entier), trait de 2 px', () => {
  const src = lire('../src/design/Icone.tsx');
  assert.match(src, /from 'lucide-react-native\/icons\/trash-2'/);
  assert.doesNotMatch(src, /from 'lucide-react-native'/, 'jamais l’import du jeu entier (4 700 icônes)');
  assert.match(src, /strokeWidth=\{2\}/);
  assert.doesNotMatch(src, /Path\b/, 'plus aucune icône dessinée à la main');
  const pkg = JSON.parse(lire('../package.json'));
  assert.match(pkg.dependencies['lucide-react-native'], /^\d+\.\d+\.\d+$/, 'version exacte, pas de plage');
});
test('toutes les icônes de l’ancien jeu existent encore (aucun écran ne casse)', () => {
  const src = lire('../src/design/Icone.tsx');
  const attendues = ['accueil', 'coeur', 'panier', 'compte', 'recherche', 'position', 'retour', 'fleche', 'bas', 'plus', 'moins', 'coche', 'horloge', 'fermer', 'cloche', 'telephone', 'message', 'cadenas', 'deconnexion', 'corbeille', 'crayon', 'camera', 'actualiser', 'externe', 'document', 'engrenage', 'eclair', 'plat', 'liste', 'info', 'alerte', 'partage', 'etoile'];
  for (const n of attendues) assert.match(src, new RegExp('\\b' + n + ':\\s*[A-Z]'), 'icône manquante : ' + n);
  // Chaque nom d'icône utilisé quelque part dans l'application existe dans le jeu.
  const connus = new Set([...src.matchAll(/\b([a-z]+):\s*[A-Z][A-Za-z0-9]*[,\s]/g)].map(m => m[1]));
  const inconnus = new Set<string>();
  for (const f of fichiers(racine)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\bicone=\{?"([a-z]+)"/g)) if (!connus.has(m[1])) inconnus.add(f.split('src')[1] + ' : ' + m[1]);
    for (const m of t.matchAll(/<Icone nom="([a-z]+)"/g)) if (!connus.has(m[1])) inconnus.add(f.split('src')[1] + ' : ' + m[1]);
  }
  assert.deepEqual([...inconnus], []);
});
test('le bouton canonique a cinq niveaux ; « secondaire » = teinté, le destructif a son propre niveau', () => {
  const src = lire('../src/design/Composants.tsx');
  assert.match(src, /type VarianteBouton = 'plein' \| 'teinte' \| 'contour' \| 'texte' \| 'danger'/);
  assert.match(src, /variante \?\? \(secondaire \? 'teinte' : 'plein'\)/);
  assert.match(src, /case 'danger': return \{ fond: 'transparent', texte: c\.danger, bordure: c\.danger/);
  assert.match(src, /android_ripple/, 'retour visuel au toucher sur Android');
  assert.match(src, /minHeight: 52/);
  assert.match(src, /boutonIcone: \{ width: 48, height: 48/, 'zone de toucher de 48 px pour une icône seule');
});
test('les actions destructives passent par le niveau danger, jamais par le rempli de l’action principale', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /titre="Annuler cette commande" variante="danger"/);
  assert.match(compte, /titre="Oui, annuler" variante="danger"/);
  assert.match(compte, /titre="Supprimer mon compte" variante="danger"/);
  assert.match(lire('../src/catalogue/PanierReelVue.tsx'), /nom="Vider le panier" variante="danger"/);
});
test('l’écran Compte présente les destinations en lignes de navigation, pas en boutons rouges', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  for (const t of ['Mon profil', 'Espace livreur', 'Espace restaurateur', 'Espace équipe']) assert.match(compte, new RegExp('<LigneNavigation[^>]*titre="' + t + '"'));
  assert.doesNotMatch(compte, /<Action titre="Espace (livreur|restaurateur|équipe)"/);
  const src = lire('../src/design/Composants.tsx');
  assert.match(src, /export function LigneNavigation/);
  assert.match(src, /export function GroupeLignes/);
  assert.match(src, /nom="chevron"/);
});
test('un seul bouton dans toute l’application : plus de bouton dessiné à la main sur les écrans de commande, de panier et de règlement', () => {
  for (const f of ['../src/catalogue/CommandeReelle.tsx', '../src/catalogue/PanierReelVue.tsx', '../src/connexion/ReglementReel.tsx']) {
    const t = lire(f);
    assert.match(t, /Bouton/, f + ' : utilise le bouton canonique');
    assert.doesNotMatch(t, /style=\{s\.bouton\b|style=\{\[s\.bouton\b/, f + ' : plus de style de bouton local');
  }
});
test('un « Retour » en bouton texte se place à gauche ; l’icône « plat » n’est plus barrée ; les raccourcis de l’accueil sont des tuiles côte à côte', () => {
  const src = lire('../src/design/Composants.tsx');
  assert.match(src, /niveau === 'texte' && icone === 'retour' && \{ alignSelf: 'flex-start' \}/);
  const icones = lire('../src/design/Icone.tsx');
  assert.match(icones, /plat: Utensils\b/);
  assert.doesNotMatch(icones, /UtensilsCrossed/, 'les couverts barrés se lisent comme un interdit');
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(catalogue, /flexDirection: 'row', gap: 12 \}\}><Action titre="J’ai un restaurant" libelleCourt=/);
  assert.match(catalogue, /titre="Qui êtes-vous \? Changer d’espace" libelleCourt="Changer d’espace"/);
  const parametres = lire('../src/connexion/ParametresReel.tsx');
  assert.match(parametres, /<GroupeLignes>[\s\S]*titre="Revoir la visite guidée"/);
  assert.match(parametres, /titre="Oublier les commandes de cet appareil" variante="danger"/);
});
test('parité Kotlin (G26) : le menu vide invite à ajouter un premier plat, avec le texte de l’ancienne appli', () => {
  const s = lire('../src/connexion/ServiceMenuReel.tsx');
  assert.match(s, /menu\.plats\.length === 0 && <Text style=\{s\.texte\}>Votre menu est vide : ajoutez votre premier plat\.<\/Text>/);
  assert.doesNotMatch(s, /Aucun plat dans le menu\./);
});
test('icônes seules là où le geste est universel, texte là où il faut un mot ; jamais le mot « gain » (ce sont des frais de course)', () => {
  const composants = lire('../src/design/Composants.tsx');
  assert.match(composants, /export function OngletsIcones/);
  assert.match(composants, /accessibilityLabel=\{o\.libelle\}/, 'chaque onglet à icône seule garde son nom accessible');
  const resto = lire('../src/connexion/RestaurateurReel.tsx');
  assert.match(resto, /<OngletsIcones /);
  assert.doesNotMatch(resto, /s\.ongletTexte/, 'plus de texte dans les puces d’onglets');
  assert.match(resto, /titre="Retour au compte" variante="texte" icone="retour" iconeSeule/);
  // Aucun « Actualiser » ni « Retour » à flèche ne reste en bouton à texte : tous passent en icône seule.
  const fautifs: string[] = [];
  for (const f of fichiers(racine)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/<(?:Action|Bouton) titre="(?:Actualiser|Retour)[^"]*"[^\n>]*?icone="(?:actualiser|retour)"[^\n>]*>/g)) if (!/iconeSeule/.test(m[0])) fautifs.push(f.split('src')[1] + ' : ' + m[0].slice(0, 80));
  }
  assert.deepEqual(fautifs, []);
  assert.match(composants, /icone === 'actualiser' \? \{ alignSelf: 'flex-end'/);
  assert.match(lire('../src/connexion/EquipeReel.tsx'), /<GroupeLignes>\{MODULES_EQUIPE\.map/);
  assert.match(lire('../src/connexion/LivreurReel.tsx'), /<LigneNavigation premiere actif=\{fileOuverte\} titre="File des courses"/);
  for (const f of fichiers(racine)) assert.doesNotMatch(readFileSync(f, 'utf8'), /sousTitre="[^"]*\bgains?\b/i, f);
});
test('l’icône d’actualisation vit sur la ligne du titre (restaurateur) ou dans la carte d’état (livreur), jamais seule sous un bouton', () => {
  const resto = lire('../src/connexion/RestaurateurReel.tsx');
  assert.match(resto, /<View style=\{s\.ligneTitre\}>[\s\S]{0,260}section === 'commandes' && <Action titre="Actualiser les commandes"/);
  const livreur = lire('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /<View style=\{s\.ligneTitre\}>[\s\S]{0,260}<Action titre="Actualiser mon état"/);
  assert.equal((livreur.match(/titre="Actualiser mon état" variante="texte" icone="actualiser" iconeSeule disabled=\{ecritureEnCours\}/g) ?? []).length, 1, 'une seule icône d’actualisation dans l’écran d’état');
});
test('sur une ligne de navigation active, le rond de l’icône passe en blanc pour rester visible sur le fond teinté', () => {
  assert.match(lire('../src/design/Composants.tsx'), /style=\{\[s\.rondNav, actif && \{ backgroundColor: c\.surface \}\]\}/);
});
test('suivi et liste des commandes : l’actualisation est sur la ligne du titre, « Commander à nouveau » est en contour dans la liste, la pastille d’état est compacte', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /<View style=\{s\.ligneTitre\}><Text accessibilityRole="header" style=\{\[s\.titre,\{flex:1\}\]\}>[\s\S]{0,200}titre="Actualiser mes commandes"/);
  assert.match(compte, /<View style=\{s\.ligneTitre\}><Text accessibilityRole="header" style=\{\[s\.nom,\{flex:1\}\]\}>[\s\S]{0,260}titre="Actualiser ce suivi"/);
  assert.match(compte, /titre="Commander à nouveau" icone="actualiser" variante="contour"/);
  assert.match(lire('../src/catalogue/FicheRestaurant.tsx'), /pastille: \{[^}]*alignSelf: 'flex-start'/);
});
test('écran de commande : le sélecteur retrait ou livraison est teinté et cerclé, jamais en rouge plein (un seul bouton plein par écran)', () => {
  const s = lire('../src/catalogue/CommandeReelle.tsx');
  assert.match(s, /choixActif: \{ backgroundColor: c\.actionTeinte, borderColor: c\.action \}/);
  assert.match(s, /choixTexteActif: \{ color: c\.actionTeinteTexte \}/);
  assert.doesNotMatch(s, /choixActif: \{ backgroundColor: c\.action \}/);
});
test('écran Service et Menu : un seul bouton plein par bloc, le destructif en danger, l’actualisation en icône seule, retrait d’un supplément en icône seule', () => {
  const s = lire('../src/connexion/ServiceMenuReel.tsx');
  assert.match(s, /titre="Ajouter un plat" icone="plus"/, 'Ajouter un plat reste l’action principale du menu');
  assert.match(s, /titre="Tout confirmer" secondaire icone="coche"/, 'Tout confirmer n’est plus un second bouton plein');
  assert.match(s, /variante="texte" icone="actualiser" iconeSeule agir=\{\(\) => \{ void actualiser\(\); \}\}/);
  assert.match(s, /'Archiver ' \+ p\.nom\} variante="danger" icone="corbeille" iconeSeule/);
  // Sur une carte de plat, les actions courantes sont des icônes seules en rangée ; le nom complet (avec le plat) reste le nom accessible.
  assert.match(s, /rangeeIcones/);
  assert.match(s, /titre=\{\(p\.photoRef === null \? 'Ajouter une photo à ' : 'Changer la photo de '\) \+ p\.nom\} variante="contour" icone="camera" iconeSeule/);
  assert.match(s, /icone=\{p\.disponible \? 'masque' : 'visible'\} iconeSeule/);
  assert.match(s, /'Modifier ' \+ p\.nom\} variante="contour" icone="crayon" iconeSeule/);
  assert.match(s, /'Ajouter un supplément à ' \+ p\.nom\} libelle="Ajouter un supplément"/);
  const composants = lire('../src/design/Composants.tsx');
  assert.match(composants, /\{libelle \?\? titre\}<\/Texte>/, 'le libellé court s’affiche, sinon le titre');
  assert.match(composants, /accessibilityLabel=\{titre\}/, 'le nom accessible reste le titre complet');
  assert.match(s, /variante=\{a\.type === 'archiver' \|\| a\.type === 'option_retirer' \|\| a\.type === 'photo_retirer' \? 'danger' : undefined\}/, 'la confirmation d’une suppression est en danger');
  assert.match(s, /'Retirer le supplément ' \+ o\.nom \+ ' de ' \+ p\.nom\} variante="danger" icone="corbeille" iconeSeule/);
  assert.doesNotMatch(s, /<Action titre="Annuler" secondaire/, 'les annulations de formulaire sont en texte');
});
test('écran de connexion et profil : « Me connecter » reste le seul bouton plein ; les connexions sociales, « Créer un compte » et « Mot de passe oublié ? » sont de niveaux plus discrets ; les suppressions sont en danger', () => {
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /<Action titre="Me connecter" disabled=/, 'Me connecter reste plein');
  assert.match(compte, /titre="Continuer avec Google" variante="contour"/);
  assert.match(compte, /titre="Continuer avec Facebook" variante="contour"/);
  assert.match(compte, /titre="Mot de passe oublié \?" variante="texte"/);
  assert.match(compte, /titre="Créer un compte" variante="contour"/);
  assert.match(compte, /titre="Effacer la session de cet appareil" variante="danger"/);
  assert.match(compte, /titre="Refuser la proposition" variante="contour"/);
  assert.match(lire('../src/connexion/EntreeReelle.tsx'), /titre="Aide et contact" icone="message" variante="contour"/);
  const espace = lire('../src/connexion/EspaceClientReel.tsx');
  assert.match(espace, /titre="Oui, supprimer" variante="danger"/);
  assert.match(espace, /titre="Enregistrer cette adresse" secondaire/);
});
test('écran de commande : une liste de choix (quartiers) s’affiche en lignes alignées à gauche, le sélecteur à deux options reste en pilules', () => {
  const s = lire('../src/catalogue/CommandeReelle.tsx');
  assert.match(s, /moitie \? s\.choixMoitie : s\.choixLigne/);
  assert.match(s, /choixLigne: \{ borderRadius: 14, alignItems: 'flex-start'/);
  assert.match(s, /choixTexteLigne: \{ textAlign: 'left' \}/);
});
