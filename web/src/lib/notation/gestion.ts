import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import {
  messageRefus,
  moyenne,
  raisonNotationImpossible,
  sousLeSeuil,
  troisMauvaisesDeSuite,
  validerAvis,
  validerReponse,
  type AvisSaisi,
} from "./regles";
import { lireTout } from "@/lib/db/lecture-complete";

/**
 * Gestion des avis par le restaurant, le livreur et l'exploitation (voir docs/NOTATION.md). Chaque fonction reçoit une identité DÉJÀ
 * vérifiée par l'appelant (session, appartenance au restaurant, permission) et revérifie ici le lien avec la commande ou l'avis.
 */

export type Resultat = { ok: true } | { ok: false; erreur: string };

// ---------------------------------------------------------------- restaurant : lire et répondre

export interface AvisPourRestaurant {
  id: string;
  note: number;
  etiquettes: string[];
  commentaire: string | null;
  prenom: string;
  date: string;
  statut: string;
  reponse: string | null;
}

export async function listerAvisRestaurant(restaurantId: string, limite = 50): Promise<AvisPourRestaurant[]> {
  const { data } = await clientLivraison()
    .from("avis")
    .select("id, note, etiquettes, commentaire, prenom_affiche, cree_le, statut, reponse_texte")
    .eq("restaurant_id", restaurantId)
    .eq("cible", "restaurant")
    .eq("est_test", false)
    .in("statut", ["publie", "commentaire_masque"])
    .order("cree_le", { ascending: false })
    .limit(limite);
  return ((data ?? []) as { id: string; note: number; etiquettes: string[]; commentaire: string | null; prenom_affiche: string | null; cree_le: string; statut: string; reponse_texte: string | null }[]).map((l) => ({
    id: l.id,
    note: l.note,
    etiquettes: l.etiquettes ?? [],
    commentaire: l.statut === "commentaire_masque" ? null : l.commentaire,
    prenom: l.prenom_affiche ?? "Client",
    date: l.cree_le,
    statut: l.statut,
    reponse: l.reponse_texte,
  }));
}

/** Une seule réponse par avis, non modifiable : le restaurant réfléchit avant d'écrire. */
export async function repondreAvis(args: { restaurantId: string; avisId: string; utilisateurId: string; texte: unknown }): Promise<Resultat> {
  const v = validerReponse(args.texte);
  if (!v.ok) return { ok: false, erreur: v.erreur };
  const db = clientLivraison();
  const { data } = await db.from("avis").select("id, restaurant_id, cible, statut, reponse_texte").eq("id", args.avisId).maybeSingle();
  const a = data as { restaurant_id: string; cible: string; statut: string; reponse_texte: string | null } | null;
  if (!a || a.restaurant_id !== args.restaurantId || a.cible !== "restaurant") return { ok: false, erreur: "Avis introuvable." };
  if (a.statut !== "publie") return { ok: false, erreur: "Cet avis n'accepte plus de réponse." };
  if (a.reponse_texte) return { ok: false, erreur: "Vous avez déjà répondu à cet avis." };
  const { error } = await db
    .from("avis")
    .update({ reponse_texte: v.texte, reponse_le: new Date().toISOString(), reponse_par: args.utilisateurId })
    .eq("id", args.avisId)
    .is("reponse_texte", null);
  return error ? { ok: false, erreur: "Enregistrement impossible, réessayez." } : { ok: true };
}

// ---------------------------------------------------------------- note PRIVÉE sur le client (restaurant ou livreur)

async function commandeTerminee(orderId: string): Promise<{ restaurant_id: string; statut: string; est_test: boolean; mis_a_jour_le: string } | null> {
  const { data } = await clientLivraison().from("orders").select("restaurant_id, statut, est_test, mis_a_jour_le").eq("id", orderId).maybeSingle();
  return (data as { restaurant_id: string; statut: string; est_test: boolean; mis_a_jour_le: string } | null) ?? null;
}

/**
 * Le restaurant (ou le livreur qui a livré) note le client : étoiles et étiquettes seulement, jamais de texte libre, jamais public.
 * `restaurantId` (membre vérifié) ou `livreurId` (livreur de la livraison, vérifié ici) désigne l'auteur.
 */
