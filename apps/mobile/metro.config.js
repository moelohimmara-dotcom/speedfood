const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Prérequis SQLite WASM pour l'aperçu web ; aucun réglage du site de production.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
const preceder = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const suivant = preceder ? preceder(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return suivant(req, res, next);
  };
};
module.exports = config;
