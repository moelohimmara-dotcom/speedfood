import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
// @ts-expect-error : module JavaScript sans déclaration de types
import { construire } from "../build.mjs";

const racineApi = fileURLToPath(new URL("..", import.meta.url));

async function construireDans(entree: string): Promise<{ interdits: string[]; octets: number; octetsGzip: number }> {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-api-"));
  try {
    const sortie = join(dossier, "worker.js");
    const resultat = await construire({ entree: join(racineApi, entree), sortie });
    return { ...resultat, octetsGzip: gzipSync(readFileSync(sortie)).length };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Plafonds du Worker de PRODUCTION (même construction que `build:api`) : 1 193 032 octets bruts / ~238 000 gzip au 31/10/2026 (Tâche 10 de 1c-1).
// Brut : ~+17 % de marge, pour qu'une dépendance lourde tirée par erreur se voie. Gzip : limite Cloudflare du plan gratuit, 3 Mio compressés.
const PLAFOND_WORKER_OCTETS = 1_400_000;
const PLAFOND_WORKER_GZIP = 3 * 1024 * 1024;

test("le Worker de production se construit sans aucun fichier de Next.js, sous ses plafonds de taille", async () => {
  const resultat = await construireDans("src/worker.ts");
  assert.deepEqual(resultat.interdits, []);
  assert.ok(resultat.octets > 10_000, "le paquet doit contenir Hono et les services");
  assert.ok(resultat.octets < PLAFOND_WORKER_OCTETS, `Worker trop gros : ${resultat.octets} octets (plafond ${PLAFOND_WORKER_OCTETS})`);
  assert.ok(resultat.octetsGzip < PLAFOND_WORKER_GZIP, `Worker compressé trop gros : ${resultat.octetsGzip} octets (plafond ${PLAFOND_WORKER_GZIP})`);
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
