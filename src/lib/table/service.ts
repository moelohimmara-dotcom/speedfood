import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import { versStatutCommande } from "@/lib/commande/commun";
import { appelPossible, compteDansAddition, estModeReglement, totalAddition, type ModeReglement } from "./regles";

/**
 * Sessions de table (voir docs/COMMANDE-SUR-PLACE.md). Toutes les écritures passent ici, avec la clé de service ; l'appelant a DÉJÀ
 * vérifié l'identité (membre du restaurant, ou porteur du jeton de suivi d'une commande de la table) et ce module revérifie le lien.
 */

type Db = ReturnType<typeof clientLivraison>;
export type Resultat = { ok: true } | { ok: false; erreur: string };

export interface SessionTable {
  id: string;
  restaurantId: string;
  tableNumero: string;
  statut: "ouverte" | "payee" | "annulee";
  valideeLe: string | null;
  appelServeurLe: string | null;
  additionDemandeeLe: string | null;
  paiementMode: ModeReglement | null;
  ouverteLe: string;
}

type SessionBrute = {
  id: string;
  restaurant_id: string;
  table_numero: string;
  statut: string;
  validee_le: string | null;
  appel_serveur_le: string | null;
  addition_demandee_le: string | null;
  paiement_mode: string | null;
  ouverte_le: string;
};

const COLONNES = "id, restaurant_id, table_numero, statut, validee_le, appel_serveur_le, addition_demandee_le, paiement_mode, ouverte_le";

function versSession(b: SessionBrute): SessionTable {
  return {
    id: b.id,
    restaurantId: b.restaurant_id,
    tableNumero: b.table_numero,
    statut: b.statut === "payee" || b.statut === "annulee" ? b.statut : "ouverte",
    valideeLe: b.validee_le,
    appelServeurLe: b.appel_serveur_le,
    additionDemandeeLe: b.addition_demandee_le,
    paiementMode: estModeReglement(b.paiement_mode) ? b.paiement_mode : null,
    ouverteLe: b.ouverte_le,
  };
}

/** Session ouverte de cette table, ou `null`. La casse du numéro est ignorée (« a1 » et « A1 » sont la même table). */
export async function sessionOuverte(db: Db, restaurantId: string, tableNumero: string): Promise<SessionTable | null> {
  const { data } = await db.from("table_sessions").select(COLONNES).eq("restaurant_id", restaurantId).eq("statut", "ouverte").ilike("table_numero", tableNumero.replace(/[\\%_]/g, (c) => "\\" + c));
  const lignes = (data ?? []) as SessionBrute[];
  const meme = lignes.find((l) => l.table_numero.toLowerCase() === tableNumero.toLowerCase());
  return meme ? versSession(meme) : null;
}

/** Rejoint la session ouverte de la table ou en ouvre une. Deux convives qui scannent en même temps arrivent sur la MÊME session. */
export async function ouvrirOuRejoindreSession(db: Db, restaurantId: string, tableNumero: string): Promise<SessionTable | null> {
  const existante = await sessionOuverte(db, restaurantId, tableNumero);
  if (existante) return existante;
  const { data, error } = await db.from("table_sessions").insert({ restaurant_id: restaurantId, table_numero: tableNumero }).select(COLONNES).single();
  if (!error && data) return versSession(data as SessionBrute);
  // Course perdue contre un convive de la même table : la session existe maintenant.
  return sessionOuverte(db, restaurantId, tableNumero);
}

/** Après qu'un membre a accepté une commande de table, la table est validée : les commandes suivantes passent selon le réglage. */
export async function validerSessionApresAcceptation(commandeId: string): Promise<void> {
  const db = clientLivraison();
  const { data } = await db.from("orders").select("session_id").eq("id", commandeId).maybeSingle();
  const sessionId = (data as { session_id: string | null } | null)?.session_id;
  if (!sessionId) return;
  await db.from("table_sessions").update({ validee_le: new Date().toISOString(), mis_a_jour_le: new Date().toISOString() }).eq("id", sessionId).is("validee_le", null);
}

// ---------------------------------------------------------------- vue de la table (convive)

export interface CommandeDeTable {
  id: string;
  reference: string;
  statut: string;
  sousTotal: number;
  creeLe: string;
  client: string;
  lignes: { nom: string; quantite: number; prix: number }[];
}

export interface VueTable {
  session: SessionTable;
  commandes: CommandeDeTable[];
  total: number;
}

/**
 * Addition de la table à laquelle appartient la commande portant ce jeton de suivi. Montre les articles et le prénom des commandes de la
 * même table (table partagée), jamais le téléphone ni l'adresse.
 */
export async function vueTableParJeton(jeton: string): Promise<VueTable | null> {
  const db = clientLivraison();
  const { data: cmd } = await db.from("orders").select("session_id").eq("jeton_suivi", jeton).maybeSingle();
  const sessionId = (cmd as { session_id: string | null } | null)?.session_id;
  if (!sessionId) return null;
  return vueTable(db, sessionId);
}

