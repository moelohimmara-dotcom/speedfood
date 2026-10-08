import fs from "node:fs";
import path from "node:path";
import { ACTIONS_AUDIT_CONNUES, LIBELLES_ACTIONS_AUDIT, libelleActionAudit } from "../../src/lib/system-admin/actionsAuditConnues";

/**
 * Catalogue d'audit : le filtre du journal d'audit (`ACTIONS_AUDIT_CONNUES`) et ses libellés
 * (`LIBELLES_ACTIONS_AUDIT`) doivent rester synchrone, sans entrée orpheline dans un sens comme
 * dans l'autre — une action oubliée n'apparaît jamais dans le filtre, un libellé orphelin n'est
 * jamais atteint.
 */
let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// `Object.keys` donne `string[]` alors que `.includes()` du tableau littéral exige l'union fermée :
// un `Set<string>` rend les deux compatibles sans forcer le typage.
const connues = new Set<string>(ACTIONS_AUDIT_CONNUES);

verifier(
  "chaque action connue a un libellé",
  ACTIONS_AUDIT_CONNUES.filter((a) => !(a in LIBELLES_ACTIONS_AUDIT)),
  []
);
verifier(
  "aucun libellé orphelin",
  Object.keys(LIBELLES_ACTIONS_AUDIT).filter((a) => !connues.has(a)),
  []
);
verifier("liste sans doublon", ACTIONS_AUDIT_CONNUES.length, new Set(ACTIONS_AUDIT_CONNUES).size);

// La suppression de page (8 octobre 2026) doit être filtrable et libellée comme les autres.
verifier(
  "suppression de page : action et libellé présents",
  [ACTIONS_AUDIT_CONNUES.includes("contenu.page_suppression"), libelleActionAudit("contenu.page_suppression")],
  [true, "Page supprimée"]
);
// Le repli du libellé reste l'identifiant brut (jamais `undefined`).
verifier("libellé d'une action inconnue", libelleActionAudit("inconnue.quelquechose"), "inconnue.quelquechose");

// Second axe : une action littérale journalisée dans le code mais absente des DEUX listes passe
// inaperçue au test ci-dessus (les deux listes restent cohérentes entre elles). On relit donc le
// source. Exigence d'un point : `action: "insert"` et consorts sont d'autres domaines (Puck),
// pas des actions d'audit. Un identifiant écrit en base (SQL) n'est pas couvert ici — il doit
// alors avoir un libellé, ce que le test « chaque action connue a un libellé » surveille avec son
// miroir « aucun libellé orphelin ».
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const actionsDuCode = new Set<string>();
const parcourir = (dossier: string) => {
  for (const nom of fs.readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (fs.statSync(chemin).isDirectory()) {
      if (nom !== "node_modules" && !nom.startsWith(".")) parcourir(chemin);
    } else if (/\.(ts|tsx)$/.test(nom)) {
      for (const m of fs.readFileSync(chemin, "utf8").matchAll(/action:\s*"([a-z_]+\.[a-z_]+)"/g)) {
        actionsDuCode.add(m[1]);
      }
    }
  }
};
parcourir(path.join(racine, "src"));
verifier("action journalisée mais absente du filtre", [...actionsDuCode].filter((a) => !connues.has(a)).sort(), []);

console.log(`\n${total - ko}/${total} tests audit passent.`);
if (ko > 0) process.exit(1);
