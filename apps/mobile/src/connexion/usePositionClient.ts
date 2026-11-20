import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointCarte } from './livraison-suivi';
import { INTERVALLE_POSITION_MS, situerClient, type DependancesPosition } from './position-client';
import { positionTelephone } from './position-telephone';
/**
 * Position du client pour la carte de sa livraison : éteinte tant qu'il ne l'a pas demandée ; une fois demandée, relue toutes les 15 secondes pendant que l'écran est ouvert.
 * Elle vit dans l'état de l'écran seulement : elle n'est ni envoyée, ni conservée. Une relecture qui échoue garde la dernière position connue ; une autorisation retirée entre-temps
 * éteint la position et le dit.
 */
export type EtatPosition = 'eteinte' | 'recherche' | 'active' | 'refusee' | 'indisponible';
export function usePositionClient(dependances: DependancesPosition = positionTelephone): { etat: EtatPosition; vous: PointCarte | null; activer(): void; desactiver(): void } {
  const [etat, setEtat] = useState<EtatPosition>('eteinte');
  const [vous, setVous] = useState<PointCarte | null>(null);
  const vivant = useRef(true);
  const voulu = useRef(false);
  useEffect(() => { vivant.current = true; return () => { vivant.current = false; voulu.current = false; }; }, []);
  const lire = useCallback(async (premiere: boolean) => {
    const r = await situerClient(dependances);
    if (!vivant.current || !voulu.current) return;
    if (r.genre === 'ok') { setVous(r.point); setEtat('active'); return; }
    if (premiere || r.genre === 'refusee') { voulu.current = false; setVous(null); setEtat(r.genre === 'refusee' ? 'refusee' : 'indisponible'); }
  }, [dependances]);
  const activer = useCallback(() => { voulu.current = true; setEtat('recherche'); void lire(true); }, [lire]);
  const desactiver = useCallback(() => { voulu.current = false; setVous(null); setEtat('eteinte'); }, []);
  useEffect(() => {
    if (etat !== 'active') return;
    const minuterie = setInterval(() => { void lire(false); }, INTERVALLE_POSITION_MS);
    return () => clearInterval(minuterie);
  }, [etat, lire]);
  return { etat, vous, activer, desactiver };
}
