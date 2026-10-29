import assert from "node:assert/strict";
import { estGraviteIncident, estResolutionIncident, estStatutIncident, estTypeIncident, validerMotifIncident, validerResolution } from "../../src/lib/system-admin/incidents-regles";
assert.equal(estTypeIncident("retard"), true); assert.equal(estTypeIncident("remboursement"), false); assert.equal(estGraviteIncident("critique"), true); assert.equal(estStatutIncident("en_cours"), true); assert.equal(estResolutionIncident("relivraison"), true);
assert.equal(validerMotifIncident("  colis introuvable  "), "colis introuvable"); assert.throws(() => validerMotifIncident("non"), /5 caractères/);
assert.throws(() => validerResolution("clos", null, null), /résolution/i); assert.doesNotThrow(() => validerResolution("clos", "avoir", "Avoir manuel à traiter")); assert.doesNotThrow(() => validerResolution("en_cours", null, null));
console.log("incidents.test.mts : 9 contrôles réussis");
