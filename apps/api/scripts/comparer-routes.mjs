// Usage : npm run comparer -- <urlReference> <urlCandidate> <chemin> [<chemin>…]
// Exemple : npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide
import { comparerRoutes } from "./comparateur.mjs";

// Option : --tolerer-non-2xx compare volontairement des réponses d'erreur (sinon tout statut hors 2xx est un écart).
const arguments_ = process.argv.slice(2);
const tolererNon2xx = arguments_.includes("--tolerer-non-2xx");
const [reference, candidate, ...chemins] = arguments_.filter((a) => a !== "--tolerer-non-2xx");
if (!reference || !candidate || chemins.length === 0) {
  console.error("Usage : npm run comparer -- [--tolerer-non-2xx] <urlReference> <urlCandidate> <chemin> [<chemin>…]");
  process.exit(2);
}
const ecarts = await comparerRoutes(reference, candidate, chemins, fetch, { tolererNon2xx });
if (ecarts.length === 0) {
  console.log(`${chemins.length} route(s) identiques : 0 écart`);
} else {
  console.error(`ECHEC : ${ecarts.length} écart(s)`);
  for (const ecart of ecarts) console.error(`  ${ecart}`);
  process.exit(1);
}
