import { versModeCommande } from "./mode";
import "server-only";
import type {
  ApercuCommandeRestaurant,
  EvenementStatutCommande,
  LigneCommandeApercu,
  ModeRetrait,
  PropositionRevisee,
  SuiviCommande,
} from "@/lib/contracts/commande";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import type { ClientCommandeDb } from "./commun";
import { versStatutCommande, versStatutProposition } from "./commun";
import { estJetonValide } from "./jetons";
import {
  lirePropositions,
  propositionActiveParmi,
  traiterPropositionEchue,
} from "./propositions";
import { calculerEtatDerive } from "./transitions";
import { optionsPaiement, paiementOuvert, type ModePaiement, type OptionPaiement, type StatutPaiement } from "@/lib/paiement/regles";

/**
 * Modèles de lecture du bloc 7.
 *
 * Le suivi client est lu avec le client service-role (ADR-011 : aucune policy
 * anon sur les tables de commande) mais SANS jamais sélectionner le téléphone ni
 * l'adresse : le type `SuiviCommande` ne les contient pas, la requête non plus —
 * la confidentialité ne repose pas sur un simple filtrage d'affichage.
 */

const CHAMPS_PROPOSITION =
  "id, order_id, version, nouveau_sous_total, nouveaux_frais_livraison, conditions_modifiees, statut, expire_le, cree_le, repondu_le";

interface LignePropositionDb {
  id: string;
  order_id: string;
  version: number;
  nouveau_sous_total: number;
  nouveaux_frais_livraison: number;
  conditions_modifiees: string | null;
  statut: string;
  expire_le: string | null;
  cree_le: string;
  repondu_le: string | null;
}

function versProposition(ligne: LignePropositionDb): PropositionRevisee {
  return {
    id: ligne.id,
    commandeId: ligne.order_id,
    version: ligne.version,
    nouveauSousTotal: ligne.nouveau_sous_total,
    nouveauxFraisLivraison: ligne.nouveaux_frais_livraison,
    conditionsModifiees: ligne.conditions_modifiees,
    statut: versStatutProposition(ligne.statut),
    expireLe: ligne.expire_le,
    creeLe: ligne.cree_le,
    reponduLe: ligne.repondu_le,
  };
}

function versStatutPaiement(valeur: string | null | undefined): StatutPaiement {
  return valeur === "especes" || valeur === "declare" || valeur === "recu" || valeur === "non_recu" ? valeur : "non_demande";
}

function versModePaiement(valeur: string | null | undefined): ModePaiement | null {
  return valeur === "especes" || valeur === "orange_money" || valeur === "mtn_momo" ? valeur : null;
}

function versMode(valeur: string): ModeRetrait {
  return versModeCommande(valeur);
}

/**
 * Charge la vue de suivi d'une commande à partir de son jeton opaque.
 * `null` si le jeton est malformé ou inconnu (404 côté page, aucune fuite).
 */
export async function chargerSuiviParJeton(jeton: string): Promise<SuiviCommande | null> {
  if (!estJetonValide(jeton)) {
    return null;
  }
  const db = creerClientAdmin();

  const { data: commande, error } = await db
    .from("orders")
    .select(
      "id, reference, mode, table_numero, sous_total, frais_livraison_estime, statut, cree_le, restaurants(id, nom, horaires, consignes, ouvert, moyens_paiement)"
    )
    .eq("jeton_suivi", jeton)
    .maybeSingle();

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de charger le suivi. Réessayez.");
  }
  if (!commande) {
    return null;
  }

  // Une proposition échue (si elle existe) est traitée avant l'affichage.
  await traiterPropositionEchue(commande.id);

  const [{ data: fraiche }, { data: lignes }, { data: evenements }, propositions] =
    await Promise.all([
      db
        .from("orders")
        .select("statut, sous_total, frais_livraison_estime, paiement_statut, paiement_mode, paiement_reference, paiement_declare_le, paiement_recu_le")
        .eq("id", commande.id)
        .maybeSingle(),
      db
        .from("order_items")
        .select("nom, prix, quantite, order_item_options(nom, prix)")
        .eq("order_id", commande.id)
        .order("nom"),
      db
        .from("order_status_events")
        .select("statut_precedent, statut_suivant, acteur, horodatage")
        .eq("order_id", commande.id)
        .order("horodatage", { ascending: true }),
      lirePropositions(db, commande.id),
    ]);

  const statut = versStatutCommande(fraiche?.statut ?? commande.statut);
  const propositionActive = propositionActiveParmi(propositions);

  const restaurantLie = commande.restaurants;
  const restaurant = Array.isArray(restaurantLie) ? restaurantLie[0] : restaurantLie;

  // Les codes marchands ne sont lus (clé serveur) que lorsque le paiement est ouvert : commande acceptée, aucune proposition
  // de prix en cours, paiement pas encore confirmé. Ils ne sortent jamais d'une page publique non liée à un jeton.
  const statutPaiement = versStatutPaiement(fraiche?.paiement_statut);
  const modePaiement = versModePaiement(fraiche?.paiement_mode);
  let options: OptionPaiement[] = [];
  if (restaurant && statutPaiement !== "recu" && paiementOuvert(statut, propositionActive !== null)) {
    const { data: codes } = await db.from("restaurant_codes_marchand").select("orange, mtn").eq("restaurant_id", restaurant.id).maybeSingle();
    options = optionsPaiement(restaurant.moyens_paiement ?? [], { orange: codes?.orange ?? null, mtn: codes?.mtn ?? null });
  }

  return {
    reference: commande.reference,
    statut,
    etatDerive: calculerEtatDerive(statut, propositionActive),
    mode: versMode(commande.mode),
    tableNumero: commande.table_numero ?? null,
    creeLe: commande.cree_le,
    restaurant: {
      id: restaurant?.id ?? "",
      nom: restaurant?.nom ?? "",
      horaires: restaurant?.horaires ?? "",
      consignes: restaurant?.consignes ?? null,
      ouvert: restaurant?.ouvert ?? true,
    },
    lignes: (lignes ?? []).map(
      (l): LigneCommandeApercu => ({
        nom: l.nom,
        prix: l.prix,
        quantite: l.quantite,
        options: (l.order_item_options ?? []).map((o) => ({ nom: o.nom, prix: o.prix })),
      })
    ),
    sousTotal: fraiche?.sous_total ?? commande.sous_total,
    fraisLivraisonEstime: fraiche?.frais_livraison_estime ?? commande.frais_livraison_estime,
    propositionActive,
    paiement: {
      statut: statutPaiement,
      mode: modePaiement,
      reference: fraiche?.paiement_reference ?? null,
      declareLe: fraiche?.paiement_declare_le ?? null,
      recuLe: fraiche?.paiement_recu_le ?? null,
      options,
    },
    historiqueStatuts: (evenements ?? []).map(
      (e): EvenementStatutCommande => ({
        commandeId: commande.id,
        statutPrecedent: e.statut_precedent ? versStatutCommande(e.statut_precedent) : null,
        statutSuivant: versStatutCommande(e.statut_suivant),
        acteur: e.acteur,
        horodatage: e.horodatage,
      })
    ),
  };
}

