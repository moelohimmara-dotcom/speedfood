import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agirSurLivraisonRestaurant, lireLivraisonsDesCommandes, type AvancementLivraison, type DemandeAvancementRestaurant } from "../src/restaurant/livraison.ts";
import { creerServiceRestaurant, type DepsServiceRestaurant } from "../src/restaurant/service.ts";

/**
 * Lot D5, service de l'API (`restaurant/livraison.ts` et `lister` de `service.ts`) avec de fausses bases qui APPLIQUENT les filtres reçus (comme la RLS plus le filtre sur le restaurant) et un faux
 * avancement qui ENREGISTRE ses appels. Garanties visées : la livraison d'un autre restaurant est « introuvable » (même réponse qu'une livraison absente) et l'avancement n'est jamais appelé ;
 * l'avancement n'est appelé qu'APRÈS le contrôle d'appartenance ; le code ne sort jamais ; une livraison illisible n'invalide jamais la liste.
 */
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const LIVRAISON_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LIVRAISON_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CMD_A = "a0000000-0000-4000-8000-00000000000a";
const CMD_B = "b0000000-0000-4000-8000-00000000000b";

type Ligne = Record<string, unknown>;
interface Etat { lignes: Ligne[]; requetes: Array<{ table: string; colonnes: string; filtres: Array<[string, unknown]>; in?: [string, unknown[]] }>; erreur: boolean; exception: boolean; colonnesRetournees?: string[] }

/** Faux client « lié au jeton » : applique les `eq` et `in` reçus sur les lignes (la base ne renvoie QUE ce que les filtres laissent passer). */
function fauxClient(etat: Etat): SupabaseClient {
  return {
    from(table: string) {
      const requete = { table, colonnes: "", filtres: [] as Array<[string, unknown]>, in: undefined as [string, unknown[]] | undefined };
      etat.requetes.push(requete);
      const retenues = () => etat.lignes.filter((l) => requete.filtres.every(([c, v]) => l[c] === v) && (!requete.in || requete.in[1].includes(l[requete.in[0]])));
      const chaine = {
        select(colonnes: string) { requete.colonnes = colonnes; return chaine; },
        eq(c: string, v: unknown) { requete.filtres.push([c, v]); return chaine; },
        in(c: string, v: unknown[]) { requete.in = [c, v]; return chaine; },
        maybeSingle: async () => {
          if (etat.exception) throw new Error("base en panne");
          if (etat.erreur) return { data: null, error: { message: "panne" } };
          return { data: retenues()[0] ?? null, error: null };
        },
        then(ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) {
          return Promise.resolve().then(() => {
            if (etat.exception) throw new Error("base en panne");
            if (etat.erreur) return { data: null, error: { message: "panne" } };
            return { data: retenues(), error: null };
          }).then(ok, ko);
        },
      };
      return chaine;
    },
  } as unknown as SupabaseClient;
}
const neuf = (lignes: Ligne[] = []): Etat => ({ lignes, requetes: [], erreur: false, exception: false });
const BASE: Ligne[] = [
  { id: LIVRAISON_A, restaurant_id: RESTAURANT_A, order_id: CMD_A, mode: "propre", statut: "assignee" },
  { id: LIVRAISON_B, restaurant_id: RESTAURANT_B, order_id: CMD_B, mode: "propre", statut: "vers_client" },
];

interface Journal { appels: string[]; demandes: DemandeAvancementRestaurant[] }
function avancement(journal: Journal, reponse: { ok: true } | { ok: false; message: string } | Error = { ok: true }): AvancementLivraison {
  return async (demande) => {
    journal.appels.push("avancer"); journal.demandes.push(demande);
    if (reponse instanceof Error) throw reponse;
    return reponse;
  };
}
const nouveauJournal = (): Journal => ({ appels: [], demandes: [] });
const INTROUVABLE = { ok: false, erreur: { code: "INTROUVABLE", message: "Livraison introuvable." } };
const PANNE = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." } };

// ---------- action : appartenance ----------
test("D5 service : la livraison de CE restaurant avance (partir, livree avec code, annuler) avec l'acteur « restaurant » imposé", async () => {
  const cas: Array<["partir" | "livree" | "annuler", string | undefined, DemandeAvancementRestaurant]> = [
    ["partir", undefined, { livraisonId: LIVRAISON_A, acteur: "restaurant", vers: "vers_client" }],
    ["livree", "0042", { livraisonId: LIVRAISON_A, acteur: "restaurant", vers: "livree", code: "0042" }],
    ["annuler", undefined, { livraisonId: LIVRAISON_A, acteur: "restaurant", vers: "annulee", raison: "Annulée par le restaurant" }],
  ];
  for (const [action, code, attendu] of cas) {
    const journal = nouveauJournal();
    const etat = neuf(BASE);
    assert.deepEqual(await agirSurLivraisonRestaurant(fauxClient(etat), RESTAURANT_A, LIVRAISON_A, action, code, avancement(journal)), { ok: true });
    assert.deepEqual(journal.demandes, [attendu]);
    assert.ok(!("restaurantId" in journal.demandes[0]), "le service d'avancement ne reçoit jamais de restaurant");
  }
});

