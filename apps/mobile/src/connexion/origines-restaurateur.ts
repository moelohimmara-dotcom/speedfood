import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';
import { SITE_WEB } from './aide.ts';

/**
 * Où vit chaque route de l'espace restaurateur. Le site (`apps/web`) les porte toutes ; l'API (`apps/api`, Hono) n'en porte que dix (commandes, action, paiement, proposition, statut,
 * réglages, menu, menu/action, menu/photo, livraison/action). Les quatre chemins ci-dessous n'existent QUE sur le site : un appel vers l'API répondait « Route inconnue » (404), si bien que
 * l'historique, l'activité, l'émission de document et l'état de publication ne marchaient pas (relevé par l'essai des routes du 18/11/2026).
 * Règle : tout nouveau chemin restaurateur absent de `apps/api/src/routes/restaurant.ts` doit être ajouté ici (un test compare les chemins de l'application aux routes de chaque hôte).
 */
export const CHEMINS_RESTAURATEUR_SUR_LE_SITE: ReadonlySet<string> = new Set([
  '/api/v1/restaurant/historique',
  '/api/v1/restaurant/activite',
  '/api/v1/restaurant/commandes/document',
  '/api/v1/restaurant/etat',
]);

export const origineRestaurateur = (chemin: string): string => (CHEMINS_RESTAURATEUR_SUR_LE_SITE.has(chemin) ? SITE_WEB : ORIGINE_CATALOGUE);
