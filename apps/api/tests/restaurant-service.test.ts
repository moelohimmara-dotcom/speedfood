import { test } from "node:test";
import assert from "node:assert/strict";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { creerServiceRestaurant, niveauDuJeton, type DepsServiceRestaurant } from "../src/restaurant/service.ts";

/**
 * Le service restaurateur de l'API (`restaurant/service.ts`) avec des doublures qui enregistrent à QUEL client chaque service du site est appelé.
 * Garantie visée : la lecture et l'écriture des commandes reçoivent TOUJOURS le client lié au jeton du membre, jamais le client administrateur.
 */
const CLIENT_JETON = { client: "jeton" };
const CLIENT_ADMIN = { client: "admin" };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const COMMANDE = "33333333-3333-4333-8333-333333333333";

function jwt(charge: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "ES256" })}.${b64(charge)}.signature123`;
}
const JETON_AAL1 = jwt({ sub: "compte-1", aal: "aal1" });
const JETON_AAL2 = jwt({ sub: "compte-1", aal: "aal2" });

interface Journal { appels: string[]; clientsCommandes: unknown[]; traitements: Array<{ utilisateurId: string; restaurantId: string; commandeId: string; action: string }>; paiements: Array<{ restaurantId: string; commandeId: string; decision: string }>; propositions: Array<{ restaurantId: string; commandeId: string; valeurs: unknown }> }

function monter(surcharge: Partial<DepsServiceRestaurant> = {}) {
  const journal: Journal = { appels: [], clientsCommandes: [], traitements: [], paiements: [], propositions: [] };
  const service = creerServiceRestaurant({
    limiter: async (id) => { journal.appels.push(`limiter:${id}`); },
    clientJeton: (jeton) => { journal.appels.push(`clientJeton:${jeton === JETON_AAL2 || jeton === JETON_AAL1}`); return CLIENT_JETON; },
    clientAdmin: () => CLIENT_ADMIN,
    aSecondFacteurConfirme: async (admin, id) => { journal.appels.push(`mfa:${(admin as typeof CLIENT_ADMIN).client}:${id}`); return false; },
    questionsRequises: async (client) => { journal.appels.push(`questions:${(client as typeof CLIENT_JETON).client}`); return false; },
    appartenance: async (client, id) => { journal.appels.push(`appartenance:${(client as typeof CLIENT_JETON).client}:${id}`); return { restaurantId: RESTAURANT_A, role: "owner" }; },
    origineSite: async () => "https://site.exemple",
    lireCommandes: async (client, restaurantId, origine) => {
      journal.appels.push(`lire:${origine}`);
      journal.clientsCommandes.push(client);
      return { ok: true, restaurant: { id: restaurantId, nom: "Chez Fatou", ouvert: true, accepteCommandes: true }, commandes: [] };
    },
    traiterCommande: async (client, utilisateurId, restaurantId, commandeId, action) => {
      journal.appels.push("traiter");
      journal.clientsCommandes.push(client);
      journal.traitements.push({ utilisateurId, restaurantId, commandeId, action });
      return { ok: true };
    },
    confirmerPaiement: async (client, restaurantId, commandeId, decision) => {
      journal.appels.push("paiement");
      journal.clientsCommandes.push(client);
      journal.paiements.push({ restaurantId, commandeId, decision });
      return { ok: true };
    },
    proposerRevision: async (client, restaurantId, commandeId, valeurs) => {
      journal.appels.push("proposition");
      journal.clientsCommandes.push(client);
      journal.propositions.push({ restaurantId, commandeId, valeurs });
      return { ok: true };
    },
    ...surcharge,
  });
  return { service, journal };
}

const refus = (promesse: Promise<unknown>) => promesse.then(() => assert.fail("un refus était attendu"), (e: unknown) => e as ErreurMetier);

test("service : compte membre sans second facteur : plafond d'abord, puis contrôles, puis restaurant = celui de l'appartenance", async () => {
  const { service, journal } = monter();
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  assert.deepEqual(ctx, { supabase: CLIENT_JETON, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" });
  assert.equal(journal.appels[0], "limiter:compte-1", "le plafond par compte passe avant tout");
  assert.deepEqual(journal.appels, ["limiter:compte-1", "clientJeton:true", "mfa:admin:compte-1", "questions:jeton", "appartenance:jeton:compte-1"]);
});

test("service : plafond dépassé, refus avant toute autre lecture", async () => {
  const { service, journal } = monter({ limiter: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  const e = await refus(service.contexte(JETON_AAL1, "compte-1"));
  assert.equal(e.code, "TROP_DE_REQUETES");
  assert.deepEqual(journal.appels, []);
});

test("service : compte non membre : NON_AUTORISE « aucun restaurant »", async () => {
  const { service } = monter({ appartenance: async () => null });
  const e = await refus(service.contexte(JETON_AAL1, "compte-1"));
  assert.equal(e.code, "NON_AUTORISE");
  assert.match(e.message, /aucun restaurant/);
});

test("service : second facteur confirmé et jeton aal1 : refus avec champs.securite = mfa et le message pour le site ; les appartenances ne sont pas lues", async () => {
  for (const jeton of [JETON_AAL1, jwt({ sub: "x" }), "pas-un-jeton", jwt({ aal: 2 })]) {
    const { service, journal } = monter({ aSecondFacteurConfirme: async () => true });
    const e = await refus(service.contexte(jeton, "compte-1"));
    assert.equal(e.code, "NON_AUTORISE");
    assert.deepEqual(e.champs, { securite: "mfa" });
    assert.equal(e.message, "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.");
    assert.ok(!journal.appels.some((a) => a.startsWith("appartenance")));
  }
});

test("service : second facteur confirmé et jeton aal2 : accepté (la barrière n'est pas plus forte que celle du site)", async () => {
  const { service } = monter({ aSecondFacteurConfirme: async () => true });
  assert.equal((await service.contexte(JETON_AAL2, "compte-1")).restaurantId, RESTAURANT_A);
});

test("service : questions de sécurité requises : refus avec champs.securite = questions ; appartenance non lue", async () => {
  const { service, journal } = monter({ questionsRequises: async () => true });
  const e = await refus(service.contexte(JETON_AAL1, "compte-1"));
  assert.equal(e.code, "NON_AUTORISE");
  assert.deepEqual(e.champs, { securite: "questions" });
  assert.ok(!journal.appels.some((a) => a.startsWith("appartenance")));
});

test("service : niveauDuJeton lit « aal » dans la charge, null pour tout jeton illisible", () => {
  assert.equal(niveauDuJeton(JETON_AAL2), "aal2");
  assert.equal(niveauDuJeton(JETON_AAL1), "aal1");
  for (const jeton of ["", "a", "a.b.c", "a.!!!.c", jwt({ aal: 2 })]) assert.equal(niveauDuJeton(jeton), null, jeton);
});

test("service : le CLIENT LIÉ AU JETON (jamais l'administrateur) est le client du contexte, de la lecture et de l'écriture des commandes", async () => {
  const { service, journal } = monter();
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  assert.equal(ctx.supabase, CLIENT_JETON);
  assert.notEqual(ctx.supabase, CLIENT_ADMIN);
  await service.lister(ctx);
  await service.traiter(ctx, COMMANDE, "accepter");
  await service.confirmerPaiement(ctx, COMMANDE, "recu");
  await service.proposer(ctx, COMMANDE, { nouveauSousTotal: 1000, nouveauxFraisLivraison: 0, conditionsModifiees: null });
  assert.equal(journal.clientsCommandes.length, 4);
  for (const client of journal.clientsCommandes) {
    assert.equal(client, CLIENT_JETON);
    assert.notEqual(client, CLIENT_ADMIN);
  }
});

test("service : la lecture reçoit l'origine du SITE (liens du reçu) et le restaurant de l'appartenance", async () => {
  const { service, journal } = monter();
  const lecture = await service.lister(await service.contexte(JETON_AAL1, "compte-1"));
  assert.equal(lecture.restaurant?.id, RESTAURANT_A);
  assert.ok(journal.appels.includes("lire:https://site.exemple"));
});

test("service : traiter transmet l'identité du compte et le restaurant du contexte, avec l'action demandée", async () => {
  const { service, journal } = monter();
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  for (const action of ["accepter", "refuser", "prete", "terminee", "annuler"] as const) await service.traiter(ctx, COMMANDE, action);
  assert.deepEqual(journal.traitements, [
    { utilisateurId: "compte-1", restaurantId: RESTAURANT_A, commandeId: COMMANDE, action: "accepter" },
    { utilisateurId: "compte-1", restaurantId: RESTAURANT_A, commandeId: COMMANDE, action: "refuser" },
    { utilisateurId: "compte-1", restaurantId: RESTAURANT_A, commandeId: COMMANDE, action: "prete" },
    { utilisateurId: "compte-1", restaurantId: RESTAURANT_A, commandeId: COMMANDE, action: "terminee" },
    { utilisateurId: "compte-1", restaurantId: RESTAURANT_A, commandeId: COMMANDE, action: "annuler" },
  ]);
});

test("service D2 : confirmerPaiement transmet le client du jeton et le restaurant du CONTEXTE (appartenance), jamais l'administrateur", async () => {
  const { service, journal } = monter();
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  for (const decision of ["recu", "non_recu"] as const) await service.confirmerPaiement(ctx, COMMANDE, decision);
  assert.deepEqual(journal.paiements, [
    { restaurantId: RESTAURANT_A, commandeId: COMMANDE, decision: "recu" },
    { restaurantId: RESTAURANT_A, commandeId: COMMANDE, decision: "non_recu" },
  ]);
  for (const client of journal.clientsCommandes) assert.equal(client, CLIENT_JETON);
});

test("service D3 : proposer transmet le client du jeton, le restaurant du CONTEXTE (appartenance) et les valeurs telles quelles, jamais l'administrateur", async () => {
  const { service, journal } = monter();
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  const valeurs = { nouveauSousTotal: 25000, nouveauxFraisLivraison: 5000, conditionsModifiees: "Un plat est remplacé." };
  assert.deepEqual(await service.proposer(ctx, COMMANDE, valeurs), { ok: true });
  assert.deepEqual(journal.propositions, [{ restaurantId: RESTAURANT_A, commandeId: COMMANDE, valeurs }]);
  assert.deepEqual(journal.clientsCommandes, [CLIENT_JETON]);
  assert.notEqual(journal.clientsCommandes[0], CLIENT_ADMIN);
});
