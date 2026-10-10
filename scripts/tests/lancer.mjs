// Lance les tests purs (disponibilité, classement, liens et redirections) sans bibliothèque de test :
// copie les sources dans un dossier temporaire en ajoutant les suffixes ".ts"
// que Node exige, puis exécute le fichier de tests. Usage : npm run test:unit
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = mkdtempSync(join(tmpdir(), "speedfood-tests-"));
// Les copies vivent hors du dépôt : un paquet (zod/mini) y est importé par son URL résolue depuis le dépôt.
const paquets = { "zod/mini": import.meta.resolve("zod/mini") };

function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const contenu = readFileSync(join(racine, rel), "utf8")
    .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
    .replace(/from\s+"(zod\/mini)"/g, (_, nom) => `from "${paquets[nom]}"`);
  writeFileSync(dest, contenu);
}

copier("src/lib/disponibilite/etat.ts");
copier("src/lib/decouverte/classement.ts");
copier("src/lib/auth/redirection.ts");
copier("scripts/tests/decouverte.test.mts");
copier("scripts/tests/securite.test.mts");
copier("src/lib/securite/ip.ts");
copier("scripts/tests/ip.test.mts");
copier("src/lib/decouverte/alternatives.ts");
copier("scripts/tests/alternatives.test.mts");
copier("src/lib/partage/liens.ts");
copier("scripts/tests/partage.test.mts");
copier("src/lib/design/tuile.ts");
copier("scripts/tests/tuile.test.mts");
copier("src/lib/alertes/commandes.ts");
copier("scripts/tests/alertes.test.mts");
copier("src/lib/push/vapid.ts");
copier("scripts/tests/push.test.mts");
copier("src/lib/restaurant/position.ts");
copier("src/lib/restaurant/paiement.ts");
copier("src/lib/parametres/assistance-format.ts");
copier("src/lib/parametres/promesse-defauts.ts");
copier("src/lib/client/profil.ts");
copier("src/lib/system-admin/pilotageCalculs.ts");
copier("src/lib/system-admin/comptesTest.ts");
copier("src/lib/commande/telephone.ts");
copier("src/lib/client/coordonnees.ts");
copier("src/lib/system-admin/reinitialisationRegles.ts");
copier("src/lib/illustrations/motifs.ts");
copier("src/lib/illustrations/modele.ts");
copier("src/lib/illustrations/automatique.ts");
copier("src/lib/illustrations/icones.generated.ts");
copier("scripts/tests/reglages.test.mts");
copier("src/lib/menu/ouverture.ts");
copier("scripts/tests/menujour.test.mts");
copier("src/lib/menu/saisieRapide.ts");
copier("scripts/tests/saisie.test.mts");
copier("src/lib/paiement/regles.ts");
copier("scripts/tests/paiement.test.mts");
copier("src/lib/paiement/documents-regles.ts");
copier("src/lib/partage/scans.ts");
copier("src/lib/commande/mode.ts");
copier("scripts/tests/documents.test.mts");
copier("src/lib/cms/texte-riche.ts");
copier("scripts/tests/texteriche.test.mts");
copier("src/lib/cms/cache-regles.ts");
copier("scripts/tests/cache.test.mts");
copier("src/lib/cms/emplacements.ts");
copier("scripts/tests/emplacements.test.mts");
copier("src/lib/system-admin/permissions.ts");
copier("src/lib/system-admin/paliers.ts");
copier("scripts/tests/paliers.test.mts");
copier("src/lib/system-admin/actionsAuditConnues.ts");
copier("scripts/tests/audit.test.mts");
copier("scripts/verifier-base-sql.ts");
copier("scripts/tests/verifierbase.test.mts");
copier("src/lib/illustrations/modele.ts");
copier("src/lib/studio/jetons.ts");
copier("scripts/tests/design.test.mts");
copier("src/lib/studio/reglages.ts");
copier("src/lib/studio/registre.ts");
copier("src/lib/studio/image-champ.ts");
copier("scripts/tests/studio.test.mts");
copier("scripts/tests/blocs.test.mts");
copier("src/lib/studio/apres-ecriture.ts");
copier("scripts/tests/apresecriture.test.mts");
copier("src/lib/studio/editeur-donnees.ts");
copier("src/lib/studio/possibilites.ts");
copier("src/lib/studio/panneau-blocs.ts");
copier("src/lib/studio/francisation.ts");
copier("src/lib/studio/concurrence.ts");
copier("src/lib/studio/accueil.ts");
copier("scripts/tests/accueil.test.mts");
copier("scripts/tests/editeur.test.mts");
copier("src/lib/commande/reprise.ts");
copier("scripts/tests/reprise.test.mts");
copier("src/lib/menu/chefMenu.ts");
copier("scripts/tests/chefia.test.mts");
copier("src/lib/panier/complements.ts");
copier("scripts/tests/complements.test.mts");

let statut = 0;
for (const fichier of ["decouverte", "securite", "ip", "alternatives", "partage", "tuile", "alertes", "push", "reglages", "menujour", "saisie", "paiement", "documents", "texteriche", "cache", "emplacements", "paliers", "audit", "verifierbase", "studio", "blocs", "apresecriture", "editeur", "accueil", "design", "reprise", "chefia", "complements"]) {
  const resultat = spawnSync(process.execPath, [join(tmp, `scripts/tests/${fichier}.test.mts`)], { stdio: "inherit", env: { ...process.env, SPEEDFOOD_RACINE: racine } });
  statut = statut || (resultat.status ?? 1);
}
rmSync(tmp, { recursive: true, force: true });
process.exit(statut);
