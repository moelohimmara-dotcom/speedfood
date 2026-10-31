// Usage : npm run comparer -- [--tolerer-non-2xx] [--jeton-env NOM] [--methode POST] [--corps '{"a":1}'] <urlReference> <urlCandidate> <chemin> [<chemin>…]
// Exemple : npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide
// --jeton-env NOM : NOM est une variable d'environnement qui contient un jeton porteur ; il est envoyé aux deux adresses et jamais affiché.
import { comparerRoutes } from "./comparateur.mjs";

const USAGE = "Usage : npm run comparer -- [--tolerer-non-2xx] [--jeton-env NOM] [--methode POST] [--corps JSON] <urlReference> <urlCandidate> <chemin> [<chemin>…]";

// Lit les options ; les options à valeur consomment l'argument suivant. Renvoie null si une valeur manque.
function lireArguments(brut) {
  const resultat = { tolererNon2xx: false, jetonEnv: undefined, methode: undefined, corps: undefined, positionnels: [] };
  for (let i = 0; i < brut.length; i++) {
    const a = brut[i];
    if (a === "--tolerer-non-2xx") resultat.tolererNon2xx = true;
    else if (a === "--jeton-env" || a === "--methode" || a === "--corps") {
      if (i + 1 >= brut.length) return null;
      const valeur = brut[++i];
      if (a === "--jeton-env") resultat.jetonEnv = valeur;
      else if (a === "--methode") resultat.methode = valeur;
      else resultat.corps = valeur;
    } else resultat.positionnels.push(a);
  }
  return resultat;
}

const lus = lireArguments(process.argv.slice(2));
const [reference, candidate, ...chemins] = lus ? lus.positionnels : [];
if (!lus || !reference || !candidate || chemins.length === 0) {
  console.error(USAGE);
  // Pas de process.exit : sous Windows il plante (0xC0000409) au lieu de rendre le code voulu.
  process.exitCode = 2;
} else {
  const options = { tolererNon2xx: lus.tolererNon2xx };
  if (lus.methode !== undefined) options.methode = lus.methode;
  if (lus.corps !== undefined) options.corps = lus.corps;
  let jetonManquant = false;
  if (lus.jetonEnv !== undefined) {
    const jeton = process.env[lus.jetonEnv];
    if (!jeton) {
      // Le nom de la variable est affiché, jamais sa valeur.
      console.error(`Variable d'environnement ${lus.jetonEnv} : variable absente ou vide`);
      jetonManquant = true;
    } else {
      options.entetes = { authorization: "Bearer " + jeton };
    }
  }
  if (jetonManquant) {
    process.exitCode = 2;
  } else {
    // Les options (qui portent le jeton) ne sont jamais journalisées.
    const ecarts = await comparerRoutes(reference, candidate, chemins, fetch, options);
    if (ecarts.length === 0) {
      console.log(`${chemins.length} route(s) identiques : 0 écart`);
    } else {
      console.error(`ECHEC : ${ecarts.length} écart(s)`);
      for (const ecart of ecarts) console.error(`  ${ecart}`);
      process.exitCode = 1;
    }
  }
}
