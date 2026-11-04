import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientJeton } from "@/lib/db/jeton";
import { lireEtatQuestions } from "@/lib/auth/questions-serveur";
import { limiterRestaurantApplication } from "@/lib/securite/limitation-debit";
import { proposerRevision, traiterCommande } from "@/lib/commande/service-restaurant";
import { confirmerPaiement } from "@/lib/commande/service-paiement";
import { lireCommandesRestaurant } from "@/lib/api/restaurant-commandes";
import { origineDuSite } from "@/lib/partage/origine";
import type { ClientCommandeDb } from "@/lib/commande/commun";
import { ajouterOption, archiverPlat, basculerDisponibilite, confirmerDisponibilite, confirmerToutesDisponibilites, creerPlat, lireMenu as lireMenuRestaurant, modifierPlat, retirerOption } from "@/lib/menu/service-menu";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { supprimerImage, supprimerTeleversementOrphelin, televerserImage } from "@/lib/storage/images";
import { creerServiceRestaurant } from "./service.ts";
import { ecrireReglagesRestaurant, ecrireStatutRestaurant, lireReglagesRestaurant } from "./reglages.ts";
import { definirPhotoPlat, retirerPhotoPlat, type StockageImages } from "./photo.ts";

/**
 * Stockage des photos (lot D4c) : les fonctions du site, jamais une copie de leurs règles. Le bucket `medias` n'a AUCUNE policy d'écriture (migration 20260928035030) : le téléversement et la
 * suppression se font avec le client de service du site, comme sa console. C'est le seul usage système du lot : il ne se produit qu'APRÈS le contrôle d'appartenance du plat (photo.ts), pour écrire
 * un fichier au nom aléatoire dans le bucket public ; la donnée du restaurateur (`photo_url`) s'écrit avec le client lié au jeton.
 */
const STOCKAGE_IMAGES: StockageImages = {
  televerser: (fichier, dossier, restaurantId) => televerserImage(fichier, dossier, restaurantId),
  supprimerOrphelin: (url) => supprimerTeleversementOrphelin(url),
  supprimerAncienne: (url) => supprimerImage(url),
};

/** Câblage de PRODUCTION du service restaurateur : les services du site, jamais une copie de leurs règles. Aucun secret lu ici (les clients les lisent à l'appel). */
export const serviceRestaurant = creerServiceRestaurant({
  limiter: limiterRestaurantApplication,
  clientJeton: (jeton) => creerClientJeton(jeton),
  clientAdmin: () => creerClientAdmin(),
  aSecondFacteurConfirme: async (admin, utilisateurId) => {
    const { data } = await (admin as ReturnType<typeof creerClientAdmin>).auth.admin.mfa.listFactors({ userId: utilisateurId });
    return (data?.factors ?? []).some((f) => f.status === "verified");
  },
  questionsRequises: async (client) => (await lireEtatQuestions(client as SupabaseClient)).requise,
  appartenance: async (client, utilisateurId) => {
    const { data } = await (client as SupabaseClient).from("restaurant_memberships").select("restaurant_id, role").eq("utilisateur_id", utilisateurId).maybeSingle();
    return data ? { restaurantId: data.restaurant_id as string, role: String(data.role) } : null;
  },
  origineSite: origineDuSite,
  lireCommandes: (client, restaurantId, origine) => lireCommandesRestaurant(client as SupabaseClient, restaurantId, origine),
  traiterCommande: (client, utilisateurId, restaurantId, commandeId, action) => traiterCommande(client as ClientCommandeDb, utilisateurId, restaurantId, commandeId, action),
  confirmerPaiement: (client, restaurantId, commandeId, decision) => confirmerPaiement(client as ClientCommandeDb, restaurantId, commandeId, decision),
  proposerRevision: (client, restaurantId, commandeId, valeurs) => proposerRevision(client as ClientCommandeDb, restaurantId, commandeId, valeurs),
  fraicheurDisponibiliteHeures: async () => (await obtenirParametresApplication()).disponibiliteFraicheurHeures,
  lireReglages: (client, restaurantId, fraicheurHeures) => lireReglagesRestaurant(client as SupabaseClient, restaurantId, fraicheurHeures),
  ecrireStatut: (client, restaurantId, demande) => ecrireStatutRestaurant(client as SupabaseClient, restaurantId, demande),
  ecrireReglages: (client, restaurantId, valeurs) => ecrireReglagesRestaurant(client as SupabaseClient, restaurantId, valeurs),
  lireMenu: (client, restaurantId) => lireMenuRestaurant(client as SupabaseClient, restaurantId),
  basculerDisponibilite: (client, restaurantId, platId, disponible) => basculerDisponibilite(client as SupabaseClient, restaurantId, platId, disponible),
  confirmerDisponibilite: (client, restaurantId, platId) => confirmerDisponibilite(client as SupabaseClient, restaurantId, platId),
  confirmerToutesDisponibilites: (client, restaurantId) => confirmerToutesDisponibilites(client as SupabaseClient, restaurantId),
  creerPlat: (client, restaurantId, plat) => creerPlat(client as SupabaseClient, restaurantId, plat),
  modifierPlat: (client, restaurantId, platId, plat) => modifierPlat(client as SupabaseClient, restaurantId, platId, plat),
  archiverPlat: (client, restaurantId, platId) => archiverPlat(client as SupabaseClient, restaurantId, platId),
  ajouterOption: (client, restaurantId, platId, option) => ajouterOption(client as SupabaseClient, restaurantId, platId, option),
  retirerOption: (client, restaurantId, optionId) => retirerOption(client as SupabaseClient, restaurantId, optionId),
  definirPhoto: (client, restaurantId, platId, fichier) => definirPhotoPlat(client as SupabaseClient, restaurantId, platId, fichier, STOCKAGE_IMAGES),
  retirerPhoto: (client, restaurantId, platId) => retirerPhotoPlat(client as SupabaseClient, restaurantId, platId, STOCKAGE_IMAGES),
});
