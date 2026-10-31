// Copie des sources du site dans un dossier temporaire, avec les imports réécrits pour que Node les exécute tels quels (sans compilation) :
// suffixe « .ts », alias « @/ » du site, paquets résolus depuis le dépôt, et paquet partagé « @speedfood/shared/<chemin> » (dont le fichier est
// copié au passage, avec ses propres imports). Utilisé par le lanceur de tests purs et par les scripts d'essai sur la vraie base.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";

/**
 * @param {object} options
 * @param {string} options.tmp dossier temporaire de destination
 * @param {string} options.racine racine du site (apps/web)
 * @param {Record<string, string>} options.paquets nom de paquet -> URL résolue depuis le dépôt (réécrit `from "nom"`)
 * @param {boolean} [options.retirerServerOnly] supprime `import "server-only"` (fichiers serveur chargés hors de Next)
 */
export function creerCopieur({ tmp, racine, paquets, retirerServerOnly = false }) {
  const racinePartage = join(racine, "..", "..", "packages", "shared", "src");
  const dejaCopies = new Set();

  function versRelatif(depuis, vers) {
    const r = relative(dirname(depuis), vers).split("\\").join("/");
    return r.startsWith(".") ? r : "./" + r;
  }

  function transformer(contenu, dest) {
    let texte = contenu;
    if (retirerServerOnly) texte = texte.replace(/import\s+"server-only";?/g, "");
    return texte
      .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
      .replace(/from\s+"([^"]+)"/g, (tout, nom) => (Object.hasOwn(paquets, nom) ? `from "${paquets[nom]}"` : tout))
      // Alias `@/` du projet : réécrit en chemin relatif vers la copie (les imports de types disparaissent de toute façon à l'exécution).
      .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => `from "${versRelatif(dest, join(tmp, "src"))}/${chemin}.ts"`)
      .replace(/from\s+"@speedfood\/shared\/([^"]+?)"/g, (_, chemin) => {
        copierPartage(chemin);
        return `from "${versRelatif(dest, join(tmp, "packages", "shared", "src", `${chemin}.ts`))}"`;
      });
  }

  function copierPartage(chemin) {
    const dest = join(tmp, "packages", "shared", "src", `${chemin}.ts`);
    if (dejaCopies.has(dest)) return;
    dejaCopies.add(dest);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, transformer(readFileSync(join(racinePartage, `${chemin}.ts`), "utf8"), dest));
  }

  function copier(rel) {
    const dest = join(tmp, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, transformer(readFileSync(join(racine, rel), "utf8"), dest));
  }

  return copier;
}
