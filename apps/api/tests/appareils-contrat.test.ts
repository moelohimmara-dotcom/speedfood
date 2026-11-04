import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATEFORMES_APPAREIL, jetonAppareilValide, lireDemandeAppareil, lireDemandeRetrait } from "@speedfood/shared/contracts/appareils";
import { jetonAppareilValide as jetonAppareilValideSite } from "../../web/src/lib/push/fcm.ts";

test("contrat appareils : la règle du jeton d'appareil est la même que celle du site, sur un jeu de valeurs limites", () => {
  const valeurs: unknown[] = ["", "a".repeat(19), "a".repeat(20), "a".repeat(4096), "a".repeat(4097), "a".repeat(20) + " ", "a".repeat(20) + "é", "aZ09_:-.".repeat(3), "a".repeat(20) + "/", "a".repeat(20) + "\n", undefined, null, 1, {}, []];
  for (const v of valeurs) assert.equal(jetonAppareilValide(v), jetonAppareilValideSite(v), JSON.stringify(v)?.slice(0, 30));
});

test("contrat appareils : liste blanche des plateformes, corps lus sans jamais reprendre le jeton dans un message", () => {
  assert.deepEqual([...PLATEFORMES_APPAREIL], ["android", "ios"]);
  const jeton = "z".repeat(25);
  assert.deepEqual(lireDemandeAppareil({ jeton, plateforme: "ios", versionApp: "1", utilisateurId: "x" }), { ok: true, jeton, plateforme: "ios", versionApp: "1" });
  for (const corps of [null, undefined, "texte", [], 3, { jeton, plateforme: "windows" }, { jeton: jeton + " ", plateforme: "ios" }]) {
    const r = lireDemandeAppareil(corps);
    assert.equal(r.ok, false);
    assert.ok(!JSON.stringify(r).includes(jeton));
  }
  assert.deepEqual(lireDemandeRetrait({ jeton, plateforme: "windows", utilisateurId: "x" }), { ok: true, jeton });
  assert.equal(lireDemandeRetrait({ jeton: "court" }).ok, false);
});
