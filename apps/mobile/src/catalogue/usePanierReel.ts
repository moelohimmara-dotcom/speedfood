import { useEffect, useRef, useState } from 'react';
import type { PageMenu, PlatCataloguePublic, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { ajouter, quantite, vide, type PanierReel } from './panier-reel';
import { ouvrirPanierReel } from '../stockage/panier-reel-sqlite';
import type { SessionPanierReel } from '../stockage/panier-reel-session';
import { creerLecteurCatalogue } from './client';
import { preparerRecommande, type MemoCommande, type PlanRecommande } from './recommande';
const lecteur = creerLecteurCatalogue();
export function usePanierReel() {
  const [panier, setPanier] = useState(vide);
  const actuel = useRef(panier); const session = useRef<SessionPanierReel | null>(null);
  const revision = useRef(0); const generation = useRef(0);
  const verification = useRef(0);
  const [pret, setPret] = useState(false); const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState('Restauration du panier…');
  const [menu, setMenu] = useState<PageMenu | null>(null);
  const [lecture, setLecture] = useState(false); const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [prixModifies, setPrixModifies] = useState(false);
  async function restaurer() {
    const n = ++generation.current; setErreur(null); setStatut('Restauration du panier…');
    try { const s = await ouvrirPanierReel(); const p = await s.charger(); if (n !== generation.current) return; session.current = s; actuel.current = p; setPanier(p); setPret(true); setStatut('Panier restauré sur cet appareil'); }
    catch (e) { if (n === generation.current) { setStatut('Panier non restauré'); const bloque = e instanceof Error && /Access Handle|Invalid VFS|createSyncAccessHandle/.test(e.message); setErreur(bloque ? 'Le stockage web est occupé par un autre onglet. Fermez les autres aperçus de cette adresse, puis réessayez. Aucune donnée effacée.' : 'Impossible de restaurer le panier. Ses données n’ont pas été effacées.'); } }
  }
  useEffect(() => { void restaurer(); return () => { generation.current++; revision.current++; verification.current++; }; }, []);
  function sauver(p: PanierReel) {
    const s = session.current; if (!s) return;
    const n = ++revision.current; setStatut('Enregistrement du panier…'); setErreur(null);
    void s.sauver(p).then(() => { if (n === revision.current) setStatut('Panier enregistré sur cet appareil'); }, () => { if (n === revision.current) { setStatut('Panier non enregistré'); setErreur('La sauvegarde a échoué. Les modifications restent en mémoire.'); } });
  }
  function modifier(p: PanierReel) { if (!pret) throw Error('STOCKAGE_NON_CHARGE'); actuel.current = p; setPanier(p); sauver(p); }
  async function recharger() {
    const numero = ++verification.current;
    const id = actuel.current.restaurantId;
    if (!id) { setMenu(null); return; }
    setLecture(true); setErreurLecture(null); setPrixModifies(false);
    try {
      let page = await lecteur.menu(id); let plats = [...page.plats]; const vus = new Set<string>();
      while (page.suivant && actuel.current.lignes.some(l => !plats.some(p => p.id === l.platId))) {
        if (vus.has(page.suivant) || vus.size >= 50) throw Error('MENU_TROP_LONG');
        vus.add(page.suivant); page = await lecteur.menu(id, page.suivant); plats.push(...page.plats);
      }
      if (numero !== verification.current || actuel.current.restaurantId !== id) return;
      setPrixModifies(!!menu && menu.restaurant.id === id && plats.some(p => menu.plats.some(a => a.id === p.id && a.prixGnf !== p.prixGnf)));
      setMenu({ ...page, plats });
    } catch { if (numero === verification.current) setErreurLecture('Impossible de vérifier le menu actuel. Le total ne peut pas être confirmé ; votre sélection est conservée.'); }
    finally { if (numero === verification.current) setLecture(false); }
  }
  return { panier, pret, erreur, statut, menu, lecture, erreurLecture, prixModifies, recharger,
    reessayer: () => { if (pret) sauver(actuel.current); else void restaurer(); },
    ajouter: (r: RestaurantPublic, p: PlatCataloguePublic, optionIds: readonly string[] = []) => { modifier(ajouter(actuel.current, r.id, p, optionIds)); verification.current++; setLecture(false); setMenu(null); },
    /** « Vider et ajouter » (changement de restaurant, confirmé par la personne) : le panier repart de zéro avec ce plat. */
    remplacerEtAjouter: (r: RestaurantPublic, p: PlatCataloguePublic, optionIds: readonly string[] = []) => { modifier(ajouter(vide(), r.id, p, optionIds)); verification.current++; setLecture(false); setMenu(null); setErreurLecture(null); },
    /**
     * « Commander à nouveau » : relit le menu ACTUEL du restaurant puis remplace le panier par les lignes encore disponibles (voir `preparerRecommande`). Le panier n'est touché que
     * s'il reste au moins une ligne ; une erreur de lecture le laisse intact et se propage. L'appelant a déjà fait confirmer le changement de restaurant.
     */
    recommander: async (memo: MemoCommande): Promise<PlanRecommande> => {
      if (!pret) throw Error('STOCKAGE_NON_CHARGE');
      let page = await lecteur.menu(memo.restaurantId); const plats = [...page.plats]; const vus = new Set<string>();
      while (page.suivant && memo.lignes.some(l => !plats.some(p => p.id === l.platId))) {
        if (vus.has(page.suivant) || vus.size >= 50) throw Error('MENU_TROP_LONG');
        vus.add(page.suivant); page = await lecteur.menu(memo.restaurantId, page.suivant); plats.push(...page.plats);
      }
      const plan = preparerRecommande(memo, plats);
      if (plan.ajoutes > 0) { modifier(plan.panier); verification.current++; setLecture(false); setMenu(null); setErreurLecture(null); }
      return plan;
    },
    /** `cle` : clé de la ligne (`cleLigne`) ; pour une ligne sans supplément, l'identifiant du plat. */
    quantite: (cle: string, n: number) => modifier(quantite(actuel.current, cle, n)),
    vider: () => { modifier(vide()); verification.current++; setLecture(false); setMenu(null); setErreurLecture(null); },
  };
}
