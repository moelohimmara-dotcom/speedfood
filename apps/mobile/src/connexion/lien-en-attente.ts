/**
 * Lien profond en attente (A12) : le routeur intercepte les URLs `/r/...` et `/commande/...` avant l'écran catalogue.
 * Le layout (toujours monté) dépose ici le lien reconstruit ; l'écran catalogue le prend au montage ou est prévenu
 * aussitôt s'il est déjà monté. Un lien pris est consommé : jamais rejoué deux fois.
 */
type EcouteurLien = (url: string) => void;

let enAttente: string | null = null;
const ecouteurs = new Set<EcouteurLien>();

export function deposerLienEnAttente(url: string): void {
  if (typeof url !== 'string' || url.trim() === '') return;
  enAttente = url;
  for (const ecouteur of [...ecouteurs]) ecouteur(url);
}

export function prendreLienEnAttente(): string | null {
  const url = enAttente;
  enAttente = null;
  return url;
}

export function abonnerLienEnAttente(ecouteur: EcouteurLien): () => void {
  ecouteurs.add(ecouteur);
  return () => { ecouteurs.delete(ecouteur); };
}
