import { classerPersonnalise, HABITUDES_VIDES, PROFIL_VIDE, type HabitudesClient, type Position, type ProfilClient, type RestaurantAClasser } from '../../../../packages/shared/src/menu/classement-personnalise.ts';
import type { ResultatRecherche } from './recherche-appli.ts';

/**
 * Personnalisation des résultats de recherche, sur le téléphone : le classement du moteur partagé (`classement-personnalise`) est appliqué à un résultat déjà trouvé.
 * Aucun restaurant n'est retiré (proche ou loin, tous restent) ; seuls l'ordre change, les plats écartés pour allergie déclarée sont comptés à part, et chaque plat reçoit ses alertes.
 * Rien n'est envoyé au serveur : profil, habitudes et position restent ici.
 */
export interface ContextePerso { profil: ProfilClient; habitudes: HabitudesClient; position: Position | null }
export const CONTEXTE_NEUTRE: ContextePerso = { profil: PROFIL_VIDE, habitudes: HABITUDES_VIDES, position: null };

export function personnaliser(resultat: ResultatRecherche, contexte: ContextePerso): ResultatRecherche {
  const aClasser: RestaurantAClasser[] = resultat.restaurants.map(r => ({
    id: r.restaurant.id, categorie: r.restaurant.categorie, ouvert: r.restaurant.ouvert, accepteCommandes: r.restaurant.accepteCommandes, note: r.restaurant.cote ?? r.restaurant.note,
    latitude: r.restaurant.latitude ?? null, longitude: r.restaurant.longitude ?? null, niveau: r.niveau, score: r.score,
    articles: r.articles.map(a => ({ id: a.id, nom: a.nom, description: a.description, prixGnf: a.prixGnf, allergenes: a.allergenes, disponibilite: a.disponibilite })),
  }));
  const classes = classerPersonnalise(aClasser, contexte);
  const parId = new Map(resultat.restaurants.map(r => [r.restaurant.id, r]));
  return {
    total: resultat.total,
    restaurants: classes.map(c => {
      const r = parId.get(c.restaurantId)!;
      const articles = new Map(r.articles.map(a => [a.id, a]));
      return { ...r, raisons: c.raisons, nombreEcartes: c.nombreEcartes, distanceKm: c.distanceKm, articles: c.articles.map(e => ({ ...articles.get(e.id)!, alertes: e.alertes, statutAllergie: e.statutAllergie, dejaCommande: e.dejaCommande })) };
    }),
  };
}
