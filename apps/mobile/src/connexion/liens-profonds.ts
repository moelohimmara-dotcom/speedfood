/**
 * Liens profonds (parité Kotlin, lot 4, ligne A12) : destination interne issue d'un lien partagé depuis le site ou WhatsApp.
 * Seuls les liens publics Speedfood connus sont interprétés (`/r/:id` restaurant, `/commande/:jeton` suivi) : les autres hôtes,
 * schémas et chemins restent sur le site — aucune navigation arbitraire, aucun identifiant inventé.
 */
export type LienProfond = { genre: 'restaurant'; id: string } | { genre: 'commande'; jeton: string };

const HOTES = new Set(['speedfood-app.moelohimmara.workers.dev', 'www.speedfood.dev', 'speedfood.dev']);

export function lireLienProfond(url: string): LienProfond | null {
  if (typeof url !== 'string') return null;
  const valeur = url.trim();
  if (!valeur.startsWith('https://') && !valeur.startsWith('http://')) return null;
  const sansSchema = valeur.slice(valeur.indexOf('://') + 3);
  const hote = sansSchema.split('/')[0].toLowerCase();
  if (!HOTES.has(hote)) return null;
  const apresHote = sansSchema.slice(sansSchema.indexOf('/'));
  const chemin = apresHote.split('?')[0].split('#')[0];
  const morceaux = chemin.split('/').filter(m => m.length > 0);
  if (morceaux.length !== 2) return null;
  const identifiant = morceaux[1].trim();
  if (identifiant.length === 0 || identifiant.length > 160 || /\s/.test(identifiant) || identifiant.includes('/') || identifiant.includes('\\')) return null;
  const premier = morceaux[0].toLowerCase();
  if (premier === 'r') return { genre: 'restaurant', id: identifiant };
  if (premier === 'commande') return { genre: 'commande', jeton: identifiant };
  return null;
}
