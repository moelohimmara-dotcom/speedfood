import type { SupabaseClient } from '@supabase/supabase-js';
import { normaliserNom } from '@speedfood/shared/menu/types-plats';
import { MESSAGE_CONSENTEMENT, projeterPreferences, type HabitudesClientPublic, type PreferencesAEcrire, type PreferencesClientPublic } from '@speedfood/shared/contracts/preferences';

/**
 * Préférences alimentaires du client : lecture, écriture, effacement et habitudes.
 * Préférences : client LIÉ AU JETON (RLS : un client ne voit et ne modifie que sa ligne), jamais la clé de service ; l'identité vient du jeton vérifié.
 * Habitudes : déduites des commandes du compte (`orders.client_user_id`), lues avec le client du serveur et FILTRÉES sur l'identité du jeton, comme « Mes commandes » du site ;
 * seuls des compteurs en sortent (aucun montant, aucune adresse, aucun jeton de suivi).
 */
export type FabriqueClient = (jeton: string) => SupabaseClient;
export type ResultatPreferences = { ok: true } | { ok: false; message: string };
const MAX_COMMANDES = 200;
const TABLE = 'preferences_clients' as never;

export function creerServicePreferences(options: { clientDuJeton: FabriqueClient; clientServeur: () => SupabaseClient; maintenant?: () => Date }) {
  const maintenant = options.maintenant ?? (() => new Date());
  return {
    async lire(jeton: string, utilisateurId: string): Promise<PreferencesClientPublic | null> {
      const { data, error } = await options.clientDuJeton(jeton).from(TABLE).select('allergies, regimes, cuisines_preferees, piment, budget_max_gnf, notes, evitements, consentement_sante_le').eq('utilisateur_id', utilisateurId).maybeSingle();
      if (error) throw new Error('preferences_illisibles');
      return projeterPreferences(data);
    },
    async ecrire(jeton: string, utilisateurId: string, p: PreferencesAEcrire): Promise<ResultatPreferences> {
      if (p.allergies.length > 0 && !p.consentementSante) return { ok: false, message: MESSAGE_CONSENTEMENT };
      const client = options.clientDuJeton(jeton);
      // La date du consentement est gardée si elle existe déjà (un nouvel enregistrement ne la rajeunit pas), posée sinon ; sans allergie elle est effacée.
      let consentement: string | null = null;
      if (p.allergies.length > 0) {
        const { data, error } = await client.from(TABLE).select('consentement_sante_le').eq('utilisateur_id', utilisateurId).maybeSingle();
        if (error) throw new Error('preferences_illisibles');
        const ancien = (data as { consentement_sante_le?: string | null } | null)?.consentement_sante_le;
        consentement = typeof ancien === 'string' ? ancien : maintenant().toISOString();
      }
      const ligne = { utilisateur_id: utilisateurId, allergies: p.allergies, regimes: p.regimes, cuisines_preferees: p.cuisinesPreferees, piment: p.piment, budget_max_gnf: p.budgetMaxGnf, notes: p.notes, evitements: p.evitements, consentement_sante_le: consentement };
      const { error } = await client.from(TABLE).upsert(ligne as never, { onConflict: 'utilisateur_id' });
      if (error) throw new Error('preferences_non_enregistrees');
      return { ok: true };
    },
    /** Droit à l'effacement : supprime la ligne (allergies comprises). Sans ligne, rien à faire : succès. */
    async effacer(jeton: string, utilisateurId: string): Promise<void> {
      const { error } = await options.clientDuJeton(jeton).from(TABLE).delete().eq('utilisateur_id', utilisateurId);
      if (error) throw new Error('preferences_non_effacees');
    },
    async habitudes(utilisateurId: string): Promise<HabitudesClientPublic> {
      const { data, error } = await options.clientServeur().from('orders').select('restaurant_id, statut, est_test, restaurants(menu_categories(nom)), order_items(nom)').eq('client_user_id', utilisateurId).order('cree_le', { ascending: false }).limit(MAX_COMMANDES);
      if (error) throw new Error('habitudes_illisibles');
      const restaurants: Record<string, number> = {}; const plats: Record<string, number> = {}; const cuisines: Record<string, number> = {};
      let commandes = 0;
      type Ligne = { restaurant_id: string; statut: string; est_test: boolean; restaurants: { menu_categories: { nom: string } | { nom: string }[] | null } | { menu_categories: { nom: string } | { nom: string }[] | null }[] | null; order_items: { nom: string }[] | null };
      for (const o of (data ?? []) as unknown as Ligne[]) {
        // Une commande d'essai ou annulée ne dit rien des goûts.
        if (o.est_test || /annul|refus/i.test(o.statut)) continue;
        commandes++;
        restaurants[o.restaurant_id] = (restaurants[o.restaurant_id] ?? 0) + 1;
        const r = Array.isArray(o.restaurants) ? o.restaurants[0] : o.restaurants;
        const cat = r ? (Array.isArray(r.menu_categories) ? r.menu_categories[0] : r.menu_categories) : null;
        if (cat?.nom) cuisines[cat.nom] = (cuisines[cat.nom] ?? 0) + 1;
        for (const nom of new Set((o.order_items ?? []).map(i => normaliserNom(i.nom)).filter(Boolean))) plats[nom] = (plats[nom] ?? 0) + 1;
      }
      return { restaurants, plats, cuisines, commandes };
    },
  };
}
export type ServicePreferences = ReturnType<typeof creerServicePreferences>;
