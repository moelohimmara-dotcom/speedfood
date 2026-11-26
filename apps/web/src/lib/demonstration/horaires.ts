import { etatHoraire, lireHoraires } from "@/lib/horaires/horaires";

/**
 * État d'ouverture des restaurants de DÉMONSTRATION d'après leurs horaires, pour que la démonstration vive toute la journée (appelé par le renouvellement régulier). Mêmes règles que le chargement
 * (supabase/demo/charger-demonstration.sql), choisies pour donner des différences naturelles entre restaurants à toute heure :
 *  - ouvert = dans ses horaires, sauf fermeture exceptionnelle (une maison sur 17, toujours la même) ;
 *  - prend des commandes = ouvert, sauf pause « cuisine débordée » (une maison sur 9, qui change chaque heure) ;
 *  - négligente (une maison sur 11) = ne reconfirme jamais ses plats : ils passent « à confirmer » après le seuil de fraîcheur.
 * « Aléa » stable tiré des deux derniers caractères de l'identifiant (jamais de hasard à l'exécution : deux appels de suite donnent le même état). Fonction pure.
 */
export interface EtatDemo { ouvert: boolean; accepteCommandes: boolean }

const alea = (id: string): number => {
  const n = Number.parseInt(id.slice(-2), 16);
  return Number.isFinite(n) ? n : 0;
};

export function estNegligenteDemo(id: string): boolean {
  return alea(id) % 11 === 0;
}

/** `null` quand les horaires ne sont pas lisibles : on ne touche alors à rien (jamais d'état inventé). */
export function etatDemoDepuisHoraires(id: string, horaires: string | null | undefined, maintenant: Date): EtatDemo | null {
  const planning = lireHoraires(horaires);
  if (!planning) return null;
  const a = alea(id);
  const ouvert = a % 17 !== 0 && etatHoraire(planning, maintenant).ouvert;
  return { ouvert, accepteCommandes: ouvert && (a + maintenant.getUTCHours()) % 9 !== 0 };
}
