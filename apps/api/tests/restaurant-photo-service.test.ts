import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { definirPhotoPlat, retirerPhotoPlat, type StockageImages } from "../src/restaurant/photo.ts";
import { creerServiceRestaurant, type DepsServiceRestaurant } from "../src/restaurant/service.ts";
import type { ContexteRestaurant } from "../src/types.ts";

/**
 * Service de photo du lot D4c (`apps/api/src/restaurant/photo.ts`) : cloisonnement A/B, ordre « nouveau avant ancien », nettoyage d'orphelin, colonnes écrites, codes d'erreur conservés.
 * Le client de la base est un faux qui sert les lignes de `menu_items` et NOTE chaque écriture avec ses colonnes et ses filtres ; le stockage est un faux qui note ses appels dans le MÊME journal
 * (pour prouver l'ORDRE). Les contrôles du fichier du site (type, taille, signature, quota) sont prouvés avec le vrai `images.ts` dans `restaurant-photo-stockage.test.ts`.
 */
type Ligne = Record<string, unknown>;
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const PLAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAT_A_ARCHIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const PLAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INCONNU = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ANCIENNE = "https://ggldjdizqrtpetdiohxy.supabase.co/storage/v1/object/public/medias/plats/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
const NOUVELLE = "https://ggldjdizqrtpetdiohxy.supabase.co/storage/v1/object/public/medias/plats/22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
const FICHIER = new File([new Uint8Array([0xff, 0xd8, 0xff])], "plat.jpg", { type: "image/jpeg" });

interface Ecriture { valeurs: Ligne; filtres: Array<[string, string, unknown]> }
interface Options {
  /** Échec de l'écriture : « erreur » = refusée, « erreur_appliquee » = erreur renvoyée alors que la base l'a appliquée, « exception » = lève. */
  ecriture?: "erreur" | "erreur_appliquee" | "exception";
  /** Les lectures numéro N (à partir de 1) échouent. */
  lecturesEnPanne?: number[];
  /** Une autre session a archivé le plat entre la lecture et l'écriture : l'écriture ne touche aucune ligne. */
  archiveEntreTemps?: boolean;
}
function monter(options: Options = {}) {
  const journal: string[] = [];
  const ecritures: Ecriture[] = [];
  const lignes: Ligne[] = [
    { id: PLAT_A, restaurant_id: RESTAURANT_A, photo_url: ANCIENNE, archive_le: null },
    { id: PLAT_A_ARCHIVE, restaurant_id: RESTAURANT_A, photo_url: ANCIENNE, archive_le: "2026-10-01T00:00:00.000Z" },
    { id: PLAT_B, restaurant_id: RESTAURANT_B, photo_url: ANCIENNE, archive_le: null },
  ];
  let lecture = 0;
  const db = {
    from(table: string) {
      assert.equal(table, "menu_items", "seule la table des plats est touchée");
      const q: { op: "select" | "update"; valeurs: Ligne; filtres: Array<[string, string, unknown]> } = { op: "select", valeurs: {}, filtres: [] };
      const correspond = () => lignes.filter((r) => q.filtres.every(([op, c, v]) => (op === "eq" ? r[c] === v : (r[c] ?? null) === v)));
      const chaine: Record<string, unknown> = {
        select: () => chaine,
        eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
        is: (c: string, v: unknown) => { q.filtres.push(["is", c, v]); return chaine; },
        update: (v: Ligne) => { q.op = "update"; q.valeurs = v; return chaine; },
        maybeSingle: async () => {
          lecture++;
          journal.push("lecture");
          if (options.lecturesEnPanne?.includes(lecture)) return { data: null, error: { message: "panne" } };
          return { data: correspond()[0] ?? null, error: null };
        },
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => {
          assert.equal(q.op, "update", "une requête sans maybeSingle est une écriture");
          journal.push("ecriture");
          ecritures.push({ valeurs: q.valeurs, filtres: q.filtres });
          if (options.ecriture === "exception") throw new Error("réseau");
          const touchees = options.archiveEntreTemps ? [] : correspond();
          if (options.ecriture === "erreur") return { data: null, error: { message: "refusé" } };
          for (const l of touchees) Object.assign(l, q.valeurs);
          if (options.ecriture === "erreur_appliquee") return { data: null, error: { message: "réponse perdue" } };
          return { data: touchees.map((l) => ({ id: l.id })), error: null };
        }).then(ok, ko),
      };
      return chaine;
    },
  } as unknown as SupabaseClient;
  const stockage: StockageImages & { televersements: Array<{ dossier: string; restaurantId: string }>; orphelins: string[]; anciennes: Array<string | null> } = {
    televersements: [], orphelins: [], anciennes: [],
    async televerser(_fichier, dossier, restaurantId) { journal.push("televerser"); stockage.televersements.push({ dossier, restaurantId }); return NOUVELLE; },
    async supprimerOrphelin(url) { journal.push("orphelin"); stockage.orphelins.push(url); },
    async supprimerAncienne(url) { journal.push("ancienne"); stockage.anciennes.push(url); },
  };
  return { db, stockage, journal, ecritures, ligne: (id: string) => lignes.find((l) => l.id === id)! };
}
const refus = (r: { ok: boolean; erreur?: { code: string; message: string } }, code: string, message?: string) => {
  assert.equal(r.ok, false);
  assert.equal(r.erreur?.code, code);
  if (message !== undefined) assert.equal(r.erreur?.message, message);
};

