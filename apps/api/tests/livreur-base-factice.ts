import { acteurPeut } from '../../web/src/lib/livraison/statuts.ts';

/** Règles de statut du site (fonctions PURES, sans dépendance) : les mêmes que celles branchées par le câblage de production. */
export const REGLES_ESSAI = { acteurPeut };

export const UID_A = '00000000-0000-4000-8000-00000000000a';
export const UID_B = '00000000-0000-4000-8000-00000000000b';
export const LIVREUR_A = 'livreur-factice-a';
export const LIVREUR_B = 'livreur-factice-b';
export const LIV_1 = '11111111-1111-4111-8111-111111111111';
export const LIV_2 = '22222222-2222-4222-8222-222222222222';
export const CMD_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const CMD_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

export interface RequeteVue { table: string; select: string; filtres: string[]; tri: string | null; limite: number | null }

/**
 * Base factice minimale (livreurs, livraison_offres, livraisons), RLS volontairement permissive (support) : sans filtre
 * explicite sur le compte, la ligne de B arrive AVANT celle de A. Chaque requête est enregistrée pour que les tests
 * vérifient les colonnes demandées (aucune coordonnée, aucun embed `orders`) et les filtres posés.
 */
export function baseFactice(donnees: { livreurs?: Record<string, unknown>[]; offres?: Record<string, unknown>[]; livraisons?: Record<string, unknown>[]; erreurSur?: string } = {}) {
  const vues: RequeteVue[] = [];
  const livreurs = donnees.livreurs ?? [
    { id: LIVREUR_B, utilisateur_id: UID_B, nom: 'Livreur B', statut: 'disponible', vehicule: 'pied', cycle: 'actif', motif_cycle: null, latitude: null, longitude: null, restaurants: null },
    { id: LIVREUR_A, utilisateur_id: UID_A, nom: 'Livreuse A', statut: 'en_course', vehicule: 'moto', cycle: 'actif', motif_cycle: null, latitude: null, longitude: null, restaurants: null },
  ];
  const tables: Record<string, Record<string, unknown>[]> = { livreurs, livraison_offres: donnees.offres ?? [], livraisons: donnees.livraisons ?? [] };
  return {
    vues,
    from(table: string) {
      const vue: RequeteVue = { table, select: '', filtres: [], tri: null, limite: null };
      vues.push(vue);
      type F = { champ: string; test: (v: unknown) => boolean };
      const filtres: F[] = [];
      const tris: { champ: string; croissant: boolean }[] = []; let limite = Number.POSITIVE_INFINITY;
      const chaine: Record<string, unknown> = {
        select: (champs: string) => { vue.select = champs; return chaine; },
        eq: (champ: string, valeur: unknown) => { vue.filtres.push('eq:' + champ); filtres.push({ champ, test: v => v === valeur }); return chaine; },
        in: (champ: string, valeurs: unknown[]) => { vue.filtres.push('in:' + champ); filtres.push({ champ, test: v => valeurs.includes(v) }); return chaine; },
        gt: (champ: string, valeur: unknown) => { vue.filtres.push('gt:' + champ); filtres.push({ champ, test: v => typeof v === 'string' && typeof valeur === 'string' && v > valeur }); return chaine; },
        order: (champ: string, options?: { ascending?: boolean }) => { tris.push({ champ, croissant: options?.ascending !== false }); vue.tri = vue.tri ? vue.tri + ',' + champ : champ; return chaine; },
        limit: (n: number) => { limite = n; vue.limite = n; return chaine; },
        maybeSingle: async () => {
          if (donnees.erreurSur === table) return { data: null, error: { message: 'detail-interne-factice' } };
          const lignes = (tables[table] ?? []).filter(l => filtres.every(f => f.test(l[f.champ])));
          lignes.sort((a, b) => { for (const t of tris) { const x = String(a[t.champ]); const y = String(b[t.champ]); if (x !== y) return (x < y ? -1 : 1) * (t.croissant ? 1 : -1); } return 0; });
          return { data: lignes.slice(0, limite)[0] ?? null, error: null };
        },
      };
      return chaine;
    },
  };
}

export const ligneCourse = (surcharge: Record<string, unknown> = {}) => ({
  id: LIV_1, livreur_id: LIVREUR_A, mode: 'speedfood', statut: 'vers_restaurant', frais_gnf: 7000, order_id: CMD_1, cree_le: '2026-11-09T10:00:00.000Z',
  restaurants: { nom: 'Restaurant A' },
  // Embed `orders` (lu seulement par le port privilégié) : la commande de A et celle de B sont distinctes.
  orders: { reference: surcharge.livreur_id === LIVREUR_B ? 'SF-B-0001' : 'SF-0042', client_nom: surcharge.livreur_id === LIVREUR_B ? 'Client de B' : CLIENT_FACTICE_NOM, client_telephone: '+224600000000', client_adresse: 'Rue factice 12' },
  // Données qu'une lecture mal écrite pourrait laisser passer : le test vérifie qu'elles ne sortent jamais.
  depart_latitude: 9.51, depart_longitude: -13.71, arrivee_latitude: 9.52, arrivee_longitude: -13.72,
  ...surcharge,
});

const CLIENT_FACTICE_NOM = 'Client Factice';
export const CLIENT_FACTICE = { nom: 'Client Factice', telephone: '+224600000000', adresse: 'Rue factice 12' };

/** Port « commande » factice : enregistre chaque demande (livraison, livreur). Il rend toujours le client : c'est la projection qui le masque avant récupération. */
export function portCommande(options: { absent?: boolean; erreur?: boolean } = {}) {
  const appels: { livraisonId: string; livreurId: string }[] = [];
  return {
    appels,
    lireCommande: async (livraisonId: string, livreurId: string) => {
      appels.push({ livraisonId, livreurId });
      if (options.erreur) throw new Error('detail-interne-factice');
      if (options.absent) return null;
      return { reference: 'SF-0042', client: CLIENT_FACTICE };
    },
  };
}