/**
 * Vue console restaurant : commandes du restaurant connecté, avec leurs lignes
 * (instantané), leur état dérivé et leur proposition active. Lu avec le client
 * de la session membre : la RLS `membres_lecture_leurs_commandes` est la source
 * d'autorité (restaurant A ne voit jamais restaurant B).
 */
export async function chargerApercusCommandes(
  db: ClientCommandeDb,
  restaurantId: string
): Promise<ApercuCommandeRestaurant[]> {
  const { data: commandes, error } = await db
    .from("orders")
    .select(
      `id, reference, client_nom, client_telephone, client_adresse, mode, table_numero, sous_total, frais_livraison_estime, statut, cree_le, jeton_suivi, paiement_statut, paiement_mode, paiement_reference, paiement_recu_le, order_items(nom, prix, quantite, order_item_options(nom, prix)), order_proposals(${CHAMPS_PROPOSITION})`
    )
    .eq("restaurant_id", restaurantId)
    .order("cree_le", { ascending: false });

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de charger les commandes. Réessayez.");
  }

  const apercus: ApercuCommandeRestaurant[] = [];
  for (const commande of commandes ?? []) {
    let statut = versStatutCommande(commande.statut);
    let propositionsBrutes = (commande.order_proposals ?? []) as LignePropositionDb[];

    // Une proposition échue est traitée par le système avant l'affichage.
    const echue = propositionsBrutes.find(
      (p) =>
        p.statut === "en_attente" && p.expire_le !== null && new Date(p.expire_le) <= new Date()
    );
    if (echue) {
      await traiterPropositionEchue(commande.id);
      statut = "annulee";
      propositionsBrutes = propositionsBrutes.map((p) =>
        p.id === echue.id ? { ...p, statut: "expiree" } : p
      );
    }

    const propositions = propositionsBrutes.map(versProposition);
    const propositionActive = propositionActiveParmi(propositions);

    apercus.push({
      id: commande.id,
      reference: commande.reference,
      statut,
      etatDerive: calculerEtatDerive(statut, propositionActive),
      mode: versMode(commande.mode),
      tableNumero: commande.table_numero ?? null,
      clientNom: commande.client_nom,
      clientTelephone: commande.client_telephone,
      clientAdresse: commande.client_adresse,
      sousTotal: commande.sous_total,
      fraisLivraisonEstime: commande.frais_livraison_estime,
      creeLe: commande.cree_le,
      lignes: (commande.order_items ?? []).map(
        (l): LigneCommandeApercu => ({
          nom: l.nom,
          prix: l.prix,
          quantite: l.quantite,
          options: (l.order_item_options ?? []).map((o) => ({ nom: o.nom, prix: o.prix })),
        })
      ),
      propositionActive,
      paiementStatut: versStatutPaiement(commande.paiement_statut),
      paiementMode: versModePaiement(commande.paiement_mode),
      paiementReference: commande.paiement_reference,
      paiementRecuLe: commande.paiement_recu_le,
      jetonSuivi: commande.jeton_suivi,
    });
  }
  return apercus;
}
