import React, { createContext, useContext, useState } from 'react';
import { ajouterAuPanier, changerQuantite, panierVide, totalPanier, type Panier } from '../domaine/panier';
import { plats, type Plat } from '../donnees/demo';
interface Simulation { reference: string; totalGnf: number; restaurantId: string; etape: number }
interface Etat {
  panier: Panier; favoris: string[]; simulation: Simulation | null;
  ajouter(p: Plat): void; quantite(id: string, n: number): void; vider(): void;
  favori(id: string): void; simuler(): void; avancer(): void;
}
const Contexte = createContext<Etat | null>(null);
export function ApplicationProvider({ children }: React.PropsWithChildren) {
  const [panier, setPanier] = useState(panierVide);
  const [favoris, setFavoris] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const etat: Etat = {
    panier, favoris, simulation,
    ajouter(p) { setPanier(ajouterAuPanier(panier, p)); },
    quantite(id, n) { setPanier(changerQuantite(panier, id, n)); },
    vider() { setPanier(panierVide()); },
    favori(id) { setFavoris(favoris.includes(id) ? favoris.filter(f => f !== id) : [...favoris, id]); },
    simuler() {
      if (!panier.restaurantId || !panier.lignes.length) return;
      setSimulation({ reference: 'DEMO-001', totalGnf: totalPanier(panier, plats), restaurantId: panier.restaurantId, etape: 0 });
      setPanier(panierVide());
    },
    avancer() { setSimulation(s => s ? { ...s, etape: Math.min(2, s.etape + 1) } : null); },
  };
  return <Contexte.Provider value={etat}>{children}</Contexte.Provider>;
}
export function useApplication() { const etat = useContext(Contexte); if (!etat) throw new Error('Contexte application absent'); return etat; }
