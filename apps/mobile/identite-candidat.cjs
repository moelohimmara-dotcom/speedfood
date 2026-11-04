// Identité du candidat de remplacement de l'APK Kotlin (com.speedfood.app). Par défaut (variable absente) la configuration de contrôle reste INCHANGÉE :
// com.speedfood.clientdemo, version 0.1.0. Aucune clé, aucun mot de passe ici : la signature de production reste faite par Malika.
const PAQUET_PRODUCTION = "com.speedfood.app";
// Dernier code réellement publié sur le site (packages/shared/src/application/version.ts). Le candidat doit le dépasser strictement.
const CODE_PUBLIE = 51;

function appliquer(config, env) {
  if (env.SPEEDFOOD_IDENTITE !== "production") return config;
  const code = Number(env.SPEEDFOOD_CODE);
  if (!Number.isInteger(code) || code <= CODE_PUBLIE) {
    throw new Error(`SPEEDFOOD_CODE doit être un entier supérieur à ${CODE_PUBLIE} (code publié).`);
  }
  const version = env.SPEEDFOOD_VERSION ?? "";
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("SPEEDFOOD_VERSION doit avoir la forme 3.0.0.");
  return {
    ...config,
    name: "Speedfood",
    version,
    android: { ...config.android, package: PAQUET_PRODUCTION, versionCode: code },
  };
}

/**
 * Firebase (notifications, lot E2) : le fichier google-services.json n'est PAS dans le dépôt (ignoré par Git, posé par Malika). Il n'est référencé que s'il existe à la compilation ;
 * sans lui la compilation reste verte et l'appli n'a simplement pas de jeton de notification. Seule l'EXISTENCE du fichier est testée, jamais son contenu.
 */
function avecFirebase(config, fichierPresent) {
  if (!fichierPresent) return config;
  return { ...config, android: { ...config.android, googleServicesFile: "./google-services.json" } };
}

module.exports = { appliquer, avecFirebase, PAQUET_PRODUCTION, CODE_PUBLIE };
