import type { SupabaseClient } from '@supabase/supabase-js';
import { projeterFicheLivreur, type FicheLivreur } from '@speedfood/shared/contracts/livreur-fiche';

/** Une lecture ciblée sur le compte, même si sa RLS (support) autorise davantage de lignes. */
export async function lireFicheLivreur(db: SupabaseClient, utilisateurId: string): Promise<FicheLivreur | null> {
  const { data, error } = await db.from('livreurs')
    .select('nom, statut, vehicule, cycle, motif_cycle, restaurants(nom)')
    .eq('utilisateur_id', utilisateurId)
    .maybeSingle();
  if (error) throw new Error('FICHE_LIVREUR_INDISPONIBLE');
  if (!data) return null;
  const ligne = data as { nom: unknown; statut: unknown; vehicule: unknown; cycle: unknown; motif_cycle: unknown; restaurants: unknown };
  const relation = Array.isArray(ligne.restaurants) ? ligne.restaurants[0] : ligne.restaurants;
  const restaurantNom = relation && typeof relation === 'object' && 'nom' in relation ? (relation as { nom: unknown }).nom : null;
  return projeterFicheLivreur({ nom: ligne.nom, statut: ligne.statut, vehicule: ligne.vehicule, cycle: ligne.cycle, motifCycle: ligne.motif_cycle, restaurantNom });
}

/** Port de câblage testable : l'identité RLS vient du porteur, jamais d'une clé de service. */
export function creerServiceLivreur(d: { clientDuJeton(jeton: string): SupabaseClient; limiter(utilisateurId: string): Promise<void> }) {
  return { limiter: d.limiter, lireFiche: (jeton: string, utilisateurId: string) => lireFicheLivreur(d.clientDuJeton(jeton), utilisateurId) };
}
