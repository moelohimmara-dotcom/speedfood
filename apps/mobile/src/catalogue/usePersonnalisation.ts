import { useCallback, useEffect, useRef, useState } from 'react';
import { gestion } from '../connexion/gestion';
import { positionTelephone } from '../connexion/position-telephone';
import { MESSAGE_POSITION_INDISPONIBLE, MESSAGE_POSITION_REFUSEE, situerClient } from '../connexion/position-client';
import { versProfil } from '../../../../packages/shared/src/contracts/preferences';
import { HABITUDES_VIDES, type Position } from '../../../../packages/shared/src/menu/classement-personnalise';
import { CONTEXTE_NEUTRE, type ContextePerso } from './recherche-perso';

export interface EtatPersonnalisation {
  contexte: ContextePerso;
  /** Le client est connecté. */
  connecte: boolean;
  /** Il a enregistré des préférences (sinon on l'invite à le faire). */
  aDesPreferences: boolean;
  chargement: boolean;
  /** Message sur la position (refus, introuvable) ; vide sinon. */
  messagePosition: string;
  situer(): Promise<void>;
}

/**
 * Contexte de personnalisation de la recherche : profil et habitudes du compte (si connecté, relus à chaque nouvelle recherche : jamais un profil resté après une déconnexion),
 * et position OPTIONNELLE demandée seulement quand le client appuie sur « Trier par distance ». Tout reste sur le téléphone. Une panne de lecture donne une recherche neutre, jamais bloquée.
 */
export function usePersonnalisation(demande: boolean): EtatPersonnalisation {
  const [contexte, setContexte] = useState<ContextePerso>(CONTEXTE_NEUTRE);
  const [connecte, setConnecte] = useState(false); const [aDesPreferences, setADesPreferences] = useState(false); const [chargement, setChargement] = useState(false);
  const [messagePosition, setMessagePosition] = useState('');
  const position = useRef<Position | null>(null);
  useEffect(() => {
    if (!demande) return;
    const estConnecte = gestion.connectee;
    setConnecte(estConnecte);
    if (!estConnecte) { setContexte({ ...CONTEXTE_NEUTRE, position: position.current }); setADesPreferences(false); return; }
    let actif = true; setChargement(true);
    void Promise.allSettled([gestion.preferencesClient(), gestion.habitudesClient()]).then(([p, h]) => {
      if (!actif) return;
      const prefs = p.status === 'fulfilled' ? p.value : null;
      setADesPreferences(prefs !== null);
      setContexte({ profil: versProfil(prefs), habitudes: h.status === 'fulfilled' ? h.value : HABITUDES_VIDES, position: position.current });
    }).finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [demande]);
  const situer = useCallback(async () => {
    setMessagePosition('');
    const r = await situerClient(positionTelephone);
    if (r.genre === 'ok') { position.current = { latitude: r.point.latitude, longitude: r.point.longitude }; setContexte(c => ({ ...c, position: position.current })); }
    else setMessagePosition(r.genre === 'refusee' ? MESSAGE_POSITION_REFUSEE : MESSAGE_POSITION_INDISPONIBLE);
  }, []);
  return { contexte, connecte, aDesPreferences, chargement, messagePosition, situer };
}
