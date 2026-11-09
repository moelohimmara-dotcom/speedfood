import type { SupabaseClient } from '@supabase/supabase-js';
import { STATUTS_APRES_RECUPERATION, STATUTS_COURSE_ACTIVE } from '@speedfood/shared/contracts/livreur-course';

/**
 * Lecture de la commande de MA course (G3a). Pourquoi un port à part : un compte livreur n'a AUCUNE policy de lecture sur
 * `orders` (seule existe celle des membres du restaurant ; ni livreur, ni support), donc ni la référence ni le client ne sont
 * lisibles sous le jeton.
 *
 * ECART À FAIRE VALIDER PAR MALIKA : cette lecture utilise le client du serveur (clé de service), contrairement au principe
 * G1/G2 « lectures sous le jeton ». Précédent : le site lit déjà ces champs ainsi (`lib/livraison/livreur.ts`, embed `orders(...)`
 * via `clientLivraison()`). Sans migration, c'est le seul moyen de tenir « téléphone du client après récupération ».
 * Durcissement : le port ne lit JAMAIS « une commande » par son identifiant ; il reçoit (livraison, livreur) et réaffirme dans
 * la requête privilégiée elle-même la propriété (`livreur_id`) et le statut actif ; le client (nom, téléphone, adresse en texte)
 * n'est demandé que si le statut de CETTE ligne est « récupérée » ou « vers le client ». Lecture seule, aucune coordonnée.
 * Cible propre plus tard (décision de Malika) : fonction SQL `SECURITY DEFINER` dédiée.
 */
export interface CommandeDeCourse {
  reference: string;
  client: { nom: string; telephone: string; adresse: string | null } | null;
}

export type LireCommande = (livraisonId: string, livreurId: string) => Promise<CommandeDeCourse | null>;

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Relation<T> = T | T[] | null;
const un = <T>(r: Relation<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

export function creerLectureCommande(d: { client(): SupabaseClient }): LireCommande {
  return async (livraisonId, livreurId) => {
    if (!REGEX_UUID.test(livraisonId) || livreurId === '') return null;
    const db = d.client();
    const { data, error } = await db.from('livraisons')
      .select('statut, orders(reference)')
      .eq('id', livraisonId)
      .eq('livreur_id', livreurId)
      .in('statut', [...STATUTS_COURSE_ACTIVE])
      .maybeSingle();
    if (error) throw new Error('COMMANDE_COURSE_INDISPONIBLE');
    if (!data) return null;
    const ligne = data as unknown as { statut: unknown; orders: Relation<{ reference: unknown }> };
    const commande = un(ligne.orders);
    if (!commande || typeof commande.reference !== 'string') return null;
    const apresRecuperation = (STATUTS_APRES_RECUPERATION as readonly unknown[]).includes(ligne.statut);
    if (!apresRecuperation) return { reference: commande.reference, client: null };

    const { data: avec, error: erreurClient } = await db.from('livraisons')
      .select('statut, orders(reference, client_nom, client_telephone, client_adresse)')
      .eq('id', livraisonId)
      .eq('livreur_id', livreurId)
      .in('statut', [...STATUTS_APRES_RECUPERATION])
      .maybeSingle();
    if (erreurClient) throw new Error('COMMANDE_COURSE_INDISPONIBLE');
    const complet = avec ? un((avec as unknown as { orders: Relation<{ client_nom?: unknown; client_telephone?: unknown; client_adresse?: unknown }> }).orders) : null;
    return {
      reference: commande.reference,
      client: complet
        ? {
            nom: typeof complet.client_nom === 'string' ? complet.client_nom : '',
            telephone: typeof complet.client_telephone === 'string' ? complet.client_telephone : '',
            adresse: typeof complet.client_adresse === 'string' ? complet.client_adresse : null,
          }
        : null,
    };
  };
}
