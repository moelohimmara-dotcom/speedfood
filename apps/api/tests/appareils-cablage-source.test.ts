import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE du lot E1. EXCEPTION documentée (même nature que le lot D5) : `appareils_push` n'a aucune policy (migration 20261022170000), donc `enregistrerAppareil` et `retirerAppareil` du site
// écrivent avec la clé de service. Le fichier de câblage de l'API n'importe NI le client administrateur NI la clé : il branche ces deux fonctions, atteintes seulement après le jeton porteur strict,
// le plafond par compte et la validation du corps. Ces tests figent ce périmètre pour qu'une évolution soit revue.
const lire = (relatif: string) => readFileSync(fileURLToPath(new URL(relatif, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansComm = (brut: string) => brut.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");

const cablage = sansComm(lire("../src/appareils/cablage.ts"));
const route = sansComm(lire("../src/routes/appareils.ts"));
const siteAppareils = sansComm(lire("../../web/src/lib/push/appareils.ts"));

test("cablage E1 : exactement trois imports ; AUCUN import de la clé de service ni du client administrateur", () => {
  assert.deepEqual(cablage.match(/^import .*$/gm), [
    'import { enregistrerAppareil, retirerAppareil } from "@/lib/push/appareils";',
    'import { limiterAppareil } from "@/lib/securite/limitation-debit";',
    'import type { Deps } from "../types.ts";',
  ]);
  assert.equal((cablage.match(/db\/admin/g) ?? []).length, 0, "nombre d'imports de la clé de service dans le câblage : 0");
  assert.ok(!/creerClientAdmin|service_role|SERVICE_ROLE|process\.env|console\.|createClient/.test(cablage));
});

test("cablage E1 : le plafond est celui du site, l'enregistrement et le retrait passent le compte reçu tel quel et une seule fois chacun", () => {
  const lignes = cablage.split("\n");
  const unique = (motif: RegExp, nom: string) => assert.equal(lignes.filter((l) => motif.test(l)).length, 1, nom);
  unique(/^\s*limiter:\s*limiterAppareil,\s*$/, "limiter");
  unique(/^\s*enregistrer:\s*\(utilisateurId,\s*jeton,\s*plateforme,\s*versionApp\)\s*=>\s*enregistrerAppareil\(utilisateurId,\s*jeton,\s*plateforme,\s*versionApp\),\s*$/, "enregistrer");
  unique(/^\s*retirer:\s*\(utilisateurId,\s*jeton\)\s*=>\s*retirerAppareil\(utilisateurId,\s*jeton\),\s*$/, "retirer");
  assert.equal((cablage.match(/enregistrerAppareil\(/g) ?? []).length, 1);
  assert.equal((cablage.match(/retirerAppareil\(/g) ?? []).length, 1);
});

test("worker E1 : le câblage des appareils est branché une fois, sans autre usage de la clé de service dans worker.ts", () => {
  const worker = sansComm(lire("../src/worker.ts"));
  assert.equal((worker.match(/serviceAppareils/g) ?? []).length, 2, "import + une propriété");
  assert.ok(/^\s*appareils:\s*serviceAppareils,\s*$/m.test(worker));
  assert.ok(!/@\/lib\/push/.test(worker), "worker.ts n'importe pas le service des appareils directement");
});

test("routes/appareils.ts (API) : aucun import du site, de la clé de service ni de l'environnement ; plafond avant le corps ; compte pris du jeton ; aucun CORS", () => {
  assert.ok(!/from "@\/|creerClientAdmin|db\/admin|service_role|SERVICE_ROLE|process\.env|console\.|Access-Control|access-control/i.test(route));
  assert.equal((route.match(/limiterParCompte\(deps\.appareils\.limiter\)/g) ?? []).length, 2, "plafond sur chacune des deux routes");
  assert.equal((route.match(/identifier\(deps\.verificateurs\.strict,/g) ?? []).length, 2, "jeton porteur STRICT sur chacune des deux routes");
  assert.ok(!/verificateurs\.local/.test(route));
  // Sur chaque route : identité, puis plafond, puis (dans le gestionnaire) le corps, puis la validation, puis le service.
  for (const [debut, service] of [['route.post("/",', "deps.appareils.enregistrer("], ['route.post("/retirer",', "deps.appareils.retirer("]] as const) {
    const i = route.indexOf(debut);
    assert.ok(i >= 0, debut);
    const bloc = route.slice(i, route.indexOf("\n  });", i));
    const ordre = ["identifier(", "limiterParCompte(", "await lireCorpsJson(c)", "lireDemande", service];
    const pos = ordre.map((m) => bloc.indexOf(m));
    assert.ok(pos.every((p) => p >= 0), `${debut} : étapes présentes ${pos.join(",")}`);
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, `${debut} : ordre identité, plafond, corps, validation, service`);
    assert.ok(/c\.get\("utilisateurId"\)/.test(bloc), "le compte vient du contexte posé par le jeton porteur");
    assert.ok(!/utilisateurId\s*[:=]\s*(lu|demande|corps)|(lu|demande|corps)\.(corps\.)?utilisateurId/.test(bloc), "aucune lecture du compte dans le corps");
  }
});

test("service des appareils (site) : seule la table `appareils_push` est écrite par les deux fonctions branchées, avec le compte reçu ; imports figés", () => {
  assert.equal((siteAppareils.match(/^import /gm) ?? []).length, 5, "liste des imports figée : toute nouvelle dépendance doit être revue");
  assert.equal((siteAppareils.match(/from "@\/lib\/db\/admin"/g) ?? []).length, 1);
  const debutEnreg = siteAppareils.indexOf("export async function enregistrerAppareil(");
  const debutRetrait = siteAppareils.indexOf("export async function retirerAppareil(");
  const debutNotif = siteAppareils.indexOf("export async function notifierUtilisateursFcm(");
  assert.ok(debutEnreg > 0 && debutRetrait > debutEnreg && debutNotif > debutRetrait);
  const enregistrer = siteAppareils.slice(debutEnreg, debutRetrait);
  const retirer = siteAppareils.slice(debutRetrait, debutNotif);
  assert.ok(/\.from\("appareils_push"\)\s*\.upsert\(\{ utilisateur_id: utilisateurId, jeton, plateforme, version_app: versionApp,[^}]*\}, \{ onConflict: "jeton" \}\)/.test(enregistrer), "upsert sur le jeton, compte reçu");
  assert.equal((enregistrer.match(/\.from\("/g) ?? []).length, 3, "trois accès, tous à appareils_push");
  assert.equal((enregistrer.match(/\.from\("appareils_push"\)/g) ?? []).length, 3);
  assert.ok(/\.eq\("utilisateur_id", utilisateurId\)\.order\("mis_a_jour_le"/.test(enregistrer), "plafond de 10 appareils compté sur le compte");
  assert.ok(/\.from\("appareils_push"\)\.delete\(\)\.eq\("utilisateur_id", utilisateurId\)\.eq\("jeton", jeton\)/.test(retirer), "retrait filtré sur le compte ET le jeton");
  assert.equal((retirer.match(/\.from\("/g) ?? []).length, 1);
  assert.ok(!/console\./.test(enregistrer + retirer), "aucune journalisation dans l'enregistrement ni le retrait");
});

// Auto-vérification des analyseurs (une variante dangereuse serait vue).
test("l'analyseur E1 : un câblage qui importerait le client administrateur, ou un retrait sans filtre de compte, serait détecté", () => {
  assert.equal(("import { creerClientAdmin } from \"@/lib/db/admin\";".match(/db\/admin/g) ?? []).length, 1);
  assert.ok(!/\.delete\(\)\.eq\("utilisateur_id", utilisateurId\)\.eq\("jeton", jeton\)/.test('.from("appareils_push").delete().eq("jeton", jeton)'));
});
