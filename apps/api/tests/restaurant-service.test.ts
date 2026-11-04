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
    fraicheurDisponibiliteHeures: async () => 6,
    lireReglages: async () => { throw new Error("hors sujet"); },
    ecrireStatut: async () => { throw new Error("hors sujet"); },
    ecrireReglages: async () => { throw new Error("hors sujet"); },
    lireMenu: async () => { throw new Error("hors sujet"); },
    basculerDisponibilite: async () => { throw new Error("hors sujet"); },
    confirmerDisponibilite: async () => { throw new Error("hors sujet"); },
    confirmerToutesDisponibilites: async () => { throw new Error("hors sujet"); },
    creerPlat: async () => { throw new Error("hors sujet"); },
    modifierPlat: async () => { throw new Error("hors sujet"); },
    archiverPlat: async () => { throw new Error("hors sujet"); },
    ajouterOption: async () => { throw new Error("hors sujet"); },
    retirerOption: async () => { throw new Error("hors sujet"); },
    definirPhoto: async () => { throw new Error("hors sujet"); },
    retirerPhoto: async () => { throw new Error("hors sujet"); },
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

// ---------- lot D4a : statut, réglages, menu ----------
test("D4a service : statut, réglages et menu reçoivent le client du JETON et le restaurant de l'appartenance (jamais l'administrateur)", async () => {
  const recus: Array<{ appel: string; client: unknown; restaurantId: string }> = [];
  const { service } = monter({
    fraicheurDisponibiliteHeures: async () => 9,
    lireReglages: async (client, restaurantId, fraicheur) => { recus.push({ appel: "lireReglages:" + fraicheur, client, restaurantId }); return { ok: true, horaires: "", ouvert: true, accepteCommandes: true, delaiPreparationMinutes: null, platsAReconfirmer: [] }; },
    ecrireStatut: async (client, restaurantId, demande) => { recus.push({ appel: `statut:${demande.champ}:${demande.valeur}`, client, restaurantId }); return true; },
    ecrireReglages: async (client, restaurantId, valeurs) => { recus.push({ appel: "reglages:" + Object.keys(valeurs).join(","), client, restaurantId }); return true; },
    lireMenu: async (client, restaurantId) => { recus.push({ appel: "menu", client, restaurantId }); return { sections: [], plats: [] }; },
    basculerDisponibilite: async (client, restaurantId, platId, disponible) => { recus.push({ appel: `dispo:${platId}:${disponible}`, client, restaurantId }); return { ok: true }; },
    confirmerDisponibilite: async (client, restaurantId, platId) => { recus.push({ appel: "confirmer:" + platId, client, restaurantId }); return { ok: true }; },
    confirmerToutesDisponibilites: async (client, restaurantId) => { recus.push({ appel: "confirmer_tout", client, restaurantId }); return { ok: true }; },
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  assert.deepEqual(await service.modifierStatut(ctx, { champ: "ouvert", valeur: false }), { ok: true });
  assert.deepEqual(await service.modifierStatut(ctx, { champ: "accepte_commandes", valeur: true }), { ok: true });
  assert.deepEqual(await service.lireReglages(ctx), { ok: true, valeur: { ok: true, horaires: "", ouvert: true, accepteCommandes: true, delaiPreparationMinutes: null, platsAReconfirmer: [] } });
  assert.deepEqual(await service.enregistrerReglages(ctx, { horaires: "8h", delaiPreparationMinutes: 20 }), { ok: true });
  assert.deepEqual(await service.lireMenu(ctx), { ok: true, valeur: { ok: true, sections: [], plats: [] } });
  const PLAT = "44444444-4444-4444-8444-444444444444";
  assert.deepEqual(await service.actionMenu(ctx, { action: "disponibilite", platId: PLAT, disponible: false }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "confirmer", platId: PLAT }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "confirmer_tout" }), { ok: true });
  assert.deepEqual(recus.map((r) => r.appel), ["statut:ouvert:false", "statut:accepte_commandes:true", "lireReglages:9", "reglages:horaires,delaiPreparationMinutes", "menu", `dispo:${PLAT}:false`, `confirmer:${PLAT}`, "confirmer_tout"]);
  for (const r of recus) {
    assert.equal(r.client, CLIENT_JETON, r.appel + " : client lié au jeton");
    assert.notEqual(r.client, CLIENT_ADMIN);
    assert.equal(r.restaurantId, RESTAURANT_A, r.appel + " : restaurant de l'appartenance");
  }
});

