import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { cheminDepuisModule } from './chemins.ts';

const { appliquer, CODE_PUBLIE } = createRequire(import.meta.url)("../identite-candidat.cjs") as {
  appliquer: (c: Record<string, any>, e: Record<string, string | undefined>) => Record<string, any>;
  CODE_PUBLIE: number;
};
const base = JSON.parse(readFileSync(cheminDepuisModule('../app.json'), 'utf8')).expo;

test("sans variable, la configuration de contrôle est inchangée", () => {
  assert.deepEqual(appliquer(base, {}), base);
  assert.equal(appliquer(base, {}).android.package, "com.speedfood.clientdemo");
});

test("identité de production : paquet, code et version", () => {
  const c = appliquer(base, { SPEEDFOOD_IDENTITE: "production", SPEEDFOOD_CODE: "52", SPEEDFOOD_VERSION: "3.0.0" });
  assert.equal(c.android.package, "com.speedfood.app");
  assert.equal(c.android.versionCode, 52);
  assert.equal(c.version, "3.0.0");
  assert.equal(c.android.adaptiveIcon.backgroundColor, base.android.adaptiveIcon.backgroundColor, "le reste est préservé");
});

test("refuse un code qui ne dépasse pas le code publié, ou une version mal formée", () => {
  const prod = { SPEEDFOOD_IDENTITE: "production", SPEEDFOOD_VERSION: "3.0.0" };
  assert.throws(() => appliquer(base, { ...prod, SPEEDFOOD_CODE: String(CODE_PUBLIE) }), /supérieur/);
  assert.throws(() => appliquer(base, { ...prod, SPEEDFOOD_CODE: "abc" }), /supérieur/);
  assert.throws(() => appliquer(base, { ...prod, SPEEDFOOD_CODE: "60", SPEEDFOOD_VERSION: "v3" }), /forme/);
});
