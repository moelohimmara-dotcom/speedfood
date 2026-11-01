// Complète app.json : l'identité de production n'est activée que par SPEEDFOOD_IDENTITE=production (workflow android-candidat.yml).
const { appliquer } = require("./identite-candidat.cjs");

module.exports = ({ config }) => appliquer(config, process.env);
