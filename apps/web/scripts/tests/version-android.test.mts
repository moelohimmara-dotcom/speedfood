import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applicationRecommandee } from "../../src/lib/application/installer-mobile";
import { VERSION_APPLICATION } from "../../src/lib/application/version";

/**
 * Version Android annoncée (28/11/2026) : l'accueil affichait l'ancienne appli (2.47.0, 16 Mo) pendant que /installer présentait la nouvelle (3.1.22, 66 Mo)
 * comme principale. Une seule source, `applicationRecommandee`, sert désormais les deux pages.
 */
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const app = applicationRecommandee();
const m = VERSION_APPLICATION.mobile;
verifier("la recommandée est la nouvelle appli publiée", [app.nouvelle, app.nom, app.chemin], [true, m?.nom, "/speedfood-mobile.apk"]);
verifier("taille de la recommandée = taille du fichier publié", app.tailleMo, Math.round((m?.apkTaille ?? 0) / 1_000_000));
const sansMobile = applicationRecommandee({ ...VERSION_APPLICATION, mobile: undefined });
verifier("sans nouvelle appli publiée : l'ancienne est recommandée", [sansMobile.nouvelle, sansMobile.nom, sansMobile.chemin], [false, VERSION_APPLICATION.nom, "/speedfood.apk"]);

const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
const lire = (chemin: string) => readFileSync(join(racine, chemin), "utf8");
const accueil = lire("src/components/accueil/AccueilApplication.tsx");
verifier("accueil : même source que /installer", /applicationRecommandee\(\)/.test(accueil) && !/VERSION_APPLICATION\.nom/.test(accueil), true);
verifier("accueil : bouton « Télécharger Speedfood pour Android »", /Télécharger Speedfood pour Android/.test(accueil), true);
const installer = lire("src/app/installer/page.tsx");
verifier("installer : l'ancienne appli regroupée sous « Vous utilisez l’ancienne application ? »", /Vous utilisez l’ancienne application \?/.test(installer), true);
verifier("installer : plus de promesse « elle la remplace » (deux applications distinctes)", /elle la remplace/.test(installer), false);
verifier("installer : le panier et les réglages ne sont pas promis à la migration", /ne sont pas transférés/.test(installer), true);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
console.log("\nTous les contrôles de la version Android passent.");