type CommandeBrute = { id: string; session_id?: string; reference: string; statut: string; sous_total: number; cree_le: string; client_nom: string; order_items: { nom: string; quantite: number; prix: number }[] };

const COLONNES_COMMANDE = "id, session_id, reference, statut, sous_total, cree_le, client_nom, order_items(nom, quantite, prix)";

function versCommande(c: CommandeBrute): CommandeDeTable {
  return {
    id: c.id,
    reference: c.reference,
    statut: versStatutCommande(c.statut),
    sousTotal: c.sous_total,
    creeLe: c.cree_le,
    client: c.client_nom,
    lignes: c.order_items ?? [],
  };
}

export async function vueTable(db: Db, sessionId: string): Promise<VueTable | null> {
  const { data: s } = await db.from("table_sessions").select(COLONNES).eq("id", sessionId).maybeSingle();
  if (!s) return null;
  const { data: cmds } = await db.from("orders").select(COLONNES_COMMANDE).eq("session_id", sessionId).order("cree_le", { ascending: true });
  const commandes = ((cmds ?? []) as unknown as CommandeBrute[]).map(versCommande);
  return { session: versSession(s as SessionBrute), commandes, total: totalAddition(commandes) };
}

// ---------------------------------------------------------------- appels (convive)

async function sessionDuJeton(db: Db, jeton: string): Promise<SessionTable | null> {
  const { data: cmd } = await db.from("orders").select("session_id").eq("jeton_suivi", jeton).maybeSingle();
  const sessionId = (cmd as { session_id: string | null } | null)?.session_id;
  if (!sessionId) return null;
  const { data: s } = await db.from("table_sessions").select(COLONNES).eq("id", sessionId).maybeSingle();
  return s ? versSession(s as SessionBrute) : null;
}

/** Le convive appelle le serveur ou demande l'addition. Un appel toutes les 60 s au plus par table. */
export async function signalerAuPersonnel(jeton: string, quoi: "serveur" | "addition", maintenant = new Date()): Promise<Resultat> {
  const db = clientLivraison();
  const s = await sessionDuJeton(db, jeton);
  if (!s || s.statut !== "ouverte") return { ok: false, erreur: "Cette table n'est plus ouverte." };
  const dernier = quoi === "serveur" ? s.appelServeurLe : s.additionDemandeeLe;
  if (!appelPossible(dernier, maintenant)) return { ok: false, erreur: "C'est déjà signalé, le personnel arrive. Patientez une minute avant de renouveler." };
  const colonne = quoi === "serveur" ? "appel_serveur_le" : "addition_demandee_le";
  const { error } = await db.from("table_sessions").update({ [colonne]: maintenant.toISOString(), mis_a_jour_le: maintenant.toISOString() }).eq("id", s.id).eq("statut", "ouverte");
  return error ? { ok: false, erreur: "Envoi impossible, réessayez." } : { ok: true };
}

// ---------------------------------------------------------------- salle (restaurant)

export interface TableOuverte {
  session: SessionTable;
  commandes: CommandeDeTable[];
  total: number;
}

/**
 * Tables ouvertes d'un restaurant avec leurs commandes. DEUX requêtes au total, quel que soit le nombre de tables (la salle se rafraîchit
 * toutes les 10 s : une requête par table ferait vite dépasser la limite de sous-requêtes d'un Worker).
 */
export async function tablesOuvertes(restaurantId: string): Promise<TableOuverte[]> {
  const db = clientLivraison();
  const { data } = await db.from("table_sessions").select(COLONNES).eq("restaurant_id", restaurantId).eq("statut", "ouverte").order("ouverte_le", { ascending: true });
  const sessions = (data ?? []) as SessionBrute[];
  if (sessions.length === 0) return [];
  const { data: cmds } = await db
    .from("orders")
    .select(COLONNES_COMMANDE)
    .in("session_id", sessions.map((s) => s.id))
    .order("cree_le", { ascending: true });
  const parSession = new Map<string, CommandeDeTable[]>();
  for (const c of (cmds ?? []) as unknown as CommandeBrute[]) {
    if (!c.session_id) continue;
    parSession.set(c.session_id, [...(parSession.get(c.session_id) ?? []), versCommande(c)]);
  }
  return sessions.map((s) => {
    const commandes = parSession.get(s.id) ?? [];
    return { session: versSession(s), commandes, total: totalAddition(commandes) };
  });
}

