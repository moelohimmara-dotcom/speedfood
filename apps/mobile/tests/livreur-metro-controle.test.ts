import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { URL as NodeURL, fileURLToPath } from 'node:url';

// Chargement de la seule configuration locale, sans fichier d'environnement ni serveur Metro.
process.env.EXPO_NO_DOTENV = '1';
const depuisMobile = createRequire(new NodeURL('../package.json', import.meta.url));
const depuisBanc = createRequire(new NodeURL('../controle-livreur/package.json', import.meta.url));
const config = depuisBanc('./metro.config.cjs');
const origineApplication = new NodeURL('../controle-livreur/index.tsx', import.meta.url);
const origineRendu = join(dirname(depuisMobile.resolve('react-native/package.json')), 'Libraries/Renderer/implementations/ReactNativeRenderer-dev.js');
const resoudre = config.resolver.resolveRequest ?? ((contexte: any, nom: string, plateforme: string) => contexte.resolveRequest(contexte, nom, plateforme));

test('G1 Metro : React et les deux runtimes JSX résolvent la même instance mobile depuis application et renderer', () => {
  for (const nom of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
    for (const origine of [origineApplication, origineRendu]) {
      const contexte = {
        originModulePath: typeof origine === 'string' ? origine : fileURLToPath(origine),
        resolveRequest: (_c: unknown, demande: string) => ({ type: 'sourceFile', filePath: createRequire(typeof origine === 'string' ? origine : origine.href).resolve(demande) }),
      };
      const resultat = resoudre(contexte, nom, 'android');
      assert.equal(resultat.type, 'sourceFile');
      assert.equal(resultat.filePath, depuisMobile.resolve(nom), nom + ' doit provenir de la même instance depuis chaque émetteur');
    }
  }
});

test('G1 Metro : une copie divergente du résolveur de repli ne peut remplacer le singleton, même en CI dédupliquée', () => {
  for (const nom of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
    for (const originModulePath of [fileURLToPath(origineApplication), origineRendu]) {
      let repliAppelee = false;
      const contexte = {
        originModulePath,
        resolveRequest: () => { repliAppelee = true; return { type: 'sourceFile', filePath: join(dirname(origineRendu), '__autre_instance_react__', 'index.js') }; },
      };
      const resultat = resoudre(contexte, nom, 'ios');
      assert.equal(resultat.filePath, depuisMobile.resolve(nom));
      assert.equal(repliAppelee, false, 'une copie React distincte du renderer ne doit pas entrer dans le graphe');
    }
  }
});

test('G1 Metro : les autres modules gardent le résolveur existant', () => {
  const attendu = { type: 'empty' };
  const contexte = { originModulePath: origineRendu, resolveRequest: () => attendu };
  assert.equal(resoudre(contexte, 'module-temoin-non-react', 'ios'), attendu);
});
