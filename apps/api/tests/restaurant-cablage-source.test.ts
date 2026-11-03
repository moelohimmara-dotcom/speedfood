import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE sur le source de restaurant/cablage.ts (la couche qui choisit, en production, QUEL client reçoit chaque service). Les autres tests injectent des doublures :
// ils ne voient pas ce fichier. Celui-ci échoue si le client administrateur est utilisé, DANS cablage.ts, ailleurs que pour lister les seconds facteurs (le service partagé du site utilise lui-même le client de service pour deux effets système bornés à une commande dont l'appartenance est déjà vérifiée : échéance d'une proposition et clôture à l'annulation), si un service reçoit autre chose que
// le client lié au jeton, ou si le filtre « second facteur confirmé » est neutralisé. Il ne prouve pas que le Worker démarre (voir « Ce qui n'est PAS vérifié »).
const source = readFileSync(fileURLToPath(new URL("../src/restaurant/cablage.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
const code = sansCommentaires.join("\n");

const unique = (motif: RegExp, message: string) => assert.equal(sansCommentaires.filter((l) => motif.test(l)).length, 1, message);

test("cablage : le client administrateur n'est APPELÉ qu'une fois, pour `clientAdmin` (dans cablage.ts, il ne sert qu'à lister les seconds facteurs)", () => {
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
  unique(/^\s*confirmerPaiement:\s*\(client,\s*restaurantId,\s*commandeId,\s*decision\)\s*=>\s*confirmerPaiement\(client as ClientCommandeDb,\s*restaurantId,\s*commandeId,\s*decision\),\s*$/, "confirmerPaiement");
  unique(/^\s*proposerRevision:\s*\(client,\s*restaurantId,\s*commandeId,\s*valeurs\)\s*=>\s*proposerRevision\(client as ClientCommandeDb,\s*restaurantId,\s*commandeId,\s*valeurs\),\s*$/, "proposerRevision");
});

test("cablage D4a : statut, réglages, menu et disponibilité reçoivent le client du jeton (paramètre `client`), jamais un autre", () => {
  unique(/^\s*lireReglages:\s*\(client,\s*restaurantId,\s*fraicheurHeures\)\s*=>\s*lireReglagesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*fraicheurHeures\),\s*$/, "lireReglages");
  unique(/^\s*ecrireStatut:\s*\(client,\s*restaurantId,\s*demande\)\s*=>\s*ecrireStatutRestaurant\(client as SupabaseClient,\s*restaurantId,\s*demande\),\s*$/, "ecrireStatut");
  unique(/^\s*ecrireReglages:\s*\(client,\s*restaurantId,\s*valeurs\)\s*=>\s*ecrireReglagesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*valeurs\),\s*$/, "ecrireReglages");
  unique(/^\s*lireMenu:\s*\(client,\s*restaurantId\)\s*=>\s*lireMenuRestaurant\(client as SupabaseClient,\s*restaurantId\),\s*$/, "lireMenu");
  unique(/^\s*basculerDisponibilite:\s*\(client,\s*restaurantId,\s*platId,\s*disponible\)\s*=>\s*basculerDisponibilite\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*disponible\),\s*$/, "basculerDisponibilite");
  unique(/^\s*confirmerDisponibilite:\s*\(client,\s*restaurantId,\s*platId\)\s*=>\s*confirmerDisponibilite\(client as SupabaseClient,\s*restaurantId,\s*platId\),\s*$/, "confirmerDisponibilite");
  unique(/^\s*confirmerToutesDisponibilites:\s*\(client,\s*restaurantId\)\s*=>\s*confirmerToutesDisponibilites\(client as SupabaseClient,\s*restaurantId\),\s*$/, "confirmerToutesDisponibilites");
});

test("cablage D4a : la SEULE lecture système du lot est le seuil de fraîcheur global (paramètre non sensible, policy réservée aux administrateurs), jamais une donnée de restaurant", () => {
  assert.equal((code.match(/obtenirParametresApplication\(/g) ?? []).length, 1, "obtenirParametresApplication appelé ailleurs que pour le seuil de fraîcheur");
  unique(/^\s*fraicheurDisponibiliteHeures:\s*async\s*\(\)\s*=>\s*\(await obtenirParametresApplication\(\)\)\.disponibiliteFraicheurHeures,\s*$/, "fraicheurDisponibiliteHeures");
  assert.ok(!/creerClientAdmin\(\)\s*as\s+SupabaseClient/.test(code), "le client administrateur ne sert jamais de client de restaurant");
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

test("l'analyseur D4a : une variante qui passe le client administrateur au statut serait détectée", () => {
  const faux = "ecrireStatut: (client, restaurantId, demande) => ecrireStatutRestaurant(creerClientAdmin() as SupabaseClient, restaurantId, demande),";
  assert.ok(!/^\s*ecrireStatut:\s*\(client,\s*restaurantId,\s*demande\)\s*=>\s*ecrireStatutRestaurant\(client as SupabaseClient,/.test(faux));
  assert.ok(/creerClientAdmin\(\)\s*as\s+SupabaseClient/.test(faux));
  assert.equal(((faux + "\nclientAdmin: () => creerClientAdmin(),").match(/creerClientAdmin\(/g) ?? []).length, 2);
});

test("l'analyseur : une variante qui passe le client administrateur à un service serait détectée", () => {
  const faux = "lireCommandes: (client, restaurantId, origine) => lireCommandesRestaurant(creerClientAdmin() as SupabaseClient, restaurantId, origine),";
  assert.ok(!/^\s*lireCommandes:\s*\(client,\s*restaurantId,\s*origine\)\s*=>\s*lireCommandesRestaurant\(client as SupabaseClient,/.test(faux));
  assert.equal(((faux + "\nclientAdmin: () => creerClientAdmin(),").match(/creerClientAdmin\(/g) ?? []).length, 2);
});
