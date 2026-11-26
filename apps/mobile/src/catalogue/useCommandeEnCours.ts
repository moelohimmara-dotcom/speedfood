import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { gestion } from '../connexion/gestion';
import type { ResumeSuivi } from '../connexion/commandes';
import { phraseProchaineEtape } from '../connexion/suivi-acteur';
import { libelleStatutSuivi } from '../connexion/suivi-affichage';
import { aRelirePourAccueil, choisirCommandeEnCours, delaiRelectureAccueil, type CommandeEnCours } from './accueil-vivant';
/** Relecture seulement au premier plan, et seulement s'il existe une commande récente à relire (sinon aucun appel réseau) ; le délai se raccourcit tant qu'une commande est en cours (`delaiRelectureAccueil`). */
export interface CommandeEnCoursVue extends CommandeEnCours { libelle: string; phrase: string | null }
/**
 * Commande encore en cours, lue depuis les commandes de CET appareil (aucune connexion exigée). Une panne ou une lecture impossible garde le dernier état connu :
 * l'accueil ne montre jamais une erreur pour ça. `recharger` force une relecture (retour sur l'accueil, commande qui vient de partir).
 */
export function useCommandeEnCours(): { commande: CommandeEnCoursVue | null; recharger(): void } {
  const [commande, setCommande] = useState<CommandeEnCoursVue | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  async function lire() {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const maintenant = Date.now();
      const liste = await gestion.commandesAppareil();
      const aRelire = aRelirePourAccueil(liste, maintenant);
      if (aRelire.length === 0) { if (actif.current) setCommande(null); return; }
      const lus: Record<string, ResumeSuivi> = {};
      await Promise.all(aRelire.map(async v => { try { lus[v.cle] = await gestion.suiviAppareil(v.cle); } catch { /* statut absent : jamais deviné */ } }));
      if (!actif.current) return;
      if (Object.keys(lus).length === 0) return;
      const choisie = choisirCommandeEnCours(liste, lus, maintenant);
      const suivi = choisie ? lus[choisie.cle] : undefined;
      setCommande(choisie && suivi ? { ...choisie, libelle: libelleStatutSuivi(suivi.statut, suivi.etatDerive), phrase: phraseProchaineEtape(suivi) } : null);
    } catch { /* garde le dernier état connu */ }
    finally { enCours.current = false; }
  }
  const commandeConnue = commande !== null;
  useEffect(() => {
    actif.current = true;
    void lire();
    const minuterie = setInterval(() => { if (AppState.currentState === 'active') void lire(); }, delaiRelectureAccueil(commandeConnue));
    return () => { actif.current = false; clearInterval(minuterie); };
  }, [commandeConnue]);
  return { commande, recharger: () => { void lire(); } };
}
