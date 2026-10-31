import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error : module JavaScript sans déclaration de types
import { construire } from "../build.mjs";

const racineApi = fileURLToPath(new URL("..", import.meta.url));

async function construireDans(entree: string) {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-api-"));
  try {
    return await construire({ entree: join(racineApi, entree), sortie: join(dossier, "worker.js") });
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

test("le Worker de production se construit sans aucun fichier de Next.js", async () => {
  const resultat = await construireDans("src/worker.ts");
  assert.deepEqual(resultat.interdits, []);
  assert.ok(resultat.octets > 10_000, "le paquet doit contenir Hono et les services");
});

test("les services du site utilisés par l'API se construisent sans Next.js (sonde)", async () => {
  const resultat = await construireDans("sondes/services.ts");
  assert.deepEqual(resultat.interdits, []);
});

test("les services de suivi et de commande se construisent sans Next.js (sonde 1c)", async () => {
  const resultat = await construireDans("sondes/services.ts");
  assert.deepEqual(resultat.interdits, [], "le cœur de création ne doit importer ni next/server ni next/headers directs");
  assert.ok(resultat.octets < 1_200_000, `paquet de la sonde trop gros : ${resultat.octets} octets`);
});

test("la garde mord : un import de next/server dans un paquet est détecté", async () => {
  const resultat = await construireDans("sondes/interdit.ts");
  assert.ok(resultat.interdits.length > 0, "next/server aurait dû être détecté");
});
