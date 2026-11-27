import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { CreationCommandePayload } from "@/lib/contracts/commande";
import { creerClientAdmin } from "@/lib/db/admin";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { recalculerLignes, verifierRestaurantCommandable } from "./calculs";
import { genererJetonSuivi, genererReference, estJetonValide } from "./jetons";
import { appliquerTransitionStatut, enregistrerEvenementStatut } from "./transitions";
import { clientLivraison } from "@/lib/livraison/lecture";
import { estReglageValidation, estServiceTable, prochainNumeroAppel, validationRequise } from "@/lib/table/regles";
import { cleDeTableValide } from "@/lib/table/cle";
import { ouvrirOuRejoindreSession } from "@/lib/table/service";
import { estimerLivraison } from "@/lib/livraison/lecture";
import { calculerRemise, normaliserCode, type Campagne } from "@/lib/system-admin/campagnes-regles";

/**
 * Création d'une commande invitée (ADR-005).
 *
 * ADR-011 : les tables `orders` / `order_items` / `order_status_events` n'ont
 * aucune policy RLS pour `anon` (voir supabase/migrations/20260927150300_rls.sql,
 * note de tête de fichier). La création passe donc par le client service-role,
 * exclusivement depuis ce module serveur — jamais depuis le navigateur.
 *
 * Idempotence (schéma gelé, pas de table dédiée) : le `jeton_suivi` est dérivé
 * de façon déterministe de la clé d'idempotence du navigateur (jetons.ts). La
 * contrainte UNIQUE sur `orders.jeton_suivi` fait office de garde-fou : en cas
 * de double soumission (retry réseau, double clic), la commande existante est
 * renvoyée comme succès idempotent.
 */

export interface CommandeCreee {
  id: string;
  reference: string;
  jeton: string;
  idempotent: boolean;
  /** Commande passée par l'équipe du restaurant ou un administrateur : suit le parcours complet mais n'entre dans aucun chiffre. */
  estTest: boolean;
}

/**
 * Une commande est « de test » quand son auteur fait partie de l'équipe du restaurant commandé, ou est administrateur système.
 * Décidé ICI, côté serveur, d'après le compte de la session : jamais d'un paramètre du navigateur. Le marquage est ensuite
 * immuable (déclencheur `fn_proteger_colonnes_commande`) et exclu des statistiques d'administration.
 */
async function auteurEstDeLEquipe(
  db: ReturnType<typeof creerClientAdmin>,
  restaurantId: string,
  utilisateurId: string
): Promise<boolean> {
  const [{ data: membre }, { data: admin }] = await Promise.all([
    db.from("restaurant_memberships").select("utilisateur_id").eq("restaurant_id", restaurantId).eq("utilisateur_id", utilisateurId).maybeSingle(),
    db.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", utilisateurId).maybeSingle(),
  ]);
  return membre !== null || admin !== null;
}

function estViolationUniqueJeton(error: { code?: string; message: string }): boolean {
  return error.code === "23505" && error.message.includes("jeton_suivi");
}

function estViolationUniqueNumeroAppel(error: { code?: string; message: string }): boolean {
  return error.code === "23505" && error.message.includes("numero_appel");
}

/** Dernier numéro d'appel du jour (Conakry est à l'heure UTC) pour ce restaurant. */
async function dernierNumeroAppelDuJour(restaurantId: string): Promise<number | null> {
  const debut = new Date();
  debut.setUTCHours(0, 0, 0, 0);
  const { data } = await clientLivraison()
    .from("orders")
    .select("numero_appel")
    .eq("restaurant_id", restaurantId)
    .gte("cree_le", debut.toISOString())
    .not("numero_appel", "is", null)
    .order("numero_appel", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { numero_appel: number } | null)?.numero_appel ?? null;
}

/**
 * Numéro d'appel du comptoir, attribué de façon ATOMIQUE par la base (compteur par restaurant et par jour, `fn_attribuer_numero_appel`) : deux
 * clients qui commandent dans la même fraction de seconde reçoivent deux numéros différents. L'ancienne méthode (relire le dernier numéro, ajouter 1,
 * insérer) perdait la plupart des commandes simultanées (essais de concurrence du 19 octobre 2026). Repli sur l'ancienne méthode si la fonction est
 * absente (migration non appliquée) ou en panne : mieux vaut un numéro probable qu'une commande refusée.
 */