// ---------- envoi ----------
test("D4c service : envoi valide : fichier enregistré, `photo_url` écrite (une seule colonne) sur le plat du restaurant non archivé, ancienne supprimée APRÈS", async () => {
  const e = monter();
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(e.stockage.televersements, [{ dossier: "plats", restaurantId: RESTAURANT_A }]);
  assert.equal(e.ecritures.length, 1);
  assert.deepEqual(Object.keys(e.ecritures[0].valeurs), ["photo_url"], "aucune autre colonne");
  assert.equal(e.ecritures[0].valeurs.photo_url, NOUVELLE);
  assert.deepEqual(e.ecritures[0].filtres, [["eq", "id", PLAT_A], ["eq", "restaurant_id", RESTAURANT_A], ["is", "archive_le", null]]);
  assert.equal(e.ligne(PLAT_A).photo_url, NOUVELLE);
  assert.deepEqual(e.stockage.anciennes, [ANCIENNE]);
});

test("D4c service : ORDRE : le nouveau fichier est enregistré et rattaché AVANT que l'ancien soit retiré", async () => {
  const e = monter();
  await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  assert.deepEqual(e.journal, ["lecture", "televerser", "ecriture", "ancienne"]);
});

test("D4c service : plat sans photo avant : l'ancienne n'est rien (null), l'envoi réussit", async () => {
  const e = monter();
  e.ligne(PLAT_A).photo_url = null;
  assert.deepEqual(await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage), { ok: true });
  assert.deepEqual(e.stockage.anciennes, [null]);
});

test("D4c service A/B : le plat d'un AUTRE restaurant est « inconnu » : aucun fichier envoyé, aucune écriture, aucune suppression", async () => {
  const e = monter();
  refus(await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_B, FICHIER, e.stockage) as never, "VALIDATION", "Plat inconnu.");
  assert.deepEqual(e.journal, ["lecture"]);
  assert.equal(e.ligne(PLAT_B).photo_url, ANCIENNE);
});

test("D4c service A/B : l'identifiant d'un plat n'est jamais une autorisation : le restaurant du CONTEXTE filtre la lecture ET l'écriture (le même plat est visible pour B, pas pour A)", async () => {
  const pourB = monter();
  assert.deepEqual(await definirPhotoPlat(pourB.db, RESTAURANT_B, PLAT_B, FICHIER, pourB.stockage), { ok: true });
  assert.deepEqual(pourB.stockage.televersements, [{ dossier: "plats", restaurantId: RESTAURANT_B }], "le quota et le dossier sont ceux du restaurant du contexte");
  assert.ok(pourB.ecritures[0].filtres.some(([, c, v]) => c === "restaurant_id" && v === RESTAURANT_B));
});