/** Le personnel a vu l'appel : le signal est effacé (l'addition demandée reste jusqu'au règlement). */
export async function acquitterAppel(restaurantId: string, sessionId: string): Promise<Resultat> {
  const { data, error } = await clientLivraison()
    .from("table_sessions")
    .update({ appel_serveur_le: null, mis_a_jour_le: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId)
    .eq("statut", "ouverte")
    .select("id");
  return error || !data || data.length === 0 ? { ok: false, erreur: "Table introuvable." } : { ok: true };
}

/** Fait passer une commande servie à « terminée » par les étapes autorisées (acceptée → prête → terminée), avec l'historique de chaque étape. */
async function terminerCommande(db: Db, id: string, depuis: string, acteur: string): Promise<boolean> {
  let statutPrecedent = depuis;
  if (statutPrecedent === "acceptee") {
    const { data, error } = await db.from("orders").update({ statut: "prete" }).eq("id", id).eq("statut", "acceptee").select("id");
    if (error || !data || data.length === 0) return false;
    await db.from("order_status_events").insert({ order_id: id, statut_precedent: "acceptee", statut_suivant: "prete", acteur });
    statutPrecedent = "prete";
  }
  if (statutPrecedent !== "prete") return false;
  const { data, error } = await db.from("orders").update({ statut: "terminee" }).eq("id", id).eq("statut", "prete").select("id");
  if (error || !data || data.length === 0) return false;
  await db.from("order_status_events").insert({ order_id: id, statut_precedent: "prete", statut_suivant: "terminee", acteur });
  return true;
}

/**
 * Clôture une table : le serveur a encaissé l'addition (Speedfood n'encaisse rien). Les commandes servies (acceptée, prête) passent à
 * « terminée » et leur règlement est marqué reçu avec le mode indiqué ; une commande encore « en attente » bloque la clôture (le personnel
 * doit l'accepter ou la refuser d'abord).
 */
export async function cloturerTable(args: { restaurantId: string; sessionId: string; mode: unknown; acteurId: string }): Promise<Resultat> {
  if (!estModeReglement(args.mode)) return { ok: false, erreur: "Choisissez le mode de règlement." };
  const db = clientLivraison();
  const vue = await vueTable(db, args.sessionId);
  if (!vue || vue.session.restaurantId !== args.restaurantId || vue.session.statut !== "ouverte") return { ok: false, erreur: "Table introuvable ou déjà clôturée." };
  if (vue.commandes.some((c) => c.statut === "en_attente")) return { ok: false, erreur: "Une commande de cette table attend encore une réponse : acceptez-la ou refusez-la avant de clôturer." };

  // 1) Les commandes servies passent à « terminée » en suivant le parcours autorisé (acceptée → prête → terminée) ; si l'une échoue, rien n'est
  //    clôturé (la table reste ouverte et on le dit), plutôt que de marquer « payée » une table dont les commandes ne le sont pas.
  const maintenant = new Date().toISOString();
  const acteur = `restaurant:${args.acteurId}`;
  const aTerminer = vue.commandes.filter((c) => compteDansAddition(c.statut));
  for (const c of aTerminer) {
    if (c.statut === "terminee") continue;
    if (!(await terminerCommande(db, c.id, c.statut, acteur))) {
      return { ok: false, erreur: "Une commande de cette table n'a pas pu passer à « terminée ». Réessayez ; la table reste ouverte." };
    }
  }
  // 2) Règlement reçu sur toutes les commandes qui comptent, puis clôture de la session.
  for (const c of aTerminer) {
    await db.from("orders").update({ paiement_mode: args.mode, paiement_statut: "recu", paiement_declare_le: maintenant }).eq("id", c.id).neq("paiement_statut", "recu");
  }
  const { data, error } = await db
    .from("table_sessions")
    .update({ statut: "payee", paiement_mode: args.mode, cloturee_le: maintenant, cloturee_par: args.acteurId, mis_a_jour_le: maintenant })
    .eq("id", args.sessionId)
    .eq("restaurant_id", args.restaurantId)
    .eq("statut", "ouverte")
    .select("id");
  return error || !data || data.length === 0 ? { ok: false, erreur: "Clôture impossible, réessayez." } : { ok: true };
}

/** Annule une table ouverte sans commande facturable (erreur de saisie, table abandonnée). */
export async function annulerTable(args: { restaurantId: string; sessionId: string; acteurId: string }): Promise<Resultat> {
  const db = clientLivraison();
  const vue = await vueTable(db, args.sessionId);
  if (!vue || vue.session.restaurantId !== args.restaurantId || vue.session.statut !== "ouverte") return { ok: false, erreur: "Table introuvable ou déjà clôturée." };
  if (vue.commandes.some((c) => compteDansAddition(c.statut) && c.statut !== "en_attente")) {
    return { ok: false, erreur: "Cette table a des commandes acceptées : clôturez-la avec son règlement." };
  }
  const maintenant = new Date().toISOString();
  const { data, error } = await db
    .from("table_sessions")
    .update({ statut: "annulee", cloturee_le: maintenant, cloturee_par: args.acteurId, mis_a_jour_le: maintenant })
    .eq("id", args.sessionId)
    .eq("restaurant_id", args.restaurantId)
    .eq("statut", "ouverte")
    .select("id");
  return error || !data || data.length === 0 ? { ok: false, erreur: "Annulation impossible, réessayez." } : { ok: true };
}
