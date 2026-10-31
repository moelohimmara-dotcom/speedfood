// Usage : npm run comparer -- <urlReference> <urlCandidate> <chemin> [<chemin>…]
// Exemple : npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide
import { comparerRoutes } from "./comparateur.mjs";

const [reference, candidate, ...chemins] = process.argv.slice(2);
if (!reference || !candidate || chemins.length === 0) {
  console.error("Usage : npm run comparer -- <urlReference> <urlCandidate> <chemin> [<chemin>…]");
  process.exit(2);
}
const ecarts = await comparerRoutes(reference, candidate, chemins);
if (ecarts.length === 0) {
  console.log(`${chemins.length} route(s) identiques : 0 écart`);
} else {
  console.error(`ECHEC : ${ecarts.length} écart(s)`);
  for (const ecart of ecarts) console.error(`  ${ecart}`);
  process.exit(1);
}