export async function noterClient(args: {
  orderId: string;
  auteur: "restaurant" | "livreur";
  restaurantId?: string;
  livreurId?: string;
  utilisateurId: string;
  saisie: Omit<AvisSaisi, "auteur" | "cible">;
  maintenant?: Date;
}): Promise<Resultat> {
  const maintenant = args.maintenant ?? new Date();
  const commande = await commandeTerminee(args.orderId);
  if (!commande) return { ok: false, erreur: "Commande introuvable." };
  const raison = raisonNotationImpossible({ statut: commande.statut, estTest: commande.est_test, clotureLe: commande.mis_a_jour_le }, maintenant);
  if (raison) return { ok: false, erreur: messageRefus(raison) };

  let livreurId: string | null = null;
  if (args.auteur === "restaurant") {
    if (!args.restaurantId || commande.restaurant_id !== args.restaurantId) return { ok: false, erreur: "Commande introuvable." };
  } else {
    const { data } = await clientLivraison().from("livraisons").select("livreur_id, statut").eq("order_id", args.orderId).maybeSingle();
    const l = data as { livreur_id: string | null; statut: string } | null;
    if (!l || l.statut !== "livree" || !l.livreur_id || l.livreur_id !== args.livreurId) return { ok: false, erreur: "Livraison introuvable." };
    livreurId = l.livreur_id;
  }

  const v = validerAvis({ ...args.saisie, auteur: args.auteur, cible: "client" });
  if (!v.ok) return { ok: false, erreur: v.erreur };

  const { error } = await clientLivraison()
    .from("avis")
    .upsert(
      {
        order_id: args.orderId,
        cible: "client",
        auteur: args.auteur,
        restaurant_id: commande.restaurant_id,
        livreur_id: livreurId,
        auteur_utilisateur_id: args.utilisateurId,
        note: v.avis.note,
        etiquettes: v.avis.etiquettes,
        commentaire: null,
        est_test: commande.est_test,
        modifie_le: maintenant.toISOString(),
      },
      { onConflict: "order_id,cible,auteur" }
    );
  return error ? { ok: false, erreur: "Enregistrement impossible, réessayez." } : { ok: true };
}

export async function noteClientExistante(orderId: string, auteur: "restaurant" | "livreur"): Promise<{ note: number; etiquettes: string[] } | null> {
  const { data } = await clientLivraison().from("avis").select("note, etiquettes").eq("order_id", orderId).eq("cible", "client").eq("auteur", auteur).maybeSingle();
  const l = data as { note: number; etiquettes: string[] } | null;
  return l ? { note: l.note, etiquettes: l.etiquettes ?? [] } : null;
}

// ---------------------------------------------------------------- signalement (compte connecté)

export async function signalerAvis(args: { avisId: string; utilisateurId: string; motif: unknown }): Promise<Resultat> {
  const motif = typeof args.motif === "string" ? args.motif.replace(/\s+/g, " ").trim() : "";
  if (motif.length < 5 || motif.length > 300) return { ok: false, erreur: "Expliquez le problème en 5 à 300 caractères." };
  const db = clientLivraison();
  const { data } = await db.from("avis").select("id, cible, statut").eq("id", args.avisId).maybeSingle();
  const a = data as { cible: string; statut: string } | null;
  if (!a || a.cible !== "restaurant" || a.statut === "annule") return { ok: false, erreur: "Avis introuvable." };
  const { error } = await db.from("avis_signalements").insert({ avis_id: args.avisId, signale_par: args.utilisateurId, motif });
  if (error) return { ok: false, erreur: error.code === "23505" ? "Vous avez déjà signalé cet avis." : "Signalement impossible, réessayez." };
  return { ok: true };
}

// ---------------------------------------------------------------- exploitation : modération et alertes

export interface SignalementAdmin {
  id: string;
  avisId: string;
  motif: string;
  date: string;
  restaurantNom: string;
  note: number;
  commentaire: string | null;
  statutAvis: string;
}

export async function listerSignalementsEnAttente(): Promise<SignalementAdmin[]> {
  const { data } = await clientLivraison()
    .from("avis_signalements")
    .select("id, avis_id, motif, cree_le, avis(note, commentaire, statut, restaurants(nom))")
    .is("traite_le", null)
    .order("cree_le", { ascending: true })
    .limit(100);
  return ((data ?? []) as unknown as { id: string; avis_id: string; motif: string; cree_le: string; avis: { note: number; commentaire: string | null; statut: string; restaurants: { nom: string } | null } | null }[]).map((s) => ({
    id: s.id,
    avisId: s.avis_id,
    motif: s.motif,
    date: s.cree_le,
    restaurantNom: s.avis?.restaurants?.nom ?? "—",
    note: s.avis?.note ?? 0,
    commentaire: s.avis?.commentaire ?? null,
    statutAvis: s.avis?.statut ?? "",
  }));
}

