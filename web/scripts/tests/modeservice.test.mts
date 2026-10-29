import { etatService, type EntreeService } from "../../src/lib/alertes/mode-service";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const base: EntreeService = { voulu: true, supporte: true, verrouActif: true, enLigne: true, visible: true };
const niveau = (e: Partial<EntreeService>) => etatService({ ...base, ...e }).niveau;

verifier("service : tout est réuni = actif", niveau({}), "actif");
verifier("service : non voulu = inactif", niveau({ voulu: false, verrouActif: false }), "inactif");
verifier("service : navigateur sans garde d'écran = non supporté, même si voulu", niveau({ supporte: false, verrouActif: false }), "non_supporte");
verifier("service : non supporté prime sur non voulu", niveau({ supporte: false, voulu: false }), "non_supporte");
verifier("service : plus de réseau = pause, jamais actif", niveau({ enLigne: false }), "pause");
verifier("service : garde retirée, onglet visible = pause (jamais actif)", niveau({ verrouActif: false }), "pause");
verifier("service : garde retirée, onglet caché = pause", niveau({ verrouActif: false, visible: false }), "pause");
verifier(
  "service : le message d'un onglet caché promet la reprise",
  etatService({ ...base, verrouActif: false, visible: false }).message.includes("dès que vous revenez"),
  true
);
verifier(
  "service : le message de garde refusée parle de batterie",
  etatService({ ...base, verrouActif: false }).message.includes("batterie"),
  true
);
verifier("service : sans réseau, le message le dit même si la garde tient", etatService({ ...base, enLigne: false }).message.includes("pas de réseau"), true);
verifier("service : le message « actif » n'apparaît que dans l'état actif", etatService(base).message.startsWith("Service actif"), true);

if (ko > 0) process.exit(1);