async function attribuerNumeroAppel(restaurantId: string): Promise<number> {
  const { data, error } = await clientLivraison().rpc("fn_attribuer_numero_appel", { p_restaurant: restaurantId });
  if (!error && typeof data === "number" && Number.isInteger(data) && data > 0) return data;
  return prochainNumeroAppel(await dernierNumeroAppelDuJour(restaurantId));
}

function estViolationUniqueReference(error: { code?: string; message: string }): boolean {
  return error.code === "23505" && error.message.includes("reference");
}

/**
 * Un rejeu idempotent ne doit jamais renvoyer la commande d'un AUTRE restaurant que
 * celui demandé : la clé n'est pas un secret partageable (revue de sécurité, point 10).
 */
function verifierMemeRestaurant(restaurantExistant: string, restaurantDemande: string): void {
  if (restaurantExistant !== restaurantDemande) {
    throw new ErreurMetier("VALIDATION", "Cette commande ne peut pas être rejouée. Rechargez la page.");
  }
}

/**
 * `utilisateurId` : compte identifié qui envoie la commande (obligatoire, TDR v0.2 §5.1). Un rejeu idempotent
 * ne rend jamais la commande d'un autre compte.
 */
export interface OptionsCreation {
  /** Dépendance serveur uniquement ; jamais extraite du payload public. Sans fournisseur, chemin historique du site. */
  fournirJeton?: (cle: string) => Promise<string>;
  /**
   * Commande saisie par un membre du restaurant (mode serveur) : `saisiePar` est son compte, DÉJÀ vérifié par l'appelant et revérifié ici.
   * Elle est toujours à table, jamais de test, et passe directement en cuisine (le personnel est la validation).
   */
  saisiePar?: string;
}

