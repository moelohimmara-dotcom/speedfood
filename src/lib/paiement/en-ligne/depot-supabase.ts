import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { pointDuRestaurant } from "@/lib/livraison/lecture";
import type { Ecriture } from "./ecritures";
import type {
  Beneficiaire,
  CommandePourPaiement,
  CompteVersement,
  DepotPaiement,
  LigneLitige,
  LignePaiement,
  LigneVersement,
  NouveauPaiement,
  PatchPaiement,
  Reglages,
} from "./service";
import { estEtatPaiement, estOperateur } from "./types";

/**
 * Dépôt du paiement en ligne sur Supabase, en clé de service (la RLS est volontairement sans écriture pour les comptes : tout passe
 * par ici). Ne jamais importer depuis un composant client. Les garanties d'argent (état, équilibre du livre, unicités) sont portées par
 * la BASE (migration 20261021090000) ; ce dépôt les utilise, il ne les remplace pas.
 */

type Ligne = Record<string, unknown>;

const COLONNES_PAIEMENT =
  "id, order_id, restaurant_id, fournisseur, operateur, etat, repas_gnf, frais_livraison_gnf, total_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, rembourse_gnf, reference_interne, reference_externe";
const COLONNES_VERSEMENT = "id, paiement_id, beneficiaire_type, restaurant_id, livreur_id, operateur, montant_gnf, etat, reference_interne, reference_externe, tentatives";

const UNICITE = "23505";

function enPaiement(l: Ligne): LignePaiement {
  if (!estEtatPaiement(l.etat) || !estOperateur(l.operateur)) throw new Error("Paiement illisible.");
  return {
    id: String(l.id),
    orderId: String(l.order_id),
    restaurantId: String(l.restaurant_id),
    fournisseur: l.fournisseur === "chapchap" ? "chapchap" : "simulation",
    operateur: l.operateur,
    etat: l.etat,
    repasGnf: Number(l.repas_gnf),
    fraisLivraisonGnf: Number(l.frais_livraison_gnf),
    totalGnf: Number(l.total_gnf),
    livraisonPar: l.livraison_par as LignePaiement["livraisonPar"],
    fraisSpeedfoodGnf: Number(l.frais_speedfood_gnf),
    fraisMobileGnf: Number(l.frais_mobile_gnf),
    restaurantGnf: Number(l.restaurant_gnf),
    livreurGnf: Number(l.livreur_gnf),
    speedfoodBrutGnf: Number(l.speedfood_brut_gnf),
    rembourseGnf: Number(l.rembourse_gnf),
    referenceInterne: String(l.reference_interne),
    referenceExterne: typeof l.reference_externe === "string" ? l.reference_externe : null,
  };
}

function enVersement(l: Ligne): LigneVersement {
  return {
    id: String(l.id),
    paiementId: String(l.paiement_id),
    beneficiaire: l.beneficiaire_type === "livreur" ? "livreur" : "restaurant",
    restaurantId: typeof l.restaurant_id === "string" ? l.restaurant_id : null,
    livreurId: typeof l.livreur_id === "string" ? l.livreur_id : null,
    operateur: estOperateur(l.operateur) ? l.operateur : "orange_money",
    montantGnf: Number(l.montant_gnf),
    etat: l.etat as LigneVersement["etat"],
    referenceInterne: String(l.reference_interne),
    referenceExterne: typeof l.reference_externe === "string" ? l.reference_externe : null,
    tentatives: Number(l.tentatives),
  };
}

function colonnesPatch(patch: PatchPaiement): Ligne {
  const sortie: Ligne = {};
  if (patch.referenceExterne !== undefined) sortie.reference_externe = patch.referenceExterne;
  if (patch.expireLe !== undefined) sortie.expire_le = patch.expireLe;
  if (patch.confirmeLe !== undefined) sortie.confirme_le = patch.confirmeLe;
  if (patch.libereLe !== undefined) sortie.libere_le = patch.libereLe;
  if (patch.rembourseGnf !== undefined) sortie.rembourse_gnf = patch.rembourseGnf;
  return sortie;
}

