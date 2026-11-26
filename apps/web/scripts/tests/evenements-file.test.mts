import { cleEvenement, estAbandonne, prochaineTentative, DELAIS_REPRISE_SECONDES, ESSAIS_MAX } from "../../src/lib/push/evenements.ts";

let echecs = 0;
function verifier(nom: string, reel: unknown, attendu: unknown) {
  const ok = JSON.stringify(reel) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`${ok ? "OK  " : "ECHEC"} ${nom}${ok ? "" : ` : recu ${JSON.stringify(reel)}, attendu ${JSON.stringify(attendu)}`}`);
}

const depart = new Date("2026-11-22T10:00:00.000Z");
verifier("clé d'événement : commande et type, stable", cleEvenement("cmd-1", "commande_nouvelle"), "cmd-1:commande_nouvelle");
verifier("clé d'événement : deux commandes différentes ne se confondent pas", cleEvenement("cmd-1", "commande_nouvelle") !== cleEvenement("cmd-2", "commande_nouvelle"), true);
verifier("premier délai : 1 minute", prochaineTentative(0, depart).toISOString(), "2026-11-22T10:01:00.000Z");
verifier("deuxième délai : 5 minutes", prochaineTentative(1, depart).toISOString(), "2026-11-22T10:05:00.000Z");
verifier("délais plafonnés au dernier palier", prochaineTentative(99, depart).toISOString(), new Date(depart.getTime() + DELAIS_REPRISE_SECONDES.at(-1)! * 1000).toISOString());
verifier("abandon seulement au plafond d'essais", [estAbandonne(ESSAIS_MAX - 1), estAbandonne(ESSAIS_MAX)], [false, true]);

console.log(echecs === 0 ? "\nÉVÉNEMENTS FILE : tous les contrôles passent." : `\n${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
