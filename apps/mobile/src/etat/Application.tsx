import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { ajouterAuPanier, changerQuantite, panierVide, totalPanier, type Panier } from '../domaine/panier';
import { plats, type Plat } from '../donnees/demo';
import { etatLocalVide, type EtatLocal } from '../stockage/codec';
import { ouvrirSessionLocale } from '../stockage/sqlite';
import type { SessionLocale } from '../stockage/session';
import { couleurs as c, polices } from '../design/tokens';
interface Simulation { reference: string; totalGnf: number; restaurantId: string; etape: number }
interface Etat {
  panier: Panier; favoris: string[]; simulation: Simulation | null;
  statutSauvegarde: 'pret' | 'enregistrement' | 'enregistre' | 'erreur';
  ajouter(p: Plat): void; quantite(id: string, n: number): void; vider(): void;
  favori(id: string): void; simuler(): void; avancer(): void;
  reessayerSauvegarde(): void; effacerDonnees(): void;
}
const Contexte = createContext<Etat | null>(null);
export function ApplicationProvider({ children }: React.PropsWithChildren) {
  const [local, setLocal] = useState(etatLocalVide);
  const actuel = useRef(local);
  const session = useRef<SessionLocale | null>(null);
  const generation = useRef(0);
  const revision = useRef(0);
  const [pret, setPret] = useState(false);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [statutSauvegarde, setStatutSauvegarde] = useState<Etat['statutSauvegarde']>('pret');
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const restaurer = useCallback(async () => {
    const tentative = ++generation.current;
    setErreurLecture(null);
    try {
      const depot = await ouvrirSessionLocale();
      const contenu = await depot.charger();
      if (tentative !== generation.current) return;
      session.current = depot; actuel.current = contenu; setLocal(contenu); setPret(true);
    } catch (e) {
      if (tentative !== generation.current) return;
      setErreurLecture(e instanceof Error && e.message === 'VERSION_LOCALE_INCOMPATIBLE'
        ? 'Ces données viennent d’une version plus récente. Elles ont été conservées sans modification.'
        : 'Impossible de restaurer les données locales. Elles n’ont pas été effacées.');
    }
  }, []);
  useEffect(() => { void restaurer(); return () => { generation.current++; }; }, [restaurer]);
  function sauvegarder(contenu: EtatLocal) {
    const depot = session.current;
    if (!depot) throw new Error('STOCKAGE_NON_CHARGE');
    const numero = ++revision.current;
    setStatutSauvegarde('enregistrement');
    void Promise.resolve().then(() => depot.sauver(contenu)).then(
      () => { if (numero === revision.current) setStatutSauvegarde('enregistre'); },
      () => { if (numero === revision.current) setStatutSauvegarde('erreur'); },
    );
  }
  function modifier(f: (avant: EtatLocal) => EtatLocal) {
    if (!session.current || !pret) throw new Error('STOCKAGE_NON_CHARGE');
    const suivant = f(actuel.current);
    actuel.current = suivant; setLocal(suivant); sauvegarder(suivant);
  }
  const etat: Etat = {
    ...local, simulation, statutSauvegarde,
    ajouter(p) { modifier(e => ({ ...e, panier: ajouterAuPanier(e.panier, p) })); },
    quantite(id, n) { modifier(e => ({ ...e, panier: changerQuantite(e.panier, id, n) })); },
    vider() { modifier(e => ({ ...e, panier: panierVide() })); },
    favori(id) { modifier(e => ({ ...e, favoris: e.favoris.includes(id) ? e.favoris.filter(f => f !== id) : [...e.favoris, id] })); },
    simuler() {
      const panier = actuel.current.panier;
      if (!panier.restaurantId || !panier.lignes.length) return;
      setSimulation({ reference: 'DEMO-001', totalGnf: totalPanier(panier, plats), restaurantId: panier.restaurantId, etape: 0 });
      modifier(e => ({ ...e, panier: panierVide() }));
    },
    avancer() { setSimulation(s => s ? { ...s, etape: Math.min(2, s.etape + 1) } : null); },
    reessayerSauvegarde() { sauvegarder(actuel.current); },
    effacerDonnees() { modifier(() => etatLocalVide()); setSimulation(null); },
  };
  return <Contexte.Provider value={etat}>{children}
    <Modal visible={!pret} transparent animationType="none" onRequestClose={() => {}}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: c.fond }}>
        <Text accessibilityRole="header" style={{ fontFamily: polices.titre, fontSize: 30, color: c.encre }}>Vos envies, avec vous.</Text>
        {erreurLecture ? <>
          <Text accessibilityRole="alert" style={{ fontFamily: polices.texte, color: c.encre, marginVertical: 20 }}>{erreurLecture}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Réessayer la restauration" onPress={() => { void restaurer(); }} style={{ padding: 16, backgroundColor: c.action, borderRadius: 28, alignItems: 'center' }}><Text style={{ fontFamily: polices.texte, color: c.surface }}>Réessayer la restauration</Text></Pressable>
        </> : <><ActivityIndicator color={c.action} style={{ margin: 24 }} /><Text style={{ fontFamily: polices.texte, color: c.secondaire }}>Restauration du panier et des favoris…</Text></>}
      </View>
    </Modal>
  </Contexte.Provider>;
}
export function useApplication() { const etat = useContext(Contexte); if (!etat) throw new Error('Contexte application absent'); return etat; }