test("D5 service A/B : la livraison d'un AUTRE restaurant est « introuvable », identique à une livraison absente, et l'avancement n'est jamais appelé", async () => {
  for (const action of ["partir", "livree", "annuler"] as const) {
    for (const livraisonId of [LIVRAISON_B, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]) {
      const journal = nouveauJournal();
      const etat = neuf(BASE);
      const r = await agirSurLivraisonRestaurant(fauxClient(etat), RESTAURANT_A, livraisonId, action, action === "livree" ? "1234" : undefined, avancement(journal));
      assert.deepEqual(r, INTROUVABLE, `${action} ${livraisonId}`);
      assert.deepEqual(journal.appels, [], "aucun appel à l'avancement");
    }
  }
  // Et l'inverse : le restaurant B ne touche pas la livraison de A.
  const journal = nouveauJournal();
  assert.deepEqual(await agirSurLivraisonRestaurant(fauxClient(neuf(BASE)), RESTAURANT_B, LIVRAISON_A, "annuler", undefined, avancement(journal)), INTROUVABLE);
  assert.deepEqual(journal.appels, []);
});

test("D5 service : l'appartenance est lue avec le client du jeton, filtrée sur la livraison ET sur le restaurant du contexte, une seule colonne", async () => {
  const etat = neuf(BASE);
  await agirSurLivraisonRestaurant(fauxClient(etat), RESTAURANT_A, LIVRAISON_A, "partir", undefined, avancement(nouveauJournal()));
  assert.equal(etat.requetes.length, 1);
  assert.equal(etat.requetes[0].table, "livraisons");
  assert.equal(etat.requetes[0].colonnes, "id");
  assert.deepEqual(etat.requetes[0].filtres, [["id", LIVRAISON_A], ["restaurant_id", RESTAURANT_A]]);
});

test("D5 service : l'avancement n'est appelé qu'APRÈS le contrôle d'appartenance (ordre vérifié)", async () => {
  const journal = nouveauJournal();
  const etat = neuf(BASE);
  const client = { from: (t: string) => { journal.appels.push("lecture"); return fauxClient(etat).from(t); } } as unknown as SupabaseClient;
  await agirSurLivraisonRestaurant(client, RESTAURANT_A, LIVRAISON_A, "partir", undefined, avancement(journal));
  assert.deepEqual(journal.appels, ["lecture", "avancer"]);
});

test("D5 service : lecture en panne (erreur ou exception) = erreur serveur, avancement jamais appelé", async () => {
  for (const mode of ["erreur", "exception"] as const) {
    const journal = nouveauJournal();
    const etat = neuf(BASE);
    etat[mode] = true;
    assert.deepEqual(await agirSurLivraisonRestaurant(fauxClient(etat), RESTAURANT_A, LIVRAISON_A, "partir", undefined, avancement(journal)), PANNE);
    assert.deepEqual(journal.appels, []);
  }
});

