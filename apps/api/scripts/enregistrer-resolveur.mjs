import { register, registerHooks } from "node:module";

// `registerHooks` (Node 22.15 et plus) remplace `register`, déprécié : son avertissement polluait les journaux capturés par les tests.
// Repli sur `register` pour les Node plus anciens, qui ne connaissent pas encore `registerHooks`.
if (typeof registerHooks === "function") {
  registerHooks({
    resolve(specifieur, contexte, suivant) {
      try {
        return suivant(specifieur, contexte);
      } catch (erreur) {
        const relatif = specifieur.startsWith("./") || specifieur.startsWith("../");
        if (relatif && erreur?.code === "ERR_MODULE_NOT_FOUND" && !/\.[a-z]+$/i.test(specifieur)) {
          return suivant(`${specifieur}.ts`, contexte);
        }
        throw erreur;
      }
    },
  });
} else {
  register("./resolveur-ts.mjs", import.meta.url);
}
