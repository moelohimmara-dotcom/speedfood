import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE sur le source de restaurant/cablage.ts (la couche qui choisit, en production, QUEL client reçoit chaque service). Les autres tests injectent des doublures :
// ils ne voient pas ce fichier. Celui-ci échoue si le client administrateur est utilisé ailleurs que pour lister les seconds facteurs, si un service reçoit autre chose que
// le client lié au jeton, ou si le filtre « second facteur confirmé » est neutralisé. Il ne prouve pas que le Worker démarre (voir « Ce qui n'est PAS vérifié »).
const source = readFileSync(fileURLToPath(new URL("../src/restaurant/cablage.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
const code = sansCommentaires.join("\n");

const unique = (motif: RegExp, message: string) => assert.equal(sansCommentaires.filter((l) => motif.test(l)).length, 1, message);

test("cablage : le client administrateur n'est APPELÉ qu'une fois, pour `clientAdmin` (il ne sert qu'à lister les seconds facteurs)", () => {
  assert.equal((code.match(/creerClientAdmin\(/g) ?? []).length, 1, "creerClientAdmin() appelé ailleurs que dans clientAdmin");
  unique(/^\s*clientAdmin:\s*\(\)\s*=>\s*creerClientAdmin\(\),\s*$/, "clientAdmin doit être la seule ligne qui appelle creerClientAdmin()");
  assert.ok(!/creerClientAdmin\s*[,)]/.test(code.replace(/import[^\n]*\n/g, "").replace(/typeof creerClientAdmin/g, "")), "creerClientAdmin passé comme valeur");
});

test("cablage : le client lié au jeton est celui de `clientJeton`", () => {
  unique(/^\s*clientJeton:\s*\(jeton\)\s*=>\s*creerClientJeton\(jeton\),\s*$/, "clientJeton");
});

test("cablage : lecture, écriture, questions et appartenance reçoivent leur paramètre `client` (le client du jeton), jamais un autre", () => {
  unique(/^\s*questionsRequises:\s*async\s*\(client\)\s*=>\s*\(await lireEtatQuestions\(client as SupabaseClient\)\)\.requise,\s*$/, "questionsRequises");
  unique(/^\s*const \{ data \} = await \(client as SupabaseClient\)\.from\("restaurant_memberships"\)\.select\("restaurant_id, role"\)\.eq\("utilisateur_id", utilisateurId\)\.maybeSingle\(\);\s*$/, "appartenance");
  unique(/^\s*appartenance:\s*async\s*\(client,\s*utilisateurId\)\s*=>\s*\{\s*$/, "signature de appartenance");
  unique(/^\s*lireCommandes:\s*\(client,\s*restaurantId,\s*origine\)\s*=>\s*lireCommandesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*origine\),\s*$/, "lireCommandes");
  unique(/^\s*traiterCommande:\s*\(client,\s*utilisateurId,\s*restaurantId,\s*commandeId,\s*action\)\s*=>\s*traiterCommande\(client as ClientCommandeDb,\s*utilisateurId,\s*restaurantId,\s*commandeId,\s*action\),\s*$/, "traiterCommande");
});

test("cablage : second facteur = facteurs au statut « verified » lus avec le client administrateur reçu en paramètre, pour le compte du jeton", () => {
  unique(/^\s*aSecondFacteurConfirme:\s*async\s*\(admin,\s*utilisateurId\)\s*=>\s*\{\s*$/, "signature de aSecondFacteurConfirme");
  unique(/^\s*const \{ data \} = await \(admin as ReturnType<typeof creerClientAdmin>\)\.auth\.admin\.mfa\.listFactors\(\{ userId: utilisateurId \}\);\s*$/, "listFactors");
  unique(/^\s*return \(data\?\.factors \?\? \[\]\)\.some\(\(f\) => f\.status === "verified"\);\s*$/, "filtre « verified »");
});

test("cablage : plafond par compte et origine du site câblés sur les bons services du site", () => {
  unique(/^\s*limiter:\s*limiterRestaurantApplication,\s*$/, "limiter");
  unique(/^\s*origineSite:\s*origineDuSite,\s*$/, "origineSite");
});

test("cablage : aucune lecture d'environnement ni journal dans le câblage", () => {
  assert.ok(!/process\.env|console\./.test(code));
});

test("l'analyseur : une variante qui passe le client administrateur à un service serait détectée", () => {
  const faux = "lireCommandes: (client, restaurantId, origine) => lireCommandesRestaurant(creerClientAdmin() as SupabaseClient, restaurantId, origine),";
  assert.ok(!/^\s*lireCommandes:\s*\(client,\s*restaurantId,\s*origine\)\s*=>\s*lireCommandesRestaurant\(client as SupabaseClient,/.test(faux));
  assert.equal(((faux + "\nclientAdmin: () => creerClientAdmin(),").match(/creerClientAdmin\(/g) ?? []).length, 2);
});
