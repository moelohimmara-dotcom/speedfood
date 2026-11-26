import type { NomIcone } from '../design/Icone.tsx';
/**
 * Barre d'onglets du client (parité Kotlin, écart G18) : Restaurants, Commandes, Panier, Compte. Logique pure, sans interface : l'onglet actif se déduit de l'état des écrans
 * (les écrans « Panier » et « Compte » sont rendus dans la page, sous la barre) et chaque appui donne l'état voulu. Les espaces professionnels gardent leur propre coque, sans cette barre.
 */
export type IdOnglet = 'restaurants' | 'commandes' | 'panier' | 'compte';
export const ONGLETS: ReadonlyArray<{ id: IdOnglet; libelle: string; icone: NomIcone }> = [
  { id: 'restaurants', libelle: 'Restaurants', icone: 'plat' },
  { id: 'commandes', libelle: 'Commandes', icone: 'document' },
  { id: 'panier', libelle: 'Panier', icone: 'panier' },
  { id: 'compte', libelle: 'Compte', icone: 'compte' },
];
export interface DemandeCompte { reference: string | null; espaceRestaurateur?: boolean }
export interface EtatOnglets { panierOuvert: boolean; compteOuvert: boolean; demandeCompte: DemandeCompte | null }
/** Le panier garde la priorité ; un compte ouvert avec une demande de commandes (notification, commande envoyée, onglet Commandes) est l'onglet Commandes. */
export function ongletActif(e: EtatOnglets): IdOnglet {
  if (e.panierOuvert) return 'panier';
  if (e.compteOuvert) return e.demandeCompte !== null && !e.demandeCompte.espaceRestaurateur ? 'commandes' : 'compte';
  return 'restaurants';
}
export function etatPourOnglet(id: IdOnglet): EtatOnglets {
  switch (id) {
    case 'restaurants': return { panierOuvert: false, compteOuvert: false, demandeCompte: null };
    case 'panier': return { panierOuvert: true, compteOuvert: false, demandeCompte: null };
    case 'compte': return { panierOuvert: false, compteOuvert: true, demandeCompte: null };
    case 'commandes': return { panierOuvert: false, compteOuvert: true, demandeCompte: { reference: null } };
  }
}
export function libelleBadge(n: number): string | null { return n <= 0 ? null : n > 99 ? '99+' : String(n); }
export function libelleOnglet(id: IdOnglet, articles: number): string {
  const nom = ONGLETS.find(o => o.id === id)!.libelle;
  if (id !== 'panier') return nom;
  return articles <= 0 ? `${nom}, vide` : `${nom}, ${articles} article${articles > 1 ? 's' : ''}`;
}
