import { creerClientPublic } from '../../../web/src/lib/db/public';
import { obtenirParametresApplication } from '../../../web/src/lib/parametres/lire';
import { lireRestaurants as restaurants, lireMenu as menu, lireQuartiers as quartiers } from './lectures';
export const lireRestaurants = (apres: string | null) => restaurants(apres, creerClientPublic());
export const lireMenu = (id: string, apres: string | null) => menu(id, apres, creerClientPublic(), obtenirParametresApplication);
export const lireQuartiers = () => quartiers(creerClientPublic());
