import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Base factice de la réservation (tables `reservations_table` et `restaurants`), sans aucun réseau. Elle IMITE les droits de colonne de la vraie table (migration 20261110090000) :
 *  - `select *` (ou `select()` sans colonne) échoue, comme pour un compte connecté ; nommer `jeton_suivi_hash` échoue aussi ;
 *  - seules les colonnes demandées reviennent (un test voit donc ce que le code a réellement demandé) ;
 *  - un UPDATE ne peut toucher que les colonnes permises (`colonnesModifiables`).
 * La fonction SQL de création (`fn_creer_reservation_atomique`, lot M5) est IMITÉE ici par `rpc` : MÊMES règles, MÊME ordre, mêmes codes de refus. Cette imitation ne prouve PAS le SQL (c'est
 * `test:cloisonnement`, sur une vraie base PostgreSQL jetable, qui le prouve) : elle sert à vérifier que l'API appelle la fonction avec les bons arguments et traduit chaque réponse.
 * Chaque requête est enregistrée (`operations`) pour que les tests vérifient colonnes, filtres et valeurs écrites. La logique SQL (triggers, RLS) est couverte par `test:cloisonnement`.
 */

export const UID_A = "00000000-0000-4000-8000-00000000000a";
export const UID_B = "00000000-0000-4000-8000-00000000000b";
export const RESTO_1 = "11111111-1111-4111-8111-111111111111";
export const RESTO_2 = "22222222-2222-4222-8222-222222222222";
export const RES_1 = "aaaaaaaa-0000-4000-8000-000000000001";
export const RES_2 = "aaaaaaaa-0000-4000-8000-000000000002";
export const RES_3 = "aaaaaaaa-0000-4000-8000-000000000003";
export const RES_4 = "aaaaaaaa-0000-4000-8000-000000000004";
export const RES_AUTRE = "bbbbbbbb-0000-4000-8000-000000000001";
export const MAINTENANT = new Date("2026-11-10T12:00:00.000Z");
export const CRENEAU = "2026-11-12T19:00:00.000Z";
export const TEL_A = "+224620000001";
export const TEL_B = "+224620000002";

export type Row = Record<string, unknown>;

export interface OperationVue {
  table: string;
  op: "select" | "insert" | "update" | "rpc";
  select: string;
  filtres: string[];
  valeurs: Row | null;
  tri: string[];
  limite: number | null;
}

export const ligneReservation = (surcharge: Row = {}): Row => ({
  id: RES_1,
  reference: "SF-R-AAAAA",
  restaurant_id: RESTO_1,
  client_user_id: UID_A,
  jeton_suivi_hash: null,
  nom_client: "Aminata Camara",
  telephone: TEL_A,
  nb_personnes: 4,
  creneau: CRENEAU,
  note: null,
  statut: "demandee",
  motif_refus: null,
  traitee_par: null,
  traitee_le: null,
  cree_le: "2026-11-10T10:00:00.000Z",
  mis_a_jour_le: "2026-11-10T10:00:00.000Z",
  ...surcharge,
});

export const ligneRestaurant = (surcharge: Row = {}): Row => ({
  id: RESTO_1,
  nom: "Chez Fatou",
  publie: true,
  suspendu_le: null,
  accepte_reservation: true,
  reservation_capacite_couverts: null,
  ...surcharge,
});

interface Options {
  reservations?: Row[];
  restaurants?: Row[];
  /** Colonnes qu'un UPDATE a le droit de toucher (défaut : statut et motif, comme le restaurateur). */
  colonnesModifiables?: string[];
  /** Les n premières insertions échouent par une collision de référence. */
  collisionsReference?: number;
  /** Erreur renvoyée par toute insertion. */
  erreurInsertion?: { code: string; message: string; details?: string };
  /** Erreur renvoyée par tout UPDATE. */
  erreurMiseAJour?: { code: string; message: string };
  /** Erreur renvoyée par toute lecture de cette table. */
  erreurLecture?: string;
  /** Instant « maintenant » de la fonction de création (la vraie fonction lit `now()` de la base). */
  maintenant?: Date;
  /** Erreur renvoyée par l'appel de la fonction de création. */
  erreurRpc?: { code: string; message: string };
  /** Réponse brute imposée à la fonction de création (pour tester la lecture stricte). */
  reponseRpc?: unknown;
  /** Appelée juste avant l'exécution d'un UPDATE (pour simuler un changement concurrent). */
  avantMiseAJour?: (tables: Record<string, Row[]>) => void;
}

function colonnes(select: string): string[] {
  const sortie: string[] = [];
  let profondeur = 0;
  let courant = "";
  for (const ch of select) {
    if (ch === "(") profondeur++;
    if (ch === ")") profondeur--;
    if (ch === "," && profondeur === 0) { sortie.push(courant.trim()); courant = ""; } else courant += ch;
  }
  if (courant.trim() !== "") sortie.push(courant.trim());
  return sortie;
}

const instantOu = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : v);

