import { creerClientPublic } from '../../../web/src/lib/db/public';
import { creerClientAdmin } from '../../../web/src/lib/db/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';
import { obtenirParametresApplication } from '../../../web/src/lib/parametres/lire';
import { lireRestaurants as restaurants, lireMenu as menu, lireQuartiers as quartiers } from './lectures';
export const lireRestaurants = (apres: string | null) => restaurants(apres, creerClientPublic(), creerClientAdmin() as unknown as SupabaseClient<Database>);
export const lireMenu = (id: string, apres: string | null) => menu(id, apres, creerClientPublic(), obtenirParametresApplication);
export const lireQuartiers = () => quartiers(creerClientPublic());
