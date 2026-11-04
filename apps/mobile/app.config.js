// Complète app.json : l'identité de production n'est activée que par SPEEDFOOD_IDENTITE=production (workflow android-candidat.yml).
// Firebase : google-services.json n'est référencé que s'il est présent (seule son existence est testée, jamais son contenu).
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { appliquer, avecFirebase } = require("./identite-candidat.cjs");

module.exports = ({ config }) => avecFirebase(appliquer(config, process.env), existsSync(join(__dirname, "google-services.json")));