export type ActionModeration = "masquer_commentaire" | "annuler_note" | "retablir" | "classer_sans_suite";

/** Le motif est obligatoire sauf pour « classer sans suite » : l'exploitation doit pouvoir expliquer chaque retrait. */
export async function modererAvis(args: { avisId: string; action: ActionModeration; motif: string; adminId: string }): Promise<Resultat> {
  const motif = args.motif.replace(/\s+/g, " ").trim().slice(0, 300);
  // Un motif est exigé pour RETIRER du contenu public (masquer, annuler) : il est journalisé. Rétablir ou classer sans suite n'en demande pas.
  if ((args.action === "masquer_commentaire" || args.action === "annuler_note") && motif.length < 5) return { ok: false, erreur: "Indiquez le motif (5 caractères au moins)." };
  const db = clientLivraison();
  const { data } = await db.from("avis").select("id, cible").eq("id", args.avisId).maybeSingle();
  if (!data || (data as { cible: string }).cible !== "restaurant") return { ok: false, erreur: "Avis introuvable." };

  if (args.action !== "classer_sans_suite") {
    const statut = args.action === "masquer_commentaire" ? "commentaire_masque" : args.action === "annuler_note" ? "annule" : "publie";
    const { error } = await db
      .from("avis")
      .update({ statut, motif_moderation: args.action === "retablir" ? null : motif, modifie_le: new Date().toISOString() })
      .eq("id", args.avisId);
    if (error) return { ok: false, erreur: "Modération impossible, réessayez." };
  }
  await db
    .from("avis_signalements")
    .update({ traite_le: new Date().toISOString(), traite_par: args.adminId })
    .eq("avis_id", args.avisId)
    .is("traite_le", null);
  return { ok: true };
}

export interface AlerteNotation {
  type: "restaurant_sous_seuil" | "livreur_sous_seuil" | "livreur_trois_mauvaises";
  cible: string;
  detail: string;
}

/** Restaurants et livreurs à surveiller : moyenne sous 3,5 avec 5 notes au moins, ou trois mauvaises notes de suite (livreur). */
export async function calculerAlertes(): Promise<AlerteNotation[]> {
  const db = clientLivraison();
  const alertes: AlerteNotation[] = [];
  const { data: restos } = await lireTout((de, a) => db.from("restaurants").select("nom, avis_somme, avis_total").gte("avis_total", 5).order("id").range(de, a));
  for (const r of (restos ?? []) as { nom: string; avis_somme: number; avis_total: number }[]) {
    if (sousLeSeuil(r.avis_somme, r.avis_total)) {
      alertes.push({ type: "restaurant_sous_seuil", cible: r.nom, detail: `${moyenne(r.avis_somme, r.avis_total)?.toLocaleString("fr-FR")} sur ${r.avis_total} avis` });
    }
  }
  const { data: notes } = await db
    .from("avis")
    .select("livreur_id, note, cree_le, livreurs(nom)")
    .eq("cible", "livreur")
    .eq("est_test", false)
    .in("statut", ["publie", "commentaire_masque"])
    .order("cree_le", { ascending: false })
    .limit(2000);
  const parLivreur = new Map<string, { nom: string; notes: number[] }>();
  for (const n of (notes ?? []) as unknown as { livreur_id: string | null; note: number; livreurs: { nom: string } | null }[]) {
    if (!n.livreur_id) continue;
    const e = parLivreur.get(n.livreur_id) ?? { nom: n.livreurs?.nom ?? "Livreur", notes: [] };
    e.notes.push(n.note);
    parLivreur.set(n.livreur_id, e);
  }
  for (const e of parLivreur.values()) {
    const somme = e.notes.reduce((a, b) => a + b, 0);
    if (sousLeSeuil(somme, e.notes.length)) {
      alertes.push({ type: "livreur_sous_seuil", cible: e.nom, detail: `${moyenne(somme, e.notes.length)?.toLocaleString("fr-FR")} sur ${e.notes.length} notes` });
    } else if (troisMauvaisesDeSuite(e.notes)) {
      alertes.push({ type: "livreur_trois_mauvaises", cible: e.nom, detail: "Trois mauvaises notes de suite" });
    }
  }
  return alertes;
}
