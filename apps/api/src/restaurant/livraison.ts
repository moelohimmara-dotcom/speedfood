import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultatActionCommande } from "@speedfood/shared/contracts/commande";
import { lireLivraisonApi, type ActionLivraisonApp, type LivraisonRestaurateurApi } from "@speedfood/shared/contracts/restaurant-livraison";

/**
 * Livraison par le restaurant depuis l'application (lot D5), pour `POST /api/v1/restaurant/livraison/action` et pour le bloc `livraison` de `GET /api/v1/restaurant/commandes`.
 *
 *  - LECTURE (liste) et CONTRÔLE D'APPARTENANCE (action) se font avec le client LIÉ AU JETON du membre (RLS « restaurant_lit_ses_livraisons »), filtrés en plus sur `restaurant_id` du contexte.
 *    Une livraison absente, d'un autre restaurant ou illisible donne la MÊME réponse « introuvable » : aucune fuite d'existence entre restaurants.
 *  - ÉCRITURE : les tables de livraison n'ont aucune policy d'écriture. L'avancement passe donc par `avancerLivraison` du site (machine à états, code de remise, plafond d'essais `ESSAIS_CODE_MAX`,
 *    clôture de la commande), qui utilise la clé de service. C'est l'usage système du lot, accepté par Malika ; il n'a lieu qu'APRÈS le contrôle d'appartenance ci-dessus, avec l'acteur « restaurant »
 *    imposé ici (jamais choisi par l'appelant), et il est injecté (`AvancementLivraison`) : `cablage.ts` y branche la fonction du site, les tests une doublure qui enregistre ses appels.
 *  - Le code de remise n'est lu que pour « livree », transmis au service tel quel, et n'apparaît NI dans une réponse, NI dans un message, NI dans un journal.
 */
export interface DemandeAvancementRestaurant {
  livraisonId: string;
  acteur: "restaurant";
  vers: "vers_client" | "livree" | "annulee";
  code?: string;
  raison?: string;
}
export type AvancementLivraison = (demande: DemandeAvancementRestaurant) => Promise<{ ok: true } | { ok: false; message: string }>;

const INTROUVABLE: ResultatActionCommande = { ok: false, erreur: { code: "INTROUVABLE", message: "Livraison introuvable." } };
const PANNE: ResultatActionCommande = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." } };

/** Étape visée par chaque action (celle du site : `agirSurLivraisonAction`). */
const VERS: Record<ActionLivraisonApp, DemandeAvancementRestaurant["vers"]> = { partir: "vers_client", livree: "livree", annuler: "annulee" };

type Lecture = { etat: "ok" } | { etat: "absent" } | { etat: "panne" };

/** La livraison de CE restaurant : lue avec le client du jeton, filtrée sur le restaurant du contexte. */
async function lireAppartenance(db: SupabaseClient, restaurantId: string, livraisonId: string): Promise<Lecture> {
  try {
    const { data, error } = await db.from("livraisons").select("id").eq("id", livraisonId).eq("restaurant_id", restaurantId).maybeSingle();
    if (error) return { etat: "panne" };
    return data ? { etat: "ok" } : { etat: "absent" };
  } catch {
    return { etat: "panne" };
  }
}

/** Messages du service du site classés par leur début (textes fixes de `avancerLivraison`) : aucun ne contient le code. Tout le reste est une panne. */
function refus(message: string): ResultatActionCommande {
  if (/^Code incorrect/.test(message)) {
    const restants = /\((\d{1,2}) essai/.exec(message)?.[1];
    return { ok: false, erreur: { code: "VALIDATION", message: "Code incorrect.", champs: { raison: "code_incorrect", ...(restants !== undefined ? { essaisRestants: restants } : {}) } } };
  }
  if (/^Trop d'essais/.test(message)) return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Trop d'essais de code. Contactez l'assistance.", champs: { raison: "essais_epuises" } } };
  if (/introuvable/i.test(message)) return INTROUVABLE;
  if (/^(Cette livraison est terminée|Ce changement d'étape n'est pas possible|La commande doit être acceptée|La commande n'est pas encore prête|La livraison a changé d'état)/.test(message)) {
    return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "La livraison ne peut pas changer d'étape maintenant. Actualisez la liste." } };
  }
  return PANNE;
}

export async function agirSurLivraisonRestaurant(
  db: SupabaseClient,
  restaurantId: string,
  livraisonId: string,
  action: ActionLivraisonApp,
  code: string | undefined,
  avancer: AvancementLivraison,
): Promise<ResultatActionCommande> {
  const lecture = await lireAppartenance(db, restaurantId, livraisonId);
  if (lecture.etat === "absent") return INTROUVABLE;
  if (lecture.etat === "panne") return PANNE;
  try {
    const resultat = await avancer({
      livraisonId,
      acteur: "restaurant",
      vers: VERS[action],
      ...(action === "livree" ? { code } : {}),
      ...(action === "annuler" ? { raison: "Annulée par le restaurant" } : {}),
    });
    return resultat.ok ? { ok: true } : refus(resultat.message);
  } catch {
    // L'exception d'origine est avalée : son texte pourrait citer une requête ou une valeur.
    return PANNE;
  }
}

export interface LecturesLivraisons {
  /** Livraison par identifiant de commande. */
  parCommande: Record<string, LivraisonRestaurateurApi>;
  /** Lignes lues mais écartées (valeur inconnue, commande hors de la demande, doublon) : comptées, jamais silencieuses. */
  ignorees: number;
}

const PAQUET = 50;

/**
 * Livraisons des commandes données, pour CE restaurant. `null` = lecture en panne (l'appelant écarte et compte, la liste reste valide). Seules trois colonnes sont lues et retenues
 * (identifiant, statut, mode) : ni le livreur, ni les coordonnées, ni le code.
 */
export async function lireLivraisonsDesCommandes(db: SupabaseClient, restaurantId: string, commandeIds: readonly string[]): Promise<LecturesLivraisons | null> {
  const parCommande: Record<string, LivraisonRestaurateurApi> = {};
  let ignorees = 0;
  const demandees = new Set(commandeIds);
  try {
    for (let i = 0; i < commandeIds.length; i += PAQUET) {
      const { data, error } = await db.from("livraisons").select("id, order_id, mode, statut").eq("restaurant_id", restaurantId).in("order_id", commandeIds.slice(i, i + PAQUET));
      if (error) return null;
      for (const ligne of (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>) {
        const commandeId = ligne.order_id;
        const vue = lireLivraisonApi(ligne);
        if (vue === null || typeof commandeId !== "string" || !demandees.has(commandeId) || parCommande[commandeId] !== undefined) { ignorees++; continue; }
        parCommande[commandeId] = vue;
      }
    }
  } catch {
    return null;
  }
  return { parCommande, ignorees };
}