export async function creerCommande(payload: CreationCommandePayload, utilisateurId: string | null, options: OptionsCreation = {}): Promise<CommandeCreee> {
  const saisiePar = options.saisiePar ?? null;
  const jeton = options.fournirJeton ? await options.fournirJeton(payload.cleIdempotence) : genererJetonSuivi(payload.cleIdempotence);
  if (!estJetonValide(jeton)) throw new Error("calcul_jeton_indisponible");
  const db = creerClientAdmin();
  // Table `campagnes` pas encore dans les types générés : accès libre, colonnes relues et validées à la main ci-dessous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table absente des types générés (migrations campagnes et score)
  const campagnesDb = db as unknown as { from: (table: string) => any };
  if (saisiePar !== null) {
    if (utilisateurId !== null || payload.mode !== "sur_place") {
      throw new ErreurMetier("VALIDATION", "Commande de salle invalide.");
    }
    const { data: membre } = await db.from("restaurant_memberships").select("utilisateur_id").eq("restaurant_id", payload.restaurantId).eq("utilisateur_id", saisiePar).maybeSingle();
    if (!membre) throw new ErreurMetier("NON_AUTORISE", "Vous ne faites pas partie de ce restaurant.");
  }

  // Rejeu idempotent : la commande existe déjà pour cette clé d'idempotence.
  const { data: existante } = await db
    .from("orders")
    .select("id, reference, jeton_suivi, restaurant_id, client_user_id, est_test")
    .eq("jeton_suivi", jeton)
    .maybeSingle();
  if (existante) {
    verifierMemeRestaurant(existante.restaurant_id, payload.restaurantId);
    if (existante.client_user_id !== null && existante.client_user_id !== utilisateurId) {
      throw new ErreurMetier("VALIDATION", "Cette commande ne peut pas être rejouée. Rechargez la page.");
    }
    return {
      id: existante.id,
      reference: existante.reference,
      jeton: existante.jeton_suivi,
      idempotent: true,
      estTest: existante.est_test,
    };
  }

  // Recalcul serveur systématique : prix et totaux du navigateur ignorés.
  await verifierRestaurantCommandable(db, payload.restaurantId);
  // Le service à table n'existe que si le restaurant l'a activé : un numéro de table venu d'un QR ou du navigateur n'autorise rien.
  let serviceTable: "table" | "comptoir" = "table";
  let reglageValidation: "aucune" | "premiere" | "toutes" = "premiere";
  if (payload.mode === "sur_place") {
    if (!(await fonctionnaliteActive("commande_a_table"))) {
      throw new ErreurMetier("VALIDATION", "La commande à table est momentanément indisponible. Choisissez « À emporter » ou « Livraison ».");
    }
    const { data: resto } = await clientLivraison()
      .from("restaurants")
      .select("accepte_sur_place, service_table, table_sans_compte, table_validation")
      .eq("id", payload.restaurantId)
      .maybeSingle();
    const r = resto as { accepte_sur_place: boolean; service_table?: string; table_sans_compte?: boolean; table_validation?: string } | null;
    if (!r?.accepte_sur_place) {
      throw new ErreurMetier("VALIDATION", "Ce restaurant ne prend pas les commandes à table. Choisissez « À emporter » ou « Livraison ».", {
        mode: "Service à table indisponible.",
      });
    }
    if (estServiceTable(r.service_table)) serviceTable = r.service_table;
    if (estReglageValidation(r.table_validation)) reglageValidation = r.table_validation;
    // Convive sans compte : seulement si CE restaurant l'a autorisé (dérogation décidée restaurant par restaurant, docs/COMMANDE-SUR-PLACE.md).
    if (utilisateurId === null && saisiePar === null && !r.table_sans_compte) {
      throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous pour envoyer votre commande.");
    }
  } else if (utilisateurId === null && saisiePar === null) {
    throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous pour envoyer votre commande.");
  }
  const { lignes, sousTotal } = await recalculerLignes(
    db,
    payload.restaurantId,
    payload.lignes
  );

  // Code promo : revérifié en base (campagne active, période, minimum, plafond), remise déduite du sous-total stocké.
  // L'utilisation est comptée par un compare-and-set sur le compteur, avant l'insertion ; tout échec ultérieur la rend.
  let campagnePromo: Campagne | null = null;
  let remisePromo = 0;
  let promoCompte = false;
  const rendreUtilisationPromo = async () => {
    if (!campagnePromo || !promoCompte) return;
    promoCompte = false;
    for (let essai = 0; essai < 5; essai++) {
      const { data: actuelle, error: erreurLecture } = await campagnesDb.from("campagnes").select("utilisations").eq("id", campagnePromo.id).maybeSingle();
      if (erreurLecture || !actuelle || actuelle.utilisations <= 0) {
        if (erreurLecture) console.error("promo_rendre_echec", { campagne: campagnePromo.id });
        return;
      }
      const { data: touchees, error: erreurMaj } = await campagnesDb.from("campagnes").update({ utilisations: actuelle.utilisations - 1 }).eq("id", campagnePromo.id).eq("utilisations", actuelle.utilisations).select("id");
      if (erreurMaj) { console.error("promo_rendre_echec", { campagne: campagnePromo.id }); return; }
      if (touchees && touchees.length > 0) return;
    }
    console.error("promo_rendre_echec", { campagne: campagnePromo.id });
  };
  if (payload.codePromo) {
    const code = normaliserCode(payload.codePromo);
    const { data: ligneCampagne, error: erreurCampagne } = await campagnesDb.from("campagnes").select("id, code, nom, type_remise, valeur, minimum_achat_gnf, plafond_montant_gnf, plafond_utilisations, utilisations, debut, fin, etat, ciblage").eq("code", code).maybeSingle();
    if (erreurCampagne) throw new ErreurMetier("ERREUR_SERVEUR", "Les codes promo sont momentanément illisibles. Réessayez dans un instant.");
    if (!ligneCampagne) throw new ErreurMetier("VALIDATION", "Code promo inconnu. Vérifiez le code, ou retirez-le pour commander sans remise.", { codePromo: "Code promo inconnu." });
    campagnePromo = {
      id: ligneCampagne.id, code: ligneCampagne.code, nom: ligneCampagne.nom,
      regle: { type: ligneCampagne.type_remise === "montant" ? "montant" : "pourcentage", valeur: ligneCampagne.valeur, minimumAchatGnf: ligneCampagne.minimum_achat_gnf },
      plafondMontantGnf: ligneCampagne.plafond_montant_gnf, plafondUtilisations: ligneCampagne.plafond_utilisations, utilisations: ligneCampagne.utilisations,
      debut: ligneCampagne.debut, fin: ligneCampagne.fin, etat: ligneCampagne.etat === "active" || ligneCampagne.etat === "suspendue" ? ligneCampagne.etat : "brouillon", ciblage: ligneCampagne.ciblage,
    };
    const calcul = calculerRemise(campagnePromo, sousTotal, new Date());
    if (!calcul.ok) throw new ErreurMetier("VALIDATION", `${calcul.erreur} ${calcul.action}`, { codePromo: calcul.erreur });
    remisePromo = calcul.remiseGnf;
    // Ciblage « nouveaux clients » : aucune commande antérieure pour ce compte (un invité à table est traité comme nouveau, faute d'historique).
    if (/nouveaux?\s+clients?/i.test(campagnePromo.ciblage) && utilisateurId !== null) {
      const { count, error: erreurAnciennete } = await db.from("orders").select("id", { count: "exact", head: true }).eq("client_user_id", utilisateurId);
      if (erreurAnciennete) throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de vérifier si ce code vous est destiné. Réessayez dans un instant.");
      if ((count ?? 0) > 0) throw new ErreurMetier("VALIDATION", "Ce code est réservé aux nouveaux clients.", { codePromo: "Code réservé aux nouveaux clients." });
    }
  }
  // Comptage seulement au moment d'insérer (après toutes les validations) : aucun échec de livraison ou de table ne consomme une utilisation.
  const compterUtilisationPromo = async () => {
    if (!campagnePromo) return;
    const maintenantIso = new Date().toISOString();
    for (let essai = 0; essai < 5 && !promoCompte; essai++) {
      const { data: actuelle, error: erreurLecture } = await campagnesDb.from("campagnes").select("utilisations, plafond_utilisations").eq("id", campagnePromo.id).maybeSingle();
      if (erreurLecture) throw new ErreurMetier("ERREUR_SERVEUR", "Les codes promo sont momentanément illisibles. Réessayez dans un instant.");
      if (!actuelle) throw new ErreurMetier("VALIDATION", "Code promo inconnu. Vérifiez le code, ou retirez-le pour commander sans remise.", { codePromo: "Code promo inconnu." });
      if (actuelle.utilisations >= actuelle.plafond_utilisations) throw new ErreurMetier("VALIDATION", "Code expiré ou plafond atteint. Choisissez un autre code.", { codePromo: "Code expiré ou plafond atteint." });
      // Le CAS revérifie l'état et la période au moment même du comptage : une suspension ou l'échéance survenue entre-temps refuse le comptage.
      const { data: touchees, error: erreurMaj } = await campagnesDb.from("campagnes").update({ utilisations: actuelle.utilisations + 1 }).eq("id", campagnePromo.id).eq("utilisations", actuelle.utilisations).eq("etat", "active").lte("debut", maintenantIso).gt("fin", maintenantIso).select("id");
      if (erreurMaj) throw new ErreurMetier("ERREUR_SERVEUR", "Les codes promo sont momentanément illisibles. Réessayez dans un instant.");
      if (touchees && touchees.length > 0) promoCompte = true;
    }
    if (!promoCompte) throw new ErreurMetier("VALIDATION", "Code expiré ou plafond atteint. Choisissez un autre code.", { codePromo: "Code expiré ou plafond atteint." });
  };
  const sousTotalStocke = sousTotal - remisePromo;

  // Le client doit avoir vu le bon total : si un prix a changé entre l'affichage et
  // l'envoi, rien n'est créé et le nouveau total lui est présenté (revue de sécurité,
  // point 8). Le prix utilisé reste TOUJOURS celui du serveur.
  if (payload.sousTotalAffiche !== sousTotal) {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      `Les prix ont changé : le total est maintenant de ${sousTotal.toLocaleString("fr-FR")} GNF (au lieu de ${payload.sousTotalAffiche.toLocaleString("fr-FR")} GNF). Vérifiez, puis confirmez de nouveau.`,
      { sousTotalServeur: String(sousTotal) }
    );
  }

  // Livraison : frais calculés ICI (distance, réglages de la console), jamais d'après le navigateur. Tant que l'interrupteur
  // du calcul est éteint, rien ne change : frais à 0, à convenir avec le restaurant, comme avant.
  let fraisLivraison = 0;
  let livraisonDistanceM: number | null = null;
  let livraisonGratuite = false;
  let livraisonPoint: { latitude: number; longitude: number } | null = null;
  if (payload.mode === "livraison") {
    const estimation = await estimerLivraison(payload.restaurantId, payload.destination ?? null, sousTotalStocke);
    if (estimation.statut === "erreur") {
      throw new ErreurMetier("VALIDATION", estimation.message, { livraison: estimation.message });
    }
    if (estimation.statut === "ok") {
      // Le client doit avoir vu les bons frais : sinon rien n'est créé et le nouveau montant lui est présenté.
      if (payload.fraisAffiches !== estimation.fraisGnf) {
        throw new ErreurMetier(
          "CONFLIT_ETAT",
          `Les frais de livraison ont changé : ${estimation.fraisGnf.toLocaleString("fr-FR")} GNF (au lieu de ${(payload.fraisAffiches ?? 0).toLocaleString("fr-FR")} GNF). Vérifiez, puis confirmez de nouveau.`,
          { fraisServeur: String(estimation.fraisGnf) }
        );
      }
      fraisLivraison = estimation.fraisGnf;
      livraisonDistanceM = Math.round(estimation.distanceKm * 1000);
      livraisonGratuite = estimation.gratuite;
      livraisonPoint = estimation.arrivee;
    }
  }

  // Une commande saisie par le personnel est une vraie commande (jamais de test) ; une commande passée avec un compte de l'équipe reste de test.
  const estTest = utilisateurId === null ? false : await auteurEstDeLEquipe(db, payload.restaurantId, utilisateurId);

  // Commande sur place : session de table (service à table) ou numéro d'appel (comptoir), et validation éventuelle par le personnel.
  let sessionId: string | null = null;
  let validerAvantPreparation = false;
  if (payload.mode === "sur_place") {
    if (serviceTable === "table") {
      // Un client (compte ou invité) ne commande à table qu'avec la clé du QR de SA table : le numéro seul ne prouve rien (revue du 19 octobre
      // 2026, I-1). La saisie par le personnel passe par son propre contrôle d'appartenance et n'a pas besoin de la clé.
      if (saisiePar === null && !cleDeTableValide(payload.restaurantId, payload.table, payload.cleTable)) {
        throw new ErreurMetier("VALIDATION", "Scannez le QR code affiché sur votre table pour commander à table.");
      }
      const session = await ouvrirOuRejoindreSession(clientLivraison(), payload.restaurantId, payload.table ?? "");
      if (!session) throw new ErreurMetier("ERREUR_SERVEUR", "Impossible d'ouvrir la table. Réessayez dans un instant.");
      sessionId = session.id;
      validerAvantPreparation = saisiePar === null && validationRequise({ reglage: reglageValidation, tableDejaValidee: session.valideeLe !== null, sansCompte: utilisateurId === null });
    } else {
      // Comptoir : pas de table à suivre ; « première » n'a pas de sens, seule « toutes » valide tout (le convive sans compte est toujours validé).
      validerAvantPreparation = saisiePar === null && validationRequise({ reglage: reglageValidation === "premiere" ? "aucune" : reglageValidation, tableDejaValidee: false, sansCompte: utilisateurId === null });
    }
  }

  try {
    await compterUtilisationPromo();
  } catch (echecPromo) {
    // Course entre soumissions jumelles : si la commande de la jumelle existe déjà, c'est un succès idempotent, pas un plafond.
    const { data: concurrentePromo } = await db.from("orders").select("id, reference, jeton_suivi, restaurant_id, client_user_id, est_test").eq("jeton_suivi", jeton).maybeSingle();
    if (concurrentePromo) {
      verifierMemeRestaurant(concurrentePromo.restaurant_id, payload.restaurantId);
      if (concurrentePromo.client_user_id !== null && concurrentePromo.client_user_id !== utilisateurId) throw new ErreurMetier("VALIDATION", "Cette commande ne peut pas être rejouée. Rechargez la page.");
      return { id: concurrentePromo.id, reference: concurrentePromo.reference, jeton: concurrentePromo.jeton_suivi, idempotent: true, estTest: concurrentePromo.est_test };
    }
    throw echecPromo;
  }

  // Trois tentatives au cas (rare) où la référence aléatoire serait déjà prise.
  for (let tentative = 0; tentative < 3; tentative += 1) {
    const reference = genererReference();
    const numeroAppel = payload.mode === "sur_place" && serviceTable === "comptoir" ? await attribuerNumeroAppel(payload.restaurantId) : null;
    const { data: inseree, error } = await db
      .from("orders")
      .insert({
        ...({ session_id: sessionId, numero_appel: numeroAppel, invite: utilisateurId === null && saisiePar === null, saisie_par: saisiePar } as object),
        reference,
        jeton_suivi: jeton,
        restaurant_id: payload.restaurantId,
        client_user_id: utilisateurId,
        client_nom: payload.client.nom,
        client_telephone: payload.client.telephone,
        client_adresse: payload.client.adresse,
        mode: payload.mode,
        table_numero: payload.mode === "sur_place" ? (payload.table ?? null) : null,
        sous_total: sousTotalStocke,
        // Colonnes ajoutées par la migration des campagnes, pas encore dans les types générés.
        ...({ code_promo: campagnePromo?.code ?? null, remise_promo_gnf: remisePromo } as Record<string, unknown>),
        // Frais calculés par le serveur (voir plus haut) ; 0 tant que le calcul automatique est éteint (frais à convenir).
        frais_livraison_estime: fraisLivraison,
        ...(livraisonPoint
          ? {
              livraison_latitude: livraisonPoint.latitude,
              livraison_longitude: livraisonPoint.longitude,
              livraison_distance_m: livraisonDistanceM,
              livraison_gratuite: livraisonGratuite,
            }
          : {}),
        statut: "en_attente",
        est_test: estTest,
      })
      .select("id, reference, jeton_suivi")
      .single();

    if (!error && inseree) {
      try {
        const { data: lignesInserees, error: erreurLignes } = await db
          .from("order_items")
          .insert(
            lignes.map((ligne) => ({
              order_id: inseree.id,
              menu_item_id: ligne.menuItemId,
              nom: ligne.nom,
              prix: ligne.prix,
              quantite: ligne.quantite,
            }))
          )
          .select("id");
        if (erreurLignes || !lignesInserees) {
          throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez.");
        }

        // Suppléments choisis par ligne — insérés après coup car ils
        // référencent l'id généré de chaque order_item (insert renvoie les
        // lignes dans le même ordre que celui envoyé).
        const optionsAInserer = lignes.flatMap((ligne, index) =>
          ligne.options.map((option) => ({
            order_item_id: lignesInserees[index].id,
            option_id: option.id,
            nom: option.nom,
            prix: option.prix,
          }))
        );
        if (optionsAInserer.length > 0) {
          const { error: erreurOptions } = await db.from("order_item_options").insert(optionsAInserer);
          if (erreurOptions) {
            throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez.");
          }
        }

        // Historisation : création = transition depuis un état vide.
        await enregistrerEvenementStatut(db, {
          commandeId: inseree.id,
          statutPrecedent: null,
          statutSuivant: "en_attente",
          acteur: saisiePar !== null ? `restaurant:${saisiePar}` : `client:${inseree.reference}`,
        });

        // Pas de validation requise : la commande de table passe directement « acceptée » et arrive en cuisine.
        if (payload.mode === "sur_place" && !validerAvantPreparation) {
          await appliquerTransitionStatut(db, { id: inseree.id, statut: "en_attente" }, "acceptee", saisiePar !== null ? `restaurant:${saisiePar}` : "systeme:table_sans_validation");
        }
      } catch (echec) {
        // Pas de transaction Supabase possible ici : on retire la commande
        // orpheline pour ne jamais laisser une commande sans lignes.
        const { error: erreurSuppression } = await db.from("orders").delete().eq("id", inseree.id);
        // Utilisation rendue seulement si la commande orpheline a bien été retirée ; sinon elle existe et la gardera.
        if (!erreurSuppression) await rendreUtilisationPromo();
        if (echec instanceof ErreurMetier) {
          throw echec;
        }
        throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez.");
      }

      return {
        id: inseree.id,
        reference: inseree.reference,
        jeton: inseree.jeton_suivi,
        idempotent: false,
        estTest,
      };
    }

    if (error && estViolationUniqueJeton(error)) {
      // Course gagnée par une soumission jumelle de la même commande.
      const { data: concurrente } = await db
        .from("orders")
        .select("id, reference, jeton_suivi, restaurant_id, est_test")
        .eq("jeton_suivi", jeton)
        .maybeSingle();
      if (concurrente) {
        // La commande existe (soumission jumelle) : notre utilisation comptée en trop est rendue avant de renvoyer son succès.
        await rendreUtilisationPromo();
        verifierMemeRestaurant(concurrente.restaurant_id, payload.restaurantId);
        return {
          id: concurrente.id,
          reference: concurrente.reference,
          jeton: concurrente.jeton_suivi,
          idempotent: true,
          estTest: concurrente.est_test,
        };
      }
    }
    if (error && estViolationUniqueNumeroAppel(error)) {
      continue; // deux commandes de comptoir simultanées : nouveau calcul du numéro
    }
    if (error && !estViolationUniqueReference(error)) {
      await rendreUtilisationPromo();
      throw new ErreurMetier(
        "ERREUR_SERVEUR",
        "Commande non enregistrée. Réessayez dans un instant."
      );
    }
  }

  await rendreUtilisationPromo();
  throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez dans un instant.");
}