// ---------- action : réponses du service du site ----------
test("D5 service : les refus de la machine à états du site deviennent des erreurs au contrat, sans jamais citer le code", async () => {
  const cas: Array<[string, unknown]> = [
    ["Code incorrect. Demandez au client le code à 4 chiffres affiché sur son suivi (3 essai(s) restant(s)).", { ok: false, erreur: { code: "VALIDATION", message: "Code incorrect.", champs: { raison: "code_incorrect", essaisRestants: "3" } } }],
    ["Code incorrect. Demandez au client le code à 4 chiffres affiché sur son suivi (0 essai(s) restant(s)).", { ok: false, erreur: { code: "VALIDATION", message: "Code incorrect.", champs: { raison: "code_incorrect", essaisRestants: "0" } } }],
    ["Trop d'essais de code. Contactez l'assistance.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Trop d'essais de code. Contactez l'assistance.", champs: { raison: "essais_epuises" } } }],
    ["Livraison introuvable.", INTROUVABLE],
    ["Commande introuvable.", INTROUVABLE],
    ["Cette livraison est terminée.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } }],
    ["Ce changement d'étape n'est pas possible maintenant.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } }],
    ["La commande doit être acceptée avant de partir livrer.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } }],
    ["La commande n'est pas encore prête : attendez que le restaurant la déclare prête.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } }],
    ["La livraison a changé d'état entre-temps. Rechargez la page.", { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } }],
    ["Message inconnu avec le code 7391 et une adresse https://exemple.org", PANNE],
  ];
  for (const [message, attendu] of cas) {
    const r = await agirSurLivraisonRestaurant(fauxClient(neuf(BASE)), RESTAURANT_A, LIVRAISON_A, "livree", "7391", avancement(nouveauJournal(), { ok: false, message }));
    assert.deepEqual(r, attendu, message);
    assert.ok(!JSON.stringify(r).includes("7391"), "le code ne sort pas");
  }
});

test("D5 service : une exception de l'avancement devient une erreur serveur générique (le texte de l'exception ne sort pas)", async () => {
  const r = await agirSurLivraisonRestaurant(fauxClient(neuf(BASE)), RESTAURANT_A, LIVRAISON_A, "livree", "7391", avancement(nouveauJournal(), new Error("insert into livraison_codes 7391 SECRET")));
  assert.deepEqual(r, PANNE);
  assert.ok(!JSON.stringify(r).includes("7391") && !JSON.stringify(r).includes("SECRET"));
});

// ---------- lecture des livraisons ----------
test("D5 lecture : seules les livraisons de CE restaurant et des commandes demandées sont lues ; trois champs retenus (jamais code, livreur, coordonnées)", async () => {
  const etat = neuf([
    { id: LIVRAISON_A, restaurant_id: RESTAURANT_A, order_id: CMD_A, mode: "propre", statut: "vers_client", code: "1234", livreur_id: "x", telephone: "+224 600", depart_latitude: 9.5, essais_code: 2 },
    { id: LIVRAISON_B, restaurant_id: RESTAURANT_B, order_id: CMD_B, mode: "propre", statut: "assignee" },
  ]);
  const r = await lireLivraisonsDesCommandes(fauxClient(etat), RESTAURANT_A, [CMD_A, CMD_B]);
  assert.deepEqual(r, { parCommande: { [CMD_A]: { id: LIVRAISON_A, statut: "vers_client", mode: "propre" } }, ignorees: 0 });
  assert.ok(!JSON.stringify(r).includes("1234"));
  assert.equal(etat.requetes[0].colonnes, "id, order_id, mode, statut", "quatre colonnes lues, pas de code ni de livreur");
  assert.deepEqual(etat.requetes[0].filtres, [["restaurant_id", RESTAURANT_A]]);
});

test("D5 lecture : ligne illisible, doublon ou commande hors demande = écartée ET comptée ; panne = null ; pas d'appel pour une liste vide", async () => {
  const etat = neuf([
    { id: LIVRAISON_A, restaurant_id: RESTAURANT_A, order_id: CMD_A, mode: "propre", statut: "assignee" },
    { id: "pas-un-uuid", restaurant_id: RESTAURANT_A, order_id: CMD_B, mode: "propre", statut: "assignee" },
    { id: LIVRAISON_B, restaurant_id: RESTAURANT_A, order_id: CMD_A, mode: "propre", statut: "vers_client" },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", restaurant_id: RESTAURANT_A, order_id: "d0000000-0000-4000-8000-00000000000d", mode: "drone", statut: "assignee" },
  ]);
  const r = await lireLivraisonsDesCommandes(fauxClient(etat), RESTAURANT_A, [CMD_A, CMD_B]);
  assert.deepEqual(r?.parCommande, { [CMD_A]: { id: LIVRAISON_A, statut: "assignee", mode: "propre" } });
  assert.equal(r?.ignorees, 2, "l'identifiant illisible est compté, le doublon aussi ; la commande non demandée n'est pas retournée par la base");
  for (const mode of ["erreur", "exception"] as const) {
    const e = neuf(BASE); e[mode] = true;
    assert.equal(await lireLivraisonsDesCommandes(fauxClient(e), RESTAURANT_A, [CMD_A]), null);
  }
  const vide = neuf(BASE);
  assert.deepEqual(await lireLivraisonsDesCommandes(fauxClient(vide), RESTAURANT_A, []), { parCommande: {}, ignorees: 0 });
  assert.equal(vide.requetes.length, 0);
});

test("D5 lecture : les identifiants sont envoyés par paquets de 50 (adresse de requête bornée)", async () => {
  const ids = Array.from({ length: 120 }, (_, i) => `e0000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  const etat = neuf([]);
  await lireLivraisonsDesCommandes(fauxClient(etat), RESTAURANT_A, ids);
  assert.deepEqual(etat.requetes.map((r) => r.in?.[1].length), [50, 50, 20]);
});

// ---------- lister : la liste n'est jamais invalidée ----------
const CLIENT_JETON = { client: "jeton" };
function service(lireLivraisons: DepsServiceRestaurant["lireLivraisons"], commandes: Array<{ id: string; mode: string }>) {
  const appels: string[][] = [];
  const s = creerServiceRestaurant({
    limiter: async () => {},
    clientJeton: () => CLIENT_JETON,
    clientAdmin: () => ({}),
    aSecondFacteurConfirme: async () => false,
    questionsRequises: async () => false,
    appartenance: async () => ({ restaurantId: RESTAURANT_A, role: "owner" }),
    origineSite: async () => "https://site.exemple",
    lireCommandes: async (_c, restaurantId) => ({ ok: true, restaurant: { id: restaurantId, nom: "Chez Fatou", ouvert: true, accepteCommandes: true }, commandes: commandes as never }),
    traiterCommande: async () => { throw new Error("hors sujet"); },
    confirmerPaiement: async () => { throw new Error("hors sujet"); },
    proposerRevision: async () => { throw new Error("hors sujet"); },
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
    lireLivraisons: async (client, restaurantId, ids) => { appels.push([(client as typeof CLIENT_JETON).client, restaurantId, ...ids]); return lireLivraisons(client, restaurantId, ids); },
    agirSurLivraison: async () => { throw new Error("hors sujet"); },
  });
  return { s, appels };
}
const CTX = { supabase: CLIENT_JETON, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };

test("D5 liste : chaque commande en livraison reçoit son bloc (identifiant, statut, mode) ; les autres null ; la lecture se fait avec le client du jeton et le restaurant du contexte", async () => {
  const { s, appels } = service(async () => ({ parCommande: { [CMD_A]: { id: LIVRAISON_A, statut: "assignee", mode: "propre" } }, ignorees: 0 }), [{ id: CMD_A, mode: "livraison" }, { id: CMD_B, mode: "retrait" }]);
  const r = await s.lister(CTX);
  assert.deepEqual(r.commandes.map((c) => c.livraison), [{ id: LIVRAISON_A, statut: "assignee", mode: "propre" }, null]);
  assert.equal(r.livraisonsIllisibles, 0);
  assert.deepEqual(appels, [["jeton", RESTAURANT_A, CMD_A]], "seules les commandes en livraison, client du jeton, restaurant du contexte");
});

test("D5 liste : aucune lecture de livraison s'il n'y a aucune commande en livraison", async () => {
  const { s, appels } = service(async () => { throw new Error("ne doit pas être appelé"); }, [{ id: CMD_B, mode: "retrait" }]);
  const r = await s.lister(CTX);
  assert.deepEqual(appels, []);
  assert.equal(r.livraisonsIllisibles, 0);
  assert.equal(r.commandes.length, 1);
});

test("D5 liste : lecture des livraisons en panne (null ou exception) = la liste reste VALIDE, livraison null, commandes en livraison COMPTÉES", async () => {
  for (const lire of [async () => null, async () => { throw new Error("base en panne 7391"); }] as Array<DepsServiceRestaurant["lireLivraisons"]>) {
    const { s } = service(lire, [{ id: CMD_A, mode: "livraison" }, { id: CMD_B, mode: "retrait" }, { id: "c0000000-0000-4000-8000-00000000000c", mode: "livraison" }]);
    const r = await s.lister(CTX);
    assert.equal(r.ok, true);
    assert.equal(r.commandes.length, 3, "la liste des commandes est intacte");
    assert.deepEqual(r.commandes.map((c) => c.livraison), [null, null, null]);
    assert.equal(r.livraisonsIllisibles, 2);
    assert.ok(!JSON.stringify(r).includes("7391"));
  }
});

test("D5 liste : les lignes écartées par la lecture sont comptées, et seul le bloc à trois champs sort (jamais code ni livreur, même si la lecture en renvoyait)", async () => {
  const { s } = service(async () => ({ parCommande: { [CMD_A]: { id: LIVRAISON_A, statut: "vers_client", mode: "propre", code: "1234", livreurTelephone: "+224 600", latitude: 9.5 } as never }, ignorees: 2 }), [{ id: CMD_A, mode: "livraison" }]);
  const r = await s.lister(CTX);
  assert.deepEqual(r.commandes[0].livraison, { id: LIVRAISON_A, statut: "vers_client", mode: "propre" });
  assert.equal(r.livraisonsIllisibles, 2);
  assert.ok(!JSON.stringify(r).includes("1234") && !JSON.stringify(r).includes("+224"));
});