test("D4c service A/B : un plat ARCHIVÉ est refusé (aucun fichier envoyé, aucune écriture) ; un plat inexistant aussi", async () => {
  for (const id of [PLAT_A_ARCHIVE, INCONNU]) {
    const e = monter();
    refus(await definirPhotoPlat(e.db, RESTAURANT_A, id, FICHIER, e.stockage) as never, "VALIDATION", "Plat inconnu.");
    assert.deepEqual(e.journal, ["lecture"], id);
    assert.equal(e.ecritures.length, 0);
  }
});

test("D4c service : le refus du fichier par le stockage (signature, taille, type) garde son code et son message ; rien n'est écrit ni supprimé", async () => {
  for (const [code, message] of [["VALIDATION", "Le fichier n'est pas une image valide."], ["VALIDATION", "L'image ne peut pas dépasser 5 Mo."], ["TROP_DE_REQUETES", "Trop d'images envoyées. Réessayez plus tard."]] as const) {
    const e = monter();
    e.stockage.televerser = async () => { e.journal.push("televerser"); throw new ErreurMetier(code, message, { image: "x" }); };
    const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
    refus(r as never, code, message);
    assert.deepEqual(e.journal, ["lecture", "televerser"]);
    assert.equal(e.ecritures.length, 0);
    assert.equal(e.ligne(PLAT_A).photo_url, ANCIENNE);
  }
});

test("D4c service : une panne inattendue du stockage = ERREUR_SERVEUR sans détail interne ; rien n'est écrit", async () => {
  const e = monter();
  e.stockage.televerser = async () => { throw new Error("clé secrète du stockage"); };
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  refus(r as never, "ERREUR_SERVEUR");
  assert.ok(!JSON.stringify(r).includes("secrète"));
  assert.equal(e.ecritures.length, 0);
});

test("D4c service : écriture REFUSÉE = le nouveau fichier est supprimé (pas d'orphelin), l'ancien est gardé, ERREUR_SERVEUR", async () => {
  const e = monter({ ecriture: "erreur" });
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  refus(r as never, "ERREUR_SERVEUR");
  assert.deepEqual(e.stockage.orphelins, [NOUVELLE]);
  assert.deepEqual(e.stockage.anciennes, [], "l'ancienne photo n'est pas retirée si la nouvelle n'est pas rattachée");
  assert.equal(e.ligne(PLAT_A).photo_url, ANCIENNE);
  assert.deepEqual(e.journal, ["lecture", "televerser", "ecriture", "lecture", "orphelin"]);
});

test("D4c service : écriture qui n'atteint AUCUNE ligne (plat archivé entre-temps) : jamais « ok » ; le nouveau fichier est supprimé, l'ancien gardé", async () => {
  const e = monter({ archiveEntreTemps: true });
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  refus(r as never, "VALIDATION", "Plat inconnu.");
  assert.deepEqual(e.stockage.orphelins, [NOUVELLE]);
  assert.deepEqual(e.stockage.anciennes, []);
});

test("D4c service : écriture en ERREUR mais appliquée par la base (réponse perdue) : la relecture le voit, le fichier est CONSERVÉ, l'ancien est retiré, succès", async () => {
  const e = monter({ ecriture: "erreur_appliquee" });
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(e.stockage.orphelins, [], "jamais supprimer un fichier que le plat référence");
  assert.deepEqual(e.stockage.anciennes, [ANCIENNE]);
});

test("D4c service : écriture en exception ET relecture impossible : état inconnu, on ne supprime RIEN (ni nouveau ni ancien)", async () => {
  const e = monter({ ecriture: "exception", lecturesEnPanne: [2] });
  const r = await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage);
  refus(r as never, "ERREUR_SERVEUR");
  assert.deepEqual(e.stockage.orphelins, []);
  assert.deepEqual(e.stockage.anciennes, []);
});

test("D4c service : lecture du plat en panne = ERREUR_SERVEUR, aucun fichier envoyé", async () => {
  const e = monter({ lecturesEnPanne: [1] });
  refus(await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage) as never, "ERREUR_SERVEUR");
  assert.deepEqual(e.journal, ["lecture"]);
});

