// Mutations ciblées sur le cycle de session notifications (6 novembre). Chaque mutation DOIT faire échouer notifications-cycle-session.test.ts, sinon le script sort en code 1.
// Les sources sont lues en Buffer et restaurées octet pour octet ; seuls le nom de la mutation et les codes de sortie sont affichés. Aucun réseau, aucun shell.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chemin = relatif => fileURLToPath(new URL(relatif, import.meta.url));
const racine = chemin('..');
const test = chemin('../tests/notifications-cycle-session.test.ts');
const SERVICE = chemin('../src/notifications/service.ts');
const APPAREIL = chemin('../src/notifications/enregistrement.ts');
const SESSION = chemin('../src/connexion/session.ts');
const AUTORISATION = chemin('../src/notifications/autorisation.ts');

const mutations = [
  { nom: 'réservation identique retirée', fichier: SERVICE, cible: 'if (c.postes.has(j)) return false;', remplace: '' },
  { nom: 'identité de session ignorée', fichier: SERVICE, cible: '(!d.lireGeneration || d.lireGeneration() === c.identite)', remplace: 'true' },
  { nom: 'ancienne continuation rendue valide', fichier: SERVICE, cible: 'return c === courant && c.actif && (!d.lireGeneration || d.lireGeneration() === c.identite);', remplace: 'return true;' },
  { nom: 'fermeture avant accès débranchée', fichier: SESSION, cible: 'const preparation = this.preparerDeconnexion?.();', remplace: 'const preparation = undefined;' },
  { nom: 'retrait sans sérialisation', fichier: SERVICE, cible: 'const fin = ordonner(async () => {', remplace: 'const fin = Promise.resolve().then(async () => {' },
  { nom: 'vrai renouvellement supprimé en vol', fichier: SERVICE, cible: '!d.appareil.dejaConnu(jeton)', remplace: '!c.postEnCours && !d.appareil.dejaConnu(jeton)' },
  { nom: 'budget augmenté au-delà de six secondes', fichier: SERVICE, cible: '}, 6000);', remplace: '}, 15000);' },
  { nom: 'demande système tardive autorisée', fichier: AUTORISATION, cible: "await d.memoire.marquer();\n    if (d.peutDemander?.() === false) return { decision: 'rien', affiche: null };", remplace: 'await d.memoire.marquer();' },
  { nom: 'garde finale avant fetch retirée', fichier: APPAREIL, cible: "if (contexte?.signal?.aborted || contexte?.peutPartir?.() === false) return 'sans_firebase';", remplace: '' },
];

function arreter(message) { console.log(message); process.exit(1); }

// Originaux gardés en mémoire : restauration octet pour octet, même sur interruption.
const originaux = new Map();
for (const f of new Set(mutations.map(m => m.fichier))) originaux.set(f, readFileSync(f));
const restaurerTout = () => { for (const [f, buf] of originaux) writeFileSync(f, buf); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restaurerTout(); process.exit(1); });

// Vérification AVANT toute modification : chaque cible existe une fois et une seule.
const plans = mutations.map(m => {
  const source = originaux.get(m.fichier), cible = Buffer.from(m.cible);
  const debut = source.indexOf(cible);
  if (debut === -1) arreter(`cible absente : ${m.nom}`);
  if (source.indexOf(cible, debut + 1) !== -1) arreter(`cible multiple : ${m.nom}`);
  return { ...m, muté: Buffer.concat([source.subarray(0, debut), Buffer.from(m.remplace), source.subarray(debut + cible.length)]) };
});

const lancer = () => spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=15000', test], { cwd: racine, shell: false, stdio: 'ignore', timeout: 180000 }).status;

if (lancer() !== 0) arreter('ciblé initial non vert : aucune mutation appliquée');
let echec = false;
for (const p of plans) {
  let code;
  try {
    writeFileSync(p.fichier, p.muté);
    code = lancer();
  } finally {
    writeFileSync(p.fichier, originaux.get(p.fichier));
  }
  const tuee = code !== null && code !== 0;
  console.log(`${p.nom} : code ${code ?? 'indéterminé'}${tuee ? '' : ' — NON DÉTECTÉE'}`);
  if (!tuee) echec = true;
}

for (const [f, buf] of originaux) if (!readFileSync(f).equals(buf)) arreter('restauration incomplète');
const vert = lancer();
console.log(`après restauration : code ${vert ?? 'indéterminé'}`);
if (echec || vert !== 0) arreter('résultat : ÉCHEC');
console.log('résultat : OK, 9 mutations détectées, ciblé vert après restauration');
