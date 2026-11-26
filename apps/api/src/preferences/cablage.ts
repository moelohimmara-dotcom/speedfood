import type { SupabaseClient } from '@supabase/supabase-js';
import { creerClientJeton } from '@/lib/db/jeton';
import { creerClientAdmin } from '@/lib/db/admin';
import { creerServicePreferences } from './service.ts';

/** Câblage de production : préférences par le client lié au jeton (RLS), habitudes par le client du serveur filtré sur le compte du jeton. */
export const servicePreferences = creerServicePreferences({
  clientDuJeton: (jeton) => creerClientJeton(jeton) as unknown as SupabaseClient,
  clientServeur: () => creerClientAdmin() as unknown as SupabaseClient,
});