test("D4c service : la suppression de l'ancienne image qui échoue ne change jamais le résultat (best-effort)", async () => {
  const e = monter();
  e.stockage.supprimerAncienne = async () => { throw new Error("suppression impossible"); };
  assert.deepEqual(await definirPhotoPlat(e.db, RESTAURANT_A, PLAT_A, FICHIER, e.stockage), { ok: true });
  assert.equal(e.ligne(PLAT_A).photo_url, NOUVELLE);
});

// ---------- retrait ----------
test("D4c service : retrait : `photo_url` passe à null (une seule colonne, plat et restaurant filtrés), le plat n'est ni supprimé ni archivé, l'ancien fichier est retiré APRÈS", async () => {
  const e = monter();
  assert.deepEqual(await retirerPhotoPlat(e.db, RESTAURANT_A, PLAT_A, e.stockage), { ok: true });
  assert.deepEqual(e.ecritures.map((x) => x.valeurs), [{ photo_url: null }]);
  assert.deepEqual(e.ecritures[0].filtres, [["eq", "id", PLAT_A], ["eq", "restaurant_id", RESTAURANT_A], ["is", "archive_le", null]]);
  assert.equal(e.ligne(PLAT_A).archive_le, null);
  assert.deepEqual(e.journal, ["lecture", "ecriture", "ancienne"]);
  assert.deepEqual(e.stockage.anciennes, [ANCIENNE]);
  assert.deepEqual(e.stockage.televersements, [], "un retrait n'envoie aucun fichier");
});

test("D4c service A/B : retrait d'un plat d'un autre restaurant, archivé ou inexistant = « inconnu », aucune écriture, aucune suppression", async () => {
  for (const id of [PLAT_B, PLAT_A_ARCHIVE, INCONNU]) {
    const e = monter();
    refus(await retirerPhotoPlat(e.db, RESTAURANT_A, id, e.stockage) as never, "VALIDATION", "Plat inconnu.");
    assert.equal(e.ecritures.length, 0, id);
    assert.deepEqual(e.stockage.anciennes, []);
  }
});

test("D4c service : retrait : écriture refusée ou en exception = ERREUR_SERVEUR, ancienne image gardée ; zéro ligne touchée = « inconnu », jamais « ok »", async () => {
  for (const ecriture of ["erreur", "exception"] as const) {
    const e = monter({ ecriture });
    refus(await retirerPhotoPlat(e.db, RESTAURANT_A, PLAT_A, e.stockage) as never, "ERREUR_SERVEUR");
    assert.deepEqual(e.stockage.anciennes, []);
  }
  const e = monter({ archiveEntreTemps: true });
  refus(await retirerPhotoPlat(e.db, RESTAURANT_A, PLAT_A, e.stockage) as never, "VALIDATION", "Plat inconnu.");
  assert.deepEqual(e.stockage.anciennes, []);
});

// ---------- branchement du service restaurateur ----------
test("D4c service restaurateur : définir et retirer reçoivent le client du JETON et le restaurant du CONTEXTE (jamais un autre)", async () => {
  const recus: Array<{ appel: string; client: unknown; restaurantId: string; platId: string }> = [];
  const deps: Partial<DepsServiceRestaurant> = {
    definirPhoto: async (client, restaurantId, platId) => { recus.push({ appel: "definir", client, restaurantId, platId }); return { ok: true }; },
    retirerPhoto: async (client, restaurantId, platId) => { recus.push({ appel: "retirer", client, restaurantId, platId }); return { ok: true }; },
  };
  const service = creerServiceRestaurant(deps as DepsServiceRestaurant);
  const ctx: ContexteRestaurant = { supabase: { marqueur: "client-du-jeton" }, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };
  assert.deepEqual(await service.definirPhoto(ctx, PLAT_A, FICHIER), { ok: true });
  assert.deepEqual(await service.retirerPhoto(ctx, PLAT_A), { ok: true });
  assert.deepEqual(recus, [
    { appel: "definir", client: ctx.supabase, restaurantId: RESTAURANT_A, platId: PLAT_A },
    { appel: "retirer", client: ctx.supabase, restaurantId: RESTAURANT_A, platId: PLAT_A },
  ]);
});
