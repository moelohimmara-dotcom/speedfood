const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Les sources sont les VRAIES sources du monorepo, jamais copiées dans le banc.
config.watchFolders = [path.resolve(__dirname, '../../..')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, '../node_modules'), path.resolve(__dirname, '../../../node_modules')];
// Le renderer hoisté et l'application doivent partager React, même si le monorepo possède une autre copie pour le web.
const mobileRoot = path.resolve(__dirname, '..');
const resoudreAvant = config.resolver.resolveRequest;
config.resolver.resolveRequest = (contexte, nom, plateforme) => {
  if (nom === 'react' || nom.startsWith('react/')) return { type: 'sourceFile', filePath: require.resolve(nom, { paths: [mobileRoot] }) };
  return resoudreAvant ? resoudreAvant(contexte, nom, plateforme) : contexte.resolveRequest(contexte, nom, plateforme);
};
module.exports = config;
