// Usage : npm run comparer -- [--tolerer-non-2xx] [--jeton-env NOM] [--methode POST] [--autoriser-ecriture] [--corps '{"a":1}'] <urlReference> <urlCandidate> <chemin> [<chemin>…]
// Exemple : npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide
// --jeton-env NOM : NOM est une variable d'environnement qui contient un jeton porteur ; il est envoyé aux deux adresses et jamais affiché.
// --autoriser-ecriture : OBLIGATOIRE pour envoyer une écriture (méthode autre que GET ou HEAD) avec un jeton ; sans ce drapeau l'envoi est refusé (code 2) avant toute requête.
// Codes de sortie : 0 = aucun écart, 1 = écarts, 2 = usage ou erreur (aucune valeur sensible n'est jamais affichée).
import { comparerRoutes } from "./comparateur.mjs";

const USAGE = "Usage : npm run comparer -- [--tolerer-non-2xx] [--jeton-env NOM] [--methode POST] [--autoriser-ecriture] [--corps JSON] <urlReference> <urlCandidate> <chemin> [<chemin>…]\n  --autoriser-ecriture : requis pour envoyer une écriture (méthode autre que GET ou HEAD) avec un jeton ; refusé sinon.";
const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const JETON_VALIDE = /^[\x21-\x7E]+$/; // ASCII visible seulement : ni espace, ni retour à la ligne, ni accent
const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];

// Pas de process.exit : sous Windows il plante (0xC0000409) au lieu de rendre le code voulu.
function erreur(message) {
  console.error(message);
  process.exitCode = 2;
}

// Lit les options ; les options à valeur consomment l'argument suivant. Renvoie null si une valeur manque.
function lireArguments(brut) {
  const resultat = { tolererNon2xx: false, autoriserEcriture: false, jetonEnv: undefined, methode: undefined, corps: undefined, positionnels: [] };
  for (let i = 0; i < brut.length; i++) {
    const a = brut[i];
    if (a === "--tolerer-non-2xx") resultat.tolererNon2xx = true;
    else if (a === "--autoriser-ecriture") resultat.autoriserEcriture = true;
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

// Hôte d'une adresse, ou null si elle est illisible. Les identifiants éventuels de l'adresse ne sont pas conservés.
function lireAdresse(texte) {
  try {
    const url = new URL(texte);
    return { protocole: url.protocol, hote: url.host, nomHote: url.hostname };
  } catch {
    return null;
  }
}

// Vrai si base + chemin (tel que le comparateur le construit) et le chemin résolu contre la base restent sur l'hôte de la base.
function memeHote(base, chemin) {
  try {
    const hote = new URL(base).host;
    return new URL(base.replace(/\/+$/, "") + chemin).host === hote && new URL(chemin, base).host === hote;
  } catch {
    return false;
  }
}

const lus = lireArguments(process.argv.slice(2));
const [reference, candidate, ...chemins] = lus ? lus.positionnels : [];
if (!lus || !reference || !candidate || chemins.length === 0) {
  erreur(USAGE);
} else if (lus.corps !== undefined && lus.methode === undefined) {
  erreur("--corps exige --methode (par exemple --methode POST)");
} else if (chemins.some((c) => !c.startsWith("/") || c.startsWith("//") || c.includes("\\"))) {
  // Un chemin est relatif à la base : "/x" seulement. ".evil", "//hote/x" ou "@hote/x" changeraient l'hôte réellement appelé.
  erreur("Chaque chemin doit commencer par un seul « / » (ni « // » ni antislash) : valeur refusée, non affichée");
} else {
  const options = { tolererNon2xx: lus.tolererNon2xx };
  if (lus.methode !== undefined) options.methode = lus.methode;
  if (lus.corps !== undefined) options.corps = lus.corps;
  let pret = true;
  if (lus.jetonEnv !== undefined) {
    const adresses = [lireAdresse(reference), lireAdresse(candidate)];
    if (!NOM_VALIDE.test(lus.jetonEnv)) {
      // Peut-être le jeton lui-même au lieu du nom de la variable : rien n'est répété.
      erreur("--jeton-env attend le NOM d'une variable d'environnement (lettres, chiffres, _) : valeur refusée, non affichée");
      pret = false;
    } else if (!process.env[lus.jetonEnv]) {
      erreur(`Variable d'environnement ${lus.jetonEnv} : variable absente ou vide`);
      pret = false;
    } else if (!JETON_VALIDE.test(process.env[lus.jetonEnv])) {
      erreur(`Variable d'environnement ${lus.jetonEnv} : jeton invalide (ASCII visible seulement, sans espace ni retour à la ligne) ; valeur non affichée`);
      pret = false;
    } else if (!lus.autoriserEcriture && lus.methode !== undefined && !["GET", "HEAD"].includes(lus.methode.toUpperCase())) {
      // Une écriture avec un jeton réel peut modifier des données (production comprise) : elle exige un drapeau explicite. La méthode n'est pas répétée.
      erreur("Une écriture (méthode autre que GET ou HEAD) avec un jeton exige --autoriser-ecriture : envoi refusé, valeurs non affichées");
      pret = false;
    } else if (adresses.some((a) => a === null || (a.protocole !== "https:" && !(a.protocole === "http:" && HOTES_LOCAUX.includes(a.nomHote))))) {
      erreur("Avec un jeton, chaque adresse doit être en https:// (ou http:// vers localhost, 127.0.0.1, [::1]) : envoi refusé, adresses non affichées");
      pret = false;
    } else if (adresses.some((a, i) => chemins.some((c) => !memeHote([reference, candidate][i], c)))) {
      erreur("Avec un jeton, l'adresse réellement appelée (base + chemin) doit rester sur l'hôte de la base : envoi refusé, valeurs non affichées");
      pret = false;
    } else {
      options.entetes = { authorization: "Bearer " + process.env[lus.jetonEnv] };
      console.error(`Jeton envoyé à : ${adresses[0].hote}, ${adresses[1].hote}`);
    }
  }
  if (pret) {
    // Les options (qui portent le jeton) ne sont jamais journalisées, ni le message ni la trace d'une exception.
    let ecarts = null;
    try {
      ecarts = await comparerRoutes(reference, candidate, chemins, fetch, options);
    } catch {
      erreur("Requête impossible (adresse injoignable, méthode ou en-tête refusé) : détails non affichés");
    }
    if (ecarts !== null) {
      if (ecarts.length === 0) {
        console.log(`${chemins.length} route(s) identiques : 0 écart`);
      } else {
        console.error(`ECHEC : ${ecarts.length} écart(s)`);
        for (const ecart of ecarts) console.error(`  ${ecart}`);
        process.exitCode = 1;
      }
    }
  }
}