export function baseReservations(options: Options = {}) {
  const operations: OperationVue[] = [];
  const tables: Record<string, Row[]> = {
    reservations_table: (options.reservations ?? []).map((r) => ({ ...r })),
    restaurants: (options.restaurants ?? [ligneRestaurant()]).map((r) => ({ ...r })),
  };
  let restantesCollisions = options.collisionsReference ?? 0;
  let compteur = 100;

  function projeter(table: string, ligne: Row, select: string): Row {
    const sortie: Row = {};
    for (const c of colonnes(select)) {
      const embed = /^(\w+)\((.+)\)$/.exec(c);
      if (embed) {
        const cible = tables[embed[1]]?.find((r) => r.id === ligne.restaurant_id);
        sortie[embed[1]] = cible ? Object.fromEntries(colonnes(embed[2]).map((k) => [k, cible[k]])) : null;
      } else {
        sortie[c] = ligne[c];
      }
    }
    return sortie;
  }

  function verifierSelect(table: string, select: string) {
    const cols = colonnes(select);
    if (cols.length === 0 || cols.includes("*")) throw new Error(`SELECT_INTERDIT : select * ou vide sur ${table}`);
    if (select.includes("jeton_suivi_hash")) throw new Error("COLONNE_FERMEE : jeton_suivi_hash");
  }


  const ACTIFS = ["demandee", "confirmee"];
  /** Imitation de `fn_creer_reservation_atomique` (même ordre : plage, rejeu, fenêtre, restaurant, plafond, doublon, capacité, insertion avec nouveau tirage de référence). */
  function appelerCreation(args: Row): { data: unknown; error: { code: string; message: string } | null } {
    const maintenant = (options.maintenant ?? MAINTENANT).getTime();
    const creneau = Date.parse(String(args.p_creneau));
    const compte = args.p_client_user_id;
    const resto = args.p_restaurant_id;
    const nb = args.p_nb_personnes as number;
    const toutes = tables.reservations_table;
    const actives = toutes.filter((r) => r.client_user_id === compte && ACTIFS.includes(r.statut as string) && Date.parse(String(r.creneau)) > maintenant);
    const rendre = (ligne: Row) => projeter("reservations_table", ligne, "id, reference, restaurant_id, nom_client, telephone, nb_personnes, creneau, note, statut, motif_refus, cree_le, restaurants(nom)");
    const refus = (code: string) => ({ data: { etat: "refus", code }, error: null });
    const minutes = new Date(creneau).getUTCHours() * 60 + new Date(creneau).getUTCMinutes();
    if (minutes < 600 || minutes > 22 * 60 + 45) return refus("HORS_PLAGE");
    const existante = actives.find((r) => r.restaurant_id === resto && Date.parse(String(r.creneau)) === creneau && r.nb_personnes === nb);
    if (existante) return { data: { etat: "rejeu", reservation: rendre(existante) }, error: null };
    if (creneau < maintenant + 30 * 60_000) return refus("FENETRE_PROCHE");
    if (creneau > maintenant + 60 * 86_400_000) return refus("FENETRE_LOIN");
    const restaurant = tables.restaurants.find((r) => r.id === resto);
    if (!restaurant) return refus("RESTAURANT_INTROUVABLE");
    if (restaurant.publie !== true || (restaurant.suspendu_le !== null && restaurant.suspendu_le !== undefined)) return refus("RESTAURANT_INDISPONIBLE");
    if (restaurant.accepte_reservation !== true) return refus("RESERVATION_FERMEE");
    if (actives.length >= 3) return refus("PLAFOND");
    if (actives.some((r) => Date.parse(String(r.creneau)) === creneau)) return refus("DOUBLON");
    const capacite = restaurant.reservation_capacite_couverts as number | null | undefined;
    if (typeof capacite === "number") {
      const deja = toutes.filter((r) => r.restaurant_id === resto && Date.parse(String(r.creneau)) === creneau && ACTIFS.includes(r.statut as string)).reduce((n, r) => n + (r.nb_personnes as number), 0);
      if (deja + nb > capacite) return refus("CAPACITE");
    }
    for (let essai = 1; essai <= 4; essai++) {
      if (restantesCollisions > 0) { restantesCollisions--; continue; }
      compteur++;
      const nouvelle = ligneReservation({
        id: `cccccccc-0000-4000-8000-${String(compteur).padStart(12, "0")}`, reference: `SF-R-2222${"23456789"[compteur % 8]}`, statut: "demandee",
        restaurant_id: resto, client_user_id: compte, nom_client: args.p_nom, telephone: args.p_telephone, nb_personnes: nb, creneau: new Date(creneau).toISOString(), note: args.p_note,
      });
      toutes.push(nouvelle);
      return { data: { etat: "creee", reservation: rendre(nouvelle) }, error: null };
    }
    return refus("REFERENCE_INDISPONIBLE");
  }

  const client = {
    rpc(nom: string, args: Row) {
      operations.push({ table: `rpc:${nom}`, op: "rpc", select: "", filtres: [], valeurs: args, tri: [], limite: null });
      if (nom !== "fn_creer_reservation_atomique") return Promise.resolve({ data: null, error: { code: "42883", message: "function inconnue" } });
      if (options.erreurRpc) return Promise.resolve({ data: null, error: options.erreurRpc });
      if (options.reponseRpc !== undefined) return Promise.resolve({ data: options.reponseRpc, error: null });
      return Promise.resolve(appelerCreation(args));
    },
    from(table: string) {
      const vue: OperationVue = { table, op: "select", select: "", filtres: [], valeurs: null, tri: [], limite: null };
      operations.push(vue);
      const tests: Array<(l: Row) => boolean> = [];
      let maj: Row | null = null;
      let insertion: Row | null = null;
      let limite = Number.POSITIVE_INFINITY;
      const tris: Array<{ c: string; croissant: boolean }> = [];
      const ajouter = (nom: string, champ: string, test: (v: unknown) => boolean) => { vue.filtres.push(`${nom}:${champ}`); tests.push((l) => test(l[champ])); };

      function executer(): { data: Row[] | null; error: { code: string; message: string; details?: string } | null } {
        if (vue.op === "insert") {
          if (options.erreurInsertion) return { data: null, error: options.erreurInsertion };
          if (restantesCollisions > 0) {
            restantesCollisions--;
            return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "reservations_table_reference_key"', details: "Key (reference)=(SF-R-AAAAA) already exists." } };
          }
          compteur++;
          const nouvelle = ligneReservation({ id: `cccccccc-0000-4000-8000-${String(compteur).padStart(12, "0")}`, reference: `SF-R-2222${"23456789"[compteur % 8]}`, statut: "demandee", ...insertion });
          tables[table].push(nouvelle);
          return { data: [projeter(table, nouvelle, vue.select)], error: null };
        }
        if (options.erreurLecture === table && vue.op === "select") return { data: null, error: { code: "XX000", message: "detail-interne-factice SELECT secret" } };
        let lignes = tables[table].filter((l) => tests.every((t) => t(l)));
        if (vue.op === "update") {
          if (options.erreurMiseAJour) return { data: null, error: options.erreurMiseAJour };
          options.avantMiseAJour?.(tables);
          lignes = tables[table].filter((l) => tests.every((t) => t(l)));
          for (const l of lignes) Object.assign(l, maj);
          return { data: lignes.map((l) => projeter(table, l, vue.select)), error: null };
        }
        for (const t of [...tris].reverse()) lignes.sort((a, b) => { const x = instantOu(a[t.c]) as number | string; const y = instantOu(b[t.c]) as number | string; return x === y ? 0 : (x < y ? -1 : 1) * (t.croissant ? 1 : -1); });
        return { data: lignes.slice(0, limite).map((l) => projeter(table, l, vue.select)), error: null };
      }

      const chaine: Record<string, unknown> = {
        select: (cols?: string) => {
          vue.select = cols ?? "";
          verifierSelect(table, vue.select);
          return chaine;
        },
        insert: (valeurs: Row) => { vue.op = "insert"; vue.valeurs = valeurs; insertion = valeurs; if ("jeton_suivi_hash" in valeurs) throw new Error("COLONNE_FERMEE : jeton_suivi_hash"); return chaine; },
        update: (valeurs: Row) => {
          vue.op = "update"; vue.valeurs = valeurs; maj = valeurs;
          const permises = options.colonnesModifiables ?? ["statut", "motif_refus", "accepte_reservation", "reservation_capacite_couverts"];
          for (const k of Object.keys(valeurs)) if (!permises.includes(k)) throw new Error(`COLONNE_NON_MODIFIABLE : ${k}`);
          return chaine;
        },
        eq: (c: string, v: unknown) => { ajouter("eq", c, (x) => instantOu(x) === instantOu(v)); return chaine; },
        in: (c: string, vs: unknown[]) => { ajouter("in", c, (x) => vs.includes(x)); return chaine; },
        gt: (c: string, v: unknown) => { ajouter("gt", c, (x) => (instantOu(x) as number) > (instantOu(v) as number)); return chaine; },
        gte: (c: string, v: unknown) => { ajouter("gte", c, (x) => (instantOu(x) as number) >= (instantOu(v) as number)); return chaine; },
        lt: (c: string, v: unknown) => { ajouter("lt", c, (x) => (instantOu(x) as number) < (instantOu(v) as number)); return chaine; },
        order: (c: string, o?: { ascending?: boolean }) => { tris.push({ c, croissant: o?.ascending !== false }); vue.tri.push(c); return chaine; },
        limit: (n: number) => { limite = n; vue.limite = n; return chaine; },
        maybeSingle: async () => { const r = executer(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: null }; },
        single: async () => { const r = executer(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: null }; },
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => { try { return Promise.resolve(executer()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); } },
      };
      return chaine;
    },
  };
  return { client: client as unknown as SupabaseClient, operations, tables };
}
