import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Le service commun de déclaration du règlement (`apps/web/src/lib/commande/declaration-paiement.ts`), exécuté pour de vrai : c'est lui, et non la route ni l'action
 * du site, qui porte tous les contrôles. Seuls ses accès à la base, au suivi et au plafond sont remplacés par de faux modules ; le jeton, les règles de paiement
 * (`regles.ts`) et le contrat d'erreur sont les vrais. Aucune base, aucun réseau, aucun secret.
 */

const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE = join(racineApi, "..", "web", "src", "lib", "commande", "declaration-paiement.ts");

interface Faux {
  appels: string[];
  limiter(ErreurMetier: new (code: string, message: string) => Error): Promise<void>;
  suivi(jeton: string): Promise<unknown>;
  /** Reçoit la mise à jour et les filtres ; renvoie le résultat de la base. */
  ecrire(maj: Record<string, unknown>, filtres: unknown[]): { data: unknown; error: unknown };
}
const g = globalThis as unknown as { __fauxPaiement: Faux };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/securite/limitation-debit": `import { ErreurMetier } from "@/lib/contracts/erreurs";
    export async function limiterDeclarationPaiement() { globalThis.__fauxPaiement.appels.push("limiter"); return globalThis.__fauxPaiement.limiter(ErreurMetier); }`,
  "./requetes": `export async function chargerSuiviParJeton(j) { globalThis.__fauxPaiement.appels.push("charger"); return globalThis.__fauxPaiement.suivi(j); }`,
  "@/lib/db/admin": `export function creerClientAdmin() {
    return { from(table) {
      const etat = { table, maj: null, filtres: [] };
      const chaine = {
        update(m) { etat.maj = m; return chaine; },
        eq(c, v) { etat.filtres.push(["eq", c, v]); return chaine; },
        neq(c, v) { etat.filtres.push(["neq", c, v]); return chaine; },
        select() { globalThis.__fauxPaiement.appels.push("ecrire:" + etat.table); return Promise.resolve(globalThis.__fauxPaiement.ecrire(etat.maj, etat.filtres)); },
      };
      return chaine;
    } };
  }`,
};

const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Resultat = { ok: true } | { ok: false; erreur: { code: string; message: string } };
let declarerPaiement: (jeton: unknown, mode: unknown, reference: unknown) => Promise<Resultat>;
let dossier: string;

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-paiement-"));
  const sortie = join(dossier, "service.mjs");
  await build({ entryPoints: [SERVICE], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ declarerPaiement } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const JETON = "A".repeat(40);
const ENLIGNE_AUCUN = { disponible: false, simulation: false, etat: null, operateur: null, totalGnf: null };
const OPTIONS = [
  { mode: "orange_money", libelle: "Orange Money", code: "123456" },
  { mode: "mtn_momo", libelle: "MTN MoMo", code: "654321" },
  { mode: "especes", libelle: "Espèces", code: null },
];

function suiviAccepte(surcharge: Record<string, unknown> = {}, paiement: Record<string, unknown> = {}) {
  return { statut: "acceptee", propositionActive: null, paiement: { statut: "non_demande", mode: null, reference: null, declareLe: null, recuLe: null, options: OPTIONS, enLigne: ENLIGNE_AUCUN, ...paiement }, ...surcharge };
}

function preparer(suivi: unknown, ecrire: Faux["ecrire"] = () => ({ data: [{ id: "o1" }], error: null }), limiter: Faux["limiter"] = async () => {}) {
  const ecritures: Array<{ maj: Record<string, unknown>; filtres: unknown[] }> = [];
  g.__fauxPaiement = { appels: [], limiter, suivi: async () => suivi, ecrire: (maj, filtres) => { ecritures.push({ maj, filtres }); return ecrire(maj, filtres); } };
  return ecritures;
}

const refus = (code: string, message: string) => ({ ok: false, erreur: { code, message } });
const nettoye = (r: unknown) => JSON.parse(JSON.stringify(r));
const message = (r: Resultat) => (r as { erreur: { message: string } }).erreur.message;

test("paiement : mobile money déclaré, écriture du mode, du statut « declare », de la référence et de la date, filtrée sur le jeton et jamais sur « recu »", async () => {
  const ecritures = preparer(suiviAccepte());
  const r = await declarerPaiement(JETON, "orange_money", "  OM-123456 ");
  assert.deepEqual(r, { ok: true });
  assert.equal(ecritures.length, 1);
  const { maj, filtres } = ecritures[0];
  assert.equal(maj.paiement_mode, "orange_money");
  assert.equal(maj.paiement_statut, "declare");
  assert.equal(maj.paiement_reference, "OM-123456");
  assert.ok(typeof maj.paiement_declare_le === "string" && !Number.isNaN(Date.parse(maj.paiement_declare_le as string)));
  assert.deepEqual(Object.keys(maj).sort(), ["paiement_declare_le", "paiement_mode", "paiement_reference", "paiement_statut"], "aucun montant ni autre champ écrit");
  assert.deepEqual(filtres, [["eq", "jeton_suivi", JETON], ["neq", "paiement_statut", "recu"]]);
  assert.deepEqual(g.__fauxPaiement.appels, ["limiter", "charger", "ecrire:orders"]);
});

test("paiement : espèces REFUSÉES (VALIDATION, message clair), même si le restaurant les propose : ni plafond, ni lecture, ni écriture", async () => {
  const ecritures = preparer(suiviAccepte());
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "especes", "")), refus("VALIDATION", "Le paiement en espèces n'est pas pris en charge par Speedfood. Le paiement en ligne Chap Chap Pay arrive bientôt."));
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "especes", "REF-1234")).ok, false);
  assert.deepEqual(g.__fauxPaiement.appels, []);
  assert.equal(ecritures.length, 0, "aucune écriture espèces");
});

test("paiement : mobile money, statut « declare » écrit (jamais « especes »), référence enregistrée", async () => {
  const ecritures = preparer(suiviAccepte());
  assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", "REF-1234"), { ok: true });
  assert.equal(ecritures[0].maj.paiement_statut, "declare");
  assert.equal(ecritures[0].maj.paiement_reference, "REF-1234");
});

test("paiement : référence absente, nulle ou vide : acceptée, écrite à null", async () => {
  for (const reference of [undefined, null, "", "   "]) {
    const ecritures = preparer(suiviAccepte());
    assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", reference), { ok: true });
    assert.equal(ecritures[0].maj.paiement_reference, null);
  }
});

test("paiement : redéclarer (mode ou référence modifiés) tant que le restaurant n'a pas confirmé est accepté", async () => {
  for (const statut of ["declare", "especes", "non_recu"]) {
    const ecritures = preparer(suiviAccepte({}, { statut, mode: "orange_money", reference: "ANCIENNE-1" }));
    assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", "NOUVELLE-2"), { ok: true });
    assert.equal(ecritures[0].maj.paiement_reference, "NOUVELLE-2");
  }
});

test("paiement : jeton invalide ou non textuel : INTROUVABLE « Lien de suivi introuvable. », rien n'est appelé", async () => {
  for (const jeton of [undefined, null, 12, "court", "é".repeat(40), `${"A".repeat(39)} `]) {
    preparer(suiviAccepte());
    assert.deepEqual(nettoye(await declarerPaiement(jeton, "especes", "")), refus("INTROUVABLE", "Lien de suivi introuvable."));
    assert.deepEqual(g.__fauxPaiement.appels, []);
  }
});

test("paiement : mode hors de la liste (ou « speedfood », ou non textuel) : VALIDATION « Mode de paiement invalide. », rien n'est appelé", async () => {
  for (const mode of ["speedfood", "carte", "ESPECES", "", undefined, null, 1, ["especes"]]) {
    preparer(suiviAccepte());
    assert.deepEqual(nettoye(await declarerPaiement(JETON, mode, "")), refus("VALIDATION", "Mode de paiement invalide."));
    assert.deepEqual(g.__fauxPaiement.appels, []);
  }
});

test("paiement : référence mal formée (trop courte, trop longue, caractères spéciaux, non textuelle) : VALIDATION, rien n'est appelé", async () => {
  for (const reference of ["abc", "a".repeat(41), "OM<script>", "OM#1234", 123456, { a: 1 }, ["OM-1234"]]) {
    preparer(suiviAccepte());
    assert.deepEqual(nettoye(await declarerPaiement(JETON, "orange_money", reference)), refus("VALIDATION", "La référence contient 4 à 40 lettres, chiffres, points ou tirets."));
    assert.deepEqual(g.__fauxPaiement.appels, []);
  }
});

test("paiement : références aux bornes (4 et 40 caractères) acceptées", async () => {
  for (const reference of ["abcd", "a".repeat(40)]) {
    preparer(suiviAccepte());
    assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", reference), { ok: true });
  }
});

test("paiement : plafond atteint : refus rendu tel quel (TROP_DE_REQUETES), la commande n'est ni lue ni modifiée", async () => {
  const ecritures = preparer(suiviAccepte(), undefined, async (E) => { throw new E("TROP_DE_REQUETES", "Trop de demandes."); });
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("TROP_DE_REQUETES", "Trop de demandes."));
  assert.deepEqual(g.__fauxPaiement.appels, ["limiter"]);
  assert.equal(ecritures.length, 0);
});

test("paiement : commande introuvable pour ce jeton : INTROUVABLE, aucune écriture", async () => {
  const ecritures = preparer(null);
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("INTROUVABLE", "Lien de suivi introuvable."));
  assert.equal(ecritures.length, 0);
});

test("paiement : paiement non ouvert (en attente, refusée, annulée, expirée) : CONFLIT_ETAT, aucune écriture", async () => {
  for (const statut of ["en_attente", "refusee", "annulee", "expiree"]) {
    const ecritures = preparer(suiviAccepte({ statut }));
    assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("CONFLIT_ETAT", "Le paiement s'ouvre quand le restaurant a accepté la commande."), statut);
    assert.equal(ecritures.length, 0);
  }
});

test("paiement : acceptée mais avec une proposition de prix en cours : CONFLIT_ETAT, aucune écriture ; prête et terminée restent ouvertes", async () => {
  const ecritures = preparer(suiviAccepte({ propositionActive: { id: "p1" } }));
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("CONFLIT_ETAT", "Le paiement s'ouvre quand le restaurant a accepté la commande."));
  assert.equal(ecritures.length, 0);
  for (const statut of ["prete", "terminee"]) {
    preparer(suiviAccepte({ statut }));
    assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", ""), { ok: true });
  }
});

test("paiement : déjà confirmé par le restaurant (« recu ») : CONFLIT_ETAT « déjà confirmé », aucune écriture", async () => {
  const ecritures = preparer(suiviAccepte({}, { statut: "recu", mode: "especes" }));
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "orange_money", "OM-123456")), refus("CONFLIT_ETAT", "Le restaurant a déjà confirmé votre paiement."));
  assert.equal(ecritures.length, 0);
});

test("paiement : paiement en ligne ouvert ou abouti : CONFLIT_ETAT, aucune écriture ; échoué, expiré, annulé ou remboursé ne bloque pas", async () => {
  for (const etat of ["cree", "en_attente", "confirme", "libere", "en_litige"]) {
    const ecritures = preparer(suiviAccepte({}, { enLigne: { ...ENLIGNE_AUCUN, etat } }));
    assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("CONFLIT_ETAT", "Un paiement en ligne est déjà en cours pour cette commande."), etat);
    assert.equal(ecritures.length, 0);
  }
  for (const etat of ["echoue", "expire", "annule", "rembourse", null]) {
    preparer(suiviAccepte({}, { enLigne: { ...ENLIGNE_AUCUN, etat } }));
    assert.deepEqual(await declarerPaiement(JETON, "mtn_momo", ""), { ok: true }, String(etat));
  }
});

test("paiement : mode absent des options du restaurant : VALIDATION « n'accepte pas ce mode », aucune écriture", async () => {
  const ecritures = preparer(suiviAccepte({}, { options: [{ mode: "especes", libelle: "Espèces", code: null }] }));
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "orange_money", "OM-123456")), refus("VALIDATION", "Ce restaurant n'accepte pas ce mode de paiement."));
  assert.equal(ecritures.length, 0);
  preparer(suiviAccepte({}, { options: [] }));
  assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("VALIDATION", "Ce restaurant n'accepte pas ce mode de paiement."));
});

test("paiement : aucune ligne modifiée (confirmé entre-temps) ou erreur de base : CONFLIT_ETAT « n'a pas pu être enregistré »", async () => {
  for (const resultat of [{ data: [], error: null }, { data: null, error: null }, { data: [{ id: "o1" }], error: { message: "boom" } }]) {
    preparer(suiviAccepte(), () => resultat);
    assert.deepEqual(nettoye(await declarerPaiement(JETON, "mtn_momo", "")), refus("CONFLIT_ETAT", "Le paiement n'a pas pu être enregistré. Actualisez la page."));
  }
});

test("paiement : panne imprévue (lecture ou base) : ERREUR_SERVEUR générique, sans le message de l'exception", async () => {
  g.__fauxPaiement = { appels: [], limiter: async () => {}, suivi: async () => { throw new Error("secret interne " + JETON); }, ecrire: () => ({ data: [], error: null }) };
  const r = nettoye(await declarerPaiement(JETON, "mtn_momo", ""));
  assert.deepEqual(r, refus("ERREUR_SERVEUR", "Une erreur est survenue. Réessayez dans un instant."));
  assert.ok(!JSON.stringify(r).includes("secret interne"));
});

test("paiement : l'ordre des contrôles est celui du site : jeton, mode, référence, puis ouverture, confirmation, paiement en ligne", async () => {
  // Plusieurs fautes à la fois : la première dans l'ordre du site gagne.
  preparer(suiviAccepte({ statut: "en_attente" }));
  assert.equal(message(await declarerPaiement("court", "carte", "x")), "Lien de suivi introuvable.");
  assert.equal(message(await declarerPaiement(JETON, "carte", "x")), "Mode de paiement invalide.");
  assert.equal(message(await declarerPaiement(JETON, "mtn_momo", "x")), "La référence contient 4 à 40 lettres, chiffres, points ou tirets.");
  assert.equal(message(await declarerPaiement(JETON, "mtn_momo", "")), "Le paiement s'ouvre quand le restaurant a accepté la commande.");
  preparer(suiviAccepte({}, { statut: "recu", enLigne: { ...ENLIGNE_AUCUN, etat: "confirme" }, options: [] }));
  assert.equal(message(await declarerPaiement(JETON, "mtn_momo", "")), "Le restaurant a déjà confirmé votre paiement.");
  preparer(suiviAccepte({}, { enLigne: { ...ENLIGNE_AUCUN, etat: "confirme" }, options: [] }));
  assert.equal(message(await declarerPaiement(JETON, "mtn_momo", "")), "Un paiement en ligne est déjà en cours pour cette commande.");
});
