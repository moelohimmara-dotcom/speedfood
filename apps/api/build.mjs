// Assemble le Worker de l'API avec esbuild, puis vérifie qu'AUCUN fichier de Next.js n'est entré dans le paquet.
// `server-only` devient un module vide et `next/headers` une cale (voir src/cales). Les alias `@/` des services du site sont résolus par le tsconfig du site.
import { build } from "esbuild";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = dirname(fileURLToPath(import.meta.url));

/** Chemins d'entrées qui trahissent Next.js (ou son adaptateur Cloudflare) dans le paquet. */
const INTERDITS = [/node_modules[\\/]next[\\/]/, /node_modules[\\/]@opennextjs[\\/]/, /node_modules[\\/]react-dom[\\/]/];

export async function construire({ entree = join(racine, "src", "worker.ts"), sortie = join(racine, "dist", "worker.js") } = {}) {
  const resultat = await build({
    entryPoints: [entree],
    outfile: sortie,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser", "import"],
    external: ["node:*", "cloudflare:*"],
    alias: {
      "server-only": join(racine, "src", "cales", "vide.ts"),
      "next/headers": join(racine, "src", "cales", "next-headers.ts"),
    },
    tsconfig: join(racine, "tsconfig.json"),
    metafile: true,
    logLevel: "warning",
    legalComments: "none",
  });
  const interdits = Object.keys(resultat.metafile.inputs).filter((chemin) => INTERDITS.some((motif) => motif.test(chemin)));
  return { metafile: resultat.metafile, octets: statSync(sortie).size, interdits };
}

// Lancé directement (`npm run build`) : écrit dist/worker.js et échoue si Next.js est entré dans le paquet.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { octets, interdits } = await construire();
  console.log(`dist/worker.js : ${(octets / 1024).toFixed(0)} Kio`);
  if (interdits.length > 0) {
    console.error("ECHEC : des fichiers de Next.js sont entrés dans le paquet de l'API :");
    for (const chemin of interdits.slice(0, 10)) console.error(`  ${chemin}`);
    process.exit(1);
  }
}
