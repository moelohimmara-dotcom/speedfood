// Livraison isolée : base API historique, UNIQUEMENT les nouveaux lecteurs catalogue.
// Ne publie ni RPC JetonsCommande, ni SITE_JETONS, ni garde ADR-021 encore en validation.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const base = '30f3ca3';
const livraison = mkdtempSync(join(dirname(racine), 'speedfood-catalogue-livraison-'));
const archive = join(livraison, 'base.zip');
execFileSync('git', ['archive', '--format=zip', '--output', archive, base], { cwd: racine });
execFileSync('tar', ['-xf', archive, '-C', livraison]);
const fichiers = ['apps/api/src/app.ts', 'apps/api/src/types.ts', 'apps/api/src/routes/catalogue.ts', 'apps/api/src/catalogue/service.ts', 'apps/api/src/catalogue/lectures.ts', 'packages/shared/src/contracts/catalogue.ts'];
for (const fichier of fichiers) { mkdirSync(dirname(join(livraison, fichier)), { recursive: true }); copyFileSync(join(racine, fichier), join(livraison, fichier)); }
const entree = join(livraison, 'apps/api/src/worker.ts');
let worker = readFileSync(entree, 'utf8');
if (!worker.includes('const app = creerApp({') || worker.includes('fournirJetonInterne')) throw Error('BASE_INATTENDUE');
worker = "import { lireRestaurants, lireMenu } from './catalogue/service';\n" + worker.replace('const app = creerApp({', 'const app = creerApp({\n  catalogue: { restaurants: lireRestaurants, menu: lireMenu },');
writeFileSync(entree, worker);
const sortie = join(livraison, 'apps/api/dist/worker.js');
const resultat = await build({
  entryPoints: [entree], outfile: sortie, absWorkingDir: livraison,
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'browser', 'import'], external: ['node:*', 'cloudflare:*'],
  alias: { 'server-only': join(livraison, 'apps/api/src/cales/vide.ts'), 'next/headers': join(livraison, 'apps/api/src/cales/next-headers.ts') },
  nodePaths: [join(racine, 'node_modules')], tsconfig: join(livraison, 'apps/api/tsconfig.json'), metafile: true, legalComments: 'none',
});
if (Object.keys(resultat.metafile.inputs).some(p => /node_modules[\\/](next|@opennextjs|react-dom)[\\/]/.test(p))) throw Error('DEPENDANCE_INTERDITE');
const contenu = readFileSync(sortie);
if (contenu.includes(Buffer.from('calcul_jeton_indisponible'))) throw Error('RPC_NON_AUTORISE_DANS_LIVRAISON');
const manifeste = { base, fichiers, sha256: createHash('sha256').update(contenu).digest('hex'), octets: contenu.length, livraison };
writeFileSync(join(livraison, 'catalogue-livraison.json'), JSON.stringify(manifeste, null, 2));
console.log(JSON.stringify(manifeste));