test("D4a service : une écriture non confirmée par la base = ERREUR_SERVEUR (jamais { ok: true }) ; lecture en panne = ERREUR_SERVEUR sans détail", async () => {
  const { service } = monter({
    ecrireStatut: async () => false, ecrireReglages: async () => false,
    lireReglages: async () => { throw new Error("secret interne SQL"); }, lireMenu: async () => { throw new Error("secret interne SQL"); },
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  for (const r of [await service.modifierStatut(ctx, { champ: "ouvert", valeur: true }), await service.enregistrerReglages(ctx, { horaires: "x" }), await service.lireReglages(ctx), await service.lireMenu(ctx)]) {
    assert.equal(r.ok, false);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "ERREUR_SERVEUR");
    assert.ok(!JSON.stringify(r).includes("secret interne"));
  }
  const nul = monter({ lireReglages: async () => null });
  assert.equal((await nul.service.lireReglages(await nul.service.contexte(JETON_AAL1, "compte-1"))).ok, false);
});

test("D4a service : le refus d'un service du menu (plat introuvable ou d'un autre restaurant) devient VALIDATION avec son message", async () => {
  const { service } = monter({
    basculerDisponibilite: async () => ({ ok: false, message: "Plat introuvable." }),
    confirmerDisponibilite: async () => ({ ok: false, message: "Plat introuvable, ou retiré de la vente : remettez-le en vente avant de le confirmer." }),
    confirmerToutesDisponibilites: async () => ({ ok: false, message: "Impossible d'enregistrer le changement. Réessayez dans un instant." }),
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  const PLAT = "44444444-4444-4444-8444-444444444444";
  assert.deepEqual(await service.actionMenu(ctx, { action: "disponibilite", platId: PLAT, disponible: true }), { ok: false, erreur: { code: "VALIDATION", message: "Plat introuvable." } });
  assert.equal(((await service.actionMenu(ctx, { action: "confirmer", platId: PLAT })) as { erreur: { code: string } }).erreur.code, "VALIDATION");
  assert.equal(((await service.actionMenu(ctx, { action: "confirmer_tout" })) as { erreur: { code: string } }).erreur.code, "VALIDATION");
});

test("D4a service : le statut n'appelle aucun service du menu et inversement (aucun croisement entre les deux interrupteurs ni entre les actions)", async () => {
  const appels: string[] = [];
  const { service } = monter({
    ecrireStatut: async (_c, _r, d) => { appels.push("statut:" + d.champ); return true; },
    basculerDisponibilite: async () => { appels.push("dispo"); return { ok: true }; },
    confirmerDisponibilite: async () => { appels.push("confirmer"); return { ok: true }; },
    confirmerToutesDisponibilites: async () => { appels.push("tout"); return { ok: true }; },
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  const PLAT = "44444444-4444-4444-8444-444444444444";
  await service.actionMenu(ctx, { action: "confirmer", platId: PLAT });
  await service.actionMenu(ctx, { action: "confirmer_tout" });
  await service.actionMenu(ctx, { action: "disponibilite", platId: PLAT, disponible: true });
  await service.modifierStatut(ctx, { champ: "accepte_commandes", valeur: false });
  assert.deepEqual(appels, ["confirmer", "tout", "dispo", "statut:accepte_commandes"]);
});

// ---------- lot D4b : créer, modifier, archiver un plat, ajouter et retirer un supplément ----------
const PLAT_D4B = "44444444-4444-4444-8444-444444444444";
const OPTION_D4B = "77777777-7777-4777-8777-777777777777";
const SECTION_D4B = "55555555-5555-4555-8555-555555555555";
const PLAT_ECRIT = { nom: "Poulet braisé", description: "Avec des frites", prix: 45000, prixPromo: null, sectionId: SECTION_D4B };

test("D4b service : les cinq actions d'écriture reçoivent le client du JETON et le restaurant de l'appartenance, et les valeurs exactes (jamais l'administrateur)", async () => {
  const recus: Array<{ appel: string; client: unknown; restaurantId: string; valeurs: unknown }> = [];
  const { service } = monter({
    creerPlat: async (client, restaurantId, plat) => { recus.push({ appel: "creer", client, restaurantId, valeurs: plat }); return { ok: true }; },
    modifierPlat: async (client, restaurantId, platId, plat) => { recus.push({ appel: "modifier:" + platId, client, restaurantId, valeurs: plat }); return { ok: true }; },
    archiverPlat: async (client, restaurantId, platId) => { recus.push({ appel: "archiver:" + platId, client, restaurantId, valeurs: null }); return { ok: true }; },
    ajouterOption: async (client, restaurantId, platId, option) => { recus.push({ appel: "option_ajouter:" + platId, client, restaurantId, valeurs: option }); return { ok: true }; },
    retirerOption: async (client, restaurantId, optionId) => { recus.push({ appel: "option_retirer:" + optionId, client, restaurantId, valeurs: null }); return { ok: true }; },
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  assert.deepEqual(await service.actionMenu(ctx, { action: "creer", plat: PLAT_ECRIT }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "modifier", platId: PLAT_D4B, plat: PLAT_ECRIT }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "archiver", platId: PLAT_D4B }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "option_ajouter", platId: PLAT_D4B, option: { nom: "Sauce piquante", prix: 2000 } }), { ok: true });
  assert.deepEqual(await service.actionMenu(ctx, { action: "option_retirer", optionId: OPTION_D4B }), { ok: true });
  assert.deepEqual(recus.map((r) => r.appel), ["creer", "modifier:" + PLAT_D4B, "archiver:" + PLAT_D4B, "option_ajouter:" + PLAT_D4B, "option_retirer:" + OPTION_D4B]);
  assert.deepEqual(recus[0].valeurs, PLAT_ECRIT);
  assert.deepEqual(recus[3].valeurs, { nom: "Sauce piquante", prix: 2000 });
  for (const r of recus) {
    assert.equal(r.client, CLIENT_JETON, r.appel + " : client lié au jeton");
    assert.notEqual(r.client, CLIENT_ADMIN);
    assert.equal(r.restaurantId, RESTAURANT_A, r.appel + " : restaurant de l'appartenance");
  }
});

test("D4b service : `creer` n'appelle jamais `modifier` et inversement (aucune confusion entre les cinq écritures)", async () => {
  const appels: string[] = [];
  const { service } = monter({
    creerPlat: async () => { appels.push("creer"); return { ok: true }; },
    modifierPlat: async () => { appels.push("modifier"); return { ok: true }; },
    archiverPlat: async () => { appels.push("archiver"); return { ok: true }; },
    ajouterOption: async () => { appels.push("option_ajouter"); return { ok: true }; },
    retirerOption: async () => { appels.push("option_retirer"); return { ok: true }; },
  });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  await service.actionMenu(ctx, { action: "modifier", platId: PLAT_D4B, plat: PLAT_ECRIT });
  await service.actionMenu(ctx, { action: "creer", plat: PLAT_ECRIT });
  await service.actionMenu(ctx, { action: "option_retirer", optionId: OPTION_D4B });
  await service.actionMenu(ctx, { action: "option_ajouter", platId: PLAT_D4B, option: { nom: "x", prix: 1 } });
  await service.actionMenu(ctx, { action: "archiver", platId: PLAT_D4B });
  assert.deepEqual(appels, ["modifier", "creer", "option_retirer", "option_ajouter", "archiver"]);
});

test("D4b service : le refus d'un service d'écriture devient VALIDATION avec son message (plat ou supplément introuvable, d'un autre restaurant)", async () => {
  const introuvable = async () => ({ ok: false as const, message: "Plat introuvable." });
  const { service } = monter({ creerPlat: introuvable, modifierPlat: introuvable, archiverPlat: introuvable, ajouterOption: introuvable, retirerOption: async () => ({ ok: false, message: "Supplément introuvable." }) });
  const ctx = await service.contexte(JETON_AAL1, "compte-1");
  const actions = [{ action: "creer", plat: PLAT_ECRIT }, { action: "modifier", platId: PLAT_D4B, plat: PLAT_ECRIT }, { action: "archiver", platId: PLAT_D4B },
    { action: "option_ajouter", platId: PLAT_D4B, option: { nom: "x", prix: 1 } }, { action: "option_retirer", optionId: OPTION_D4B }] as const;
  for (const action of actions) {
    const r = await service.actionMenu(ctx, action);
    assert.equal(r.ok, false, action.action);
    assert.equal((r as { erreur: { code: string } }).erreur.code, "VALIDATION", action.action);
  }
});
