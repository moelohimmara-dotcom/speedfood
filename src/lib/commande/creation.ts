import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { CreationCommandePayload } from "@/lib/contracts/commande";
import { creerClientAdmin } from "@/lib/db/admin";
import { recalculerLignes, verifierRestaurantCommandable } from "./calculs";
import { genererJetonSuivi, genererReference } from "./jetons";
import { enregistrerEvenementStatut } from "./transitions";

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
}

function estViolationUniqueJeton(error: { code?: string; message: string }): boolean {
  return error.code === "23505" && error.message.includes("jeton_suivi");
}

function estViolationUniqueReference(error: { code?: string; message: string }): boolean {
  return error.code === "23505" && error.message.includes("reference");
}

export async function creerCommande(payload: CreationCommandePayload): Promise<CommandeCreee> {
  const db = creerClientAdmin();
  const jeton = genererJetonSuivi(payload.cleIdempotence);

  // Rejeu idempotent : la commande existe déjà pour cette clé d'idempotence.
  const { data: existante } = await db
    .from("orders")
    .select("id, reference, jeton_suivi")
    .eq("jeton_suivi", jeton)
    .maybeSingle();
  if (existante) {
    return {
      id: existante.id,
      reference: existante.reference,
      jeton: existante.jeton_suivi,
      idempotent: true,
    };
  }

  // Recalcul serveur systématique : prix et totaux du navigateur ignorés.
  await verifierRestaurantCommandable(db, payload.restaurantId);
  const { lignes, sousTotal } = await recalculerLignes(
    db,
    payload.restaurantId,
    payload.lignes
  );

  // Trois tentatives au cas (rare) où la référence aléatoire serait déjà prise.
  for (let tentative = 0; tentative < 3; tentative += 1) {
    const reference = genererReference();
    const { data: inseree, error } = await db
      .from("orders")
      .insert({
        reference,
        jeton_suivi: jeton,
        restaurant_id: payload.restaurantId,
        client_nom: payload.client.nom,
        client_telephone: payload.client.telephone,
        client_adresse: payload.client.adresse,
        mode: payload.mode,
        sous_total: sousTotal,
        // Aucun calcul de livraison : les frais restent à convenir avec le
        // restaurant (TDR.md §5 exclut tout calcul automatique de livraison).
        frais_livraison_estime: 0,
        statut: "en_attente",
      })
      .select("id, reference, jeton_suivi")
      .single();

    if (!error && inseree) {
      try {
        const { error: erreurLignes } = await db.from("order_items").insert(
          lignes.map((ligne) => ({
            order_id: inseree.id,
            menu_item_id: ligne.menuItemId,
            nom: ligne.nom,
            prix: ligne.prix,
            quantite: ligne.quantite,
          }))
        );
        if (erreurLignes) {
          throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez.");
        }

        // Historisation : création = transition depuis un état vide.
        await enregistrerEvenementStatut(db, {
          commandeId: inseree.id,
          statutPrecedent: null,
          statutSuivant: "en_attente",
          acteur: `client:${inseree.reference}`,
        });
      } catch (echec) {
        // Pas de transaction Supabase possible ici : on retire la commande
        // orpheline pour ne jamais laisser une commande sans lignes.
        await db.from("orders").delete().eq("id", inseree.id);
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
      };
    }

    if (error && estViolationUniqueJeton(error)) {
      // Course gagnée par une soumission jumelle de la même commande.
      const { data: concurrente } = await db
        .from("orders")
        .select("id, reference, jeton_suivi")
        .eq("jeton_suivi", jeton)
        .maybeSingle();
      if (concurrente) {
        return {
          id: concurrente.id,
          reference: concurrente.reference,
          jeton: concurrente.jeton_suivi,
          idempotent: true,
        };
      }
    }
    if (error && !estViolationUniqueReference(error)) {
      throw new ErreurMetier(
        "ERREUR_SERVEUR",
        "Commande non enregistrée. Réessayez dans un instant."
      );
    }
  }

  throw new ErreurMetier("ERREUR_SERVEUR", "Commande non enregistrée. Réessayez dans un instant.");
}