export function creerDepotSupabase(db: SupabaseClient = creerClientAdmin() as unknown as SupabaseClient): DepotPaiement {
  async function un(table: "paiements", colonne: string, valeur: string): Promise<LignePaiement | null> {
    const { data } = await db.from(table).select(COLONNES_PAIEMENT).eq(colonne, valeur).maybeSingle();
    return data ? enPaiement(data as Ligne) : null;
  }

  return {
    async lireReglages(): Promise<Reglages> {
      const { data } = await db.from("parametres_paiement").select("*").maybeSingle();
      const r = (data ?? {}) as Ligne;
      return {
        actif: r.paiement_en_ligne_actif === true,
        fournisseur: r.fournisseur === "chapchap" ? "chapchap" : "simulation",
        tauxMobilePermille: { orange_money: Number(r.frais_mobile_permille_orange ?? 15), mtn_momo: Number(r.frais_mobile_permille_mtn ?? 17) },
        fraisSpeedfoodCommandeGnf: Number(r.frais_speedfood_commande_gnf ?? 1000),
        fraisVersementGnf: Number(r.frais_versement_gnf ?? 0),
        delaiExpirationMinutes: Number(r.delai_expiration_minutes ?? 15),
        plafondPaiementGnf: Number(r.plafond_paiement_gnf ?? 500000),
        plafondRemboursementAutoPermille: Number(r.plafond_remboursement_auto_permille ?? 300),
        seuilLitigeHumainGnf: Number(r.seuil_litige_humain_gnf ?? 50000),
      };
    },

    async lireCommande(orderId): Promise<CommandePourPaiement | null> {
      const { data: o } = await db.from("orders").select("id, restaurant_id, statut, mode, sous_total, frais_livraison_estime, paiement_mode, paiement_statut").eq("id", orderId).maybeSingle();
      if (!o) return null;
      const [depart, livraison] = await Promise.all([
        pointDuRestaurant(db, String(o.restaurant_id)),
        db.from("livraisons").select("livreur_id").eq("order_id", orderId).maybeSingle(),
      ]);
      const mode = depart.mode === "speedfood" ? "speedfood" : depart.mode === "aucune" ? "aucune" : "propre";
      const livreur = (livraison.data as Ligne | null)?.livreur_id;
      return {
        id: String(o.id),
        restaurantId: String(o.restaurant_id),
        statut: String(o.statut),
        mode: String(o.mode),
        sousTotalGnf: Number(o.sous_total),
        fraisLivraisonGnf: Number(o.frais_livraison_estime ?? 0),
        livraisonMode: mode,
        livreurId: typeof livreur === "string" ? livreur : null,
        paiementMode: typeof o.paiement_mode === "string" ? o.paiement_mode : null,
        paiementStatut: typeof o.paiement_statut === "string" ? o.paiement_statut : "non_demande",
      };
    },

    paiementParId: (id) => un("paiements", "id", id),
    paiementParCommande: (orderId) => un("paiements", "order_id", orderId),
    paiementParReferenceExterne: (r) => un("paiements", "reference_externe", r),
    paiementParReferenceInterne: (r) => un("paiements", "reference_interne", r),

    async creerPaiement(n: NouveauPaiement) {
      const { data, error } = await db
        .from("paiements")
        .insert({
          order_id: n.orderId,
          restaurant_id: n.restaurantId,
          fournisseur: n.fournisseur,
          operateur: n.operateur,
          repas_gnf: n.repasGnf,
          frais_livraison_gnf: n.fraisLivraisonGnf,
          livraison_par: n.livraisonPar,
          frais_speedfood_gnf: n.fraisSpeedfoodGnf,
          frais_mobile_gnf: n.fraisMobileGnf,
          restaurant_gnf: n.restaurantGnf,
          livreur_gnf: n.livreurGnf,
          speedfood_brut_gnf: n.speedfoodBrutGnf,
          reference_interne: n.referenceInterne,
          expire_le: n.expireLe,
        })
        .select(COLONNES_PAIEMENT)
        .single();
      if (error?.code === UNICITE) {
        // Deux demandes simultanées pour la même commande : la seconde retrouve le paiement de la première.
        const existant = await un("paiements", "order_id", n.orderId);
        if (existant) return existant;
      }
      if (error || !data) throw new Error("Création du paiement impossible.");
      return enPaiement(data as Ligne);
    },

    async changerEtat(id, de, vers, patch = {}) {
      const { data, error } = await db
        .from("paiements")
        .update({ etat: vers, ...colonnesPatch(patch) })
        .eq("id", id)
        .eq("etat", de)
        .select("id");
      if (error) return false; // transition refusée par la base (garde-fou) : jamais appliquée
      return Array.isArray(data) && data.length > 0;
    },

    async patcher(id, patch) {
      await db.from("paiements").update(colonnesPatch(patch)).eq("id", id);
    },

    async enregistrerEvenement(e) {
      const { error } = await db.from("paiement_evenements").insert({
        fournisseur: e.fournisseur,
        identifiant_evenement: e.identifiant,
        reference_externe: e.referenceExterne,
        etat_recu: e.etatRecu,
        montant_gnf: e.montantGnf,
        resultat: e.resultat,
      });
      if (error?.code === UNICITE) return false;
      if (error) throw new Error("Journal des notifications indisponible.");
      return true;
    },

    async paiementsAExpirer(avant, limite) {
      const { data } = await db.from("paiements").select("id, fournisseur").eq("etat", "en_attente").lt("expire_le", avant).limit(limite);
      return ((data ?? []) as Ligne[]).map((d) => ({ id: String(d.id), fournisseur: d.fournisseur === "chapchap" ? ("chapchap" as const) : ("simulation" as const) }));
    },

    async paiementsAReprendre(maxTentatives, limite) {
      const { data: versements } = await db.from("paiement_versements").select("paiement_id").in("etat", ["a_verser", "echoue"]).lt("tentatives", maxTentatives).limit(limite * 2);
      const ids = [...new Set(((versements ?? []) as Ligne[]).map((v) => String(v.paiement_id)))].slice(0, limite);
      if (ids.length === 0) return [];
      const { data } = await db.from("paiements").select("id, fournisseur").in("id", ids).eq("etat", "libere").limit(limite);
      return ((data ?? []) as Ligne[]).map((d) => ({ id: String(d.id), fournisseur: d.fournisseur === "chapchap" ? ("chapchap" as const) : ("simulation" as const) }));
    },

    async synchroniserCommande(orderId, situation) {
      // Jamais sur une commande payée par un autre mode : les conditions `paiement_mode = 'speedfood'` / `paiement_statut <> 'recu'` protègent le règlement classique.
      const maintenant = new Date().toISOString();
      if (situation === "en_cours") {
        await db.from("orders").update({ paiement_mode: "speedfood", paiement_statut: "non_demande", paiement_reference: null, paiement_declare_le: maintenant }).eq("id", orderId).neq("paiement_statut", "recu");
      } else if (situation === "payee") {
        await db.from("orders").update({ paiement_mode: "speedfood", paiement_statut: "recu", paiement_reference: null }).eq("id", orderId);
      } else {
        await db.from("orders").update({ paiement_mode: null, paiement_statut: "non_demande", paiement_reference: null, paiement_declare_le: null, paiement_recu_le: null }).eq("id", orderId).eq("paiement_mode", "speedfood");
      }
    },

    async ajouterEcritures(paiementId, cle, ecritures: readonly Ecriture[]) {
      // Une ligne par (compte, sens) : la base impose cette unicité par clé d'idempotence.
      const agregees = new Map<string, Ecriture>();
      for (const e of ecritures) {
        const k = `${e.compte}|${e.sens}`;
        const x = agregees.get(k);
        if (x) x.montantGnf += e.montantGnf;
        else agregees.set(k, { ...e });
      }
      if (agregees.size === 0) return true;
      const groupe = globalThis.crypto.randomUUID();
      const { error } = await db.from("paiement_ecritures").insert(
        [...agregees.values()].map((e) => ({ paiement_id: paiementId, groupe_id: groupe, cle_idempotence: cle, compte: e.compte, sens: e.sens, montant_gnf: e.montantGnf }))
      );
      if (error?.code === UNICITE) return false;
      if (error) throw new Error("Écriture du livre de comptes refusée.");
      return true;
    },

    async lireCompteVersement(b: Beneficiaire, proprietaireId): Promise<CompteVersement | null> {
      const colonne = b === "restaurant" ? "restaurant_id" : "livreur_id";
      const { data } = await db.from("comptes_versement").select("id, operateur, numero, verifie_le").eq(colonne, proprietaireId).eq("actif", true).maybeSingle();
      if (!data || !estOperateur(data.operateur)) return null;
      return { id: String(data.id), operateur: data.operateur, numero: String(data.numero), verifie: typeof data.verifie_le === "string" };
    },

    async creerVersement(v) {
      const { data, error } = await db
        .from("paiement_versements")
        .insert({
          paiement_id: v.paiementId,
          beneficiaire_type: v.beneficiaire,
          restaurant_id: v.restaurantId,
          livreur_id: v.livreurId,
          compte_versement_id: v.compteVersementId,
          operateur: v.operateur,
          numero_masque: v.numeroMasque,
          montant_gnf: v.montantGnf,
          reference_interne: v.referenceInterne,
        })
        .select(COLONNES_VERSEMENT)
        .single();
      if (error?.code === UNICITE) {
        const { data: existant } = await db.from("paiement_versements").select(COLONNES_VERSEMENT).eq("paiement_id", v.paiementId).eq("beneficiaire_type", v.beneficiaire).maybeSingle();
        if (existant) return enVersement(existant as Ligne);
      }
      if (error || !data) throw new Error("Création du versement impossible.");
      return enVersement(data as Ligne);
    },

    async versementsDuPaiement(paiementId) {
      const { data } = await db.from("paiement_versements").select(COLONNES_VERSEMENT).eq("paiement_id", paiementId).limit(4);
      return ((data ?? []) as Ligne[]).map(enVersement);
    },

    async versementParId(id) {
      const { data } = await db.from("paiement_versements").select(COLONNES_VERSEMENT).eq("id", id).maybeSingle();
      return data ? enVersement(data as Ligne) : null;
    },

    async versementParReferenceExterne(reference) {
      const { data } = await db.from("paiement_versements").select(COLONNES_VERSEMENT).eq("reference_externe", reference).maybeSingle();
      return data ? enVersement(data as Ligne) : null;
    },

    async reserverVersement(id, depuis) {
      const { data: v } = await db.from("paiement_versements").select("tentatives").eq("id", id).maybeSingle();
      if (!v) return false;
      const { data, error } = await db
        .from("paiement_versements")
        .update({ etat: "envoye", tentatives: Number(v.tentatives) + 1, mis_a_jour_le: new Date().toISOString() })
        .eq("id", id)
        .eq("tentatives", v.tentatives)
        .in("etat", [...depuis])
        .select("id");
      return !error && Array.isArray(data) && data.length > 0;
    },

    async majVersement(id, patch) {
      const colonnes: Ligne = { mis_a_jour_le: new Date().toISOString() };
      if (patch.etat) colonnes.etat = patch.etat;
      if (patch.referenceExterne) colonnes.reference_externe = patch.referenceExterne;
      if (patch.tentatives !== undefined) colonnes.tentatives = patch.tentatives;
      if (patch.erreurCode !== undefined) colonnes.erreur_code = patch.erreurCode;
      await db.from("paiement_versements").update(colonnes).eq("id", id);
    },

    async creerLitige(l): Promise<LigneLitige> {
      const { data, error } = await db
        .from("litiges_paiement")
        .insert({ paiement_id: l.paiementId, ouvert_par: l.ouvertPar, situation: l.situation, montant_demande_gnf: l.montantDemandeGnf, preuve_fournie: l.preuveFournie })
        .select("id, paiement_id, situation, etat")
        .single();
      if (error || !data) throw new Error("Ouverture du litige impossible.");
      return { id: String(data.id), paiementId: String(data.paiement_id), situation: data.situation as LigneLitige["situation"], etat: data.etat as LigneLitige["etat"] };
    },

    async litigesOuverts(paiementId) {
      const { data } = await db.from("litiges_paiement").select("id, paiement_id, situation, etat").eq("paiement_id", paiementId).in("etat", ["ouvert", "a_humain"]).limit(20);
      return ((data ?? []) as Ligne[]).map((d) => ({ id: String(d.id), paiementId: String(d.paiement_id), situation: d.situation as LigneLitige["situation"], etat: d.etat as LigneLitige["etat"] }));
    },

    async majLitige(id, patch) {
      const colonnes: Ligne = { etat: patch.etat };
      if (patch.decision) colonnes.decision = patch.decision;
      if (patch.regle) colonnes.regle = patch.regle;
      if (patch.remboursementGnf !== undefined) colonnes.remboursement_gnf = patch.remboursementGnf;
      if (patch.motifCloture !== undefined) colonnes.motif_cloture = patch.motifCloture;
      if (patch.etat === "decide_auto" || patch.etat === "clos" || patch.etat === "a_humain") colonnes.decide_le = new Date().toISOString();
      if (patch.etat === "clos") colonnes.clos_le = new Date().toISOString();
      await db.from("litiges_paiement").update(colonnes).eq("id", id);
    },
  };
}
