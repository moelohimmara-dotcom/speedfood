import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { creerLecteurCatalogue, validerIndexArticles } from './client';
import { ouvrirCacheOuVide } from './cache-catalogue';
import { ouvrirStockageCacheCatalogue } from './cache-catalogue-natif';
import { LETTRES_MINIMUM, chargerIndexRecherche, chercherArticles, echaufferTypes, type IndexRecherche, type ResultatRecherche } from './recherche-appli';

export type EtatRecherche = 'repos' | 'chargement' | 'pret' | 'indisponible';
/** Après un échec de lecture de l'index, nouvel essai seulement au bout de ce délai (pas à chaque lettre tapée). */
const DELAI_NOUVEL_ESSAI_MS = 15_000;

/**
 * Recherche d'articles de l'accueil : l'index est lu au PREMIER besoin (dès deux lettres tapées), jamais au démarrage, puis gardé en mémoire ; la recherche elle-même tourne sur le téléphone,
 * en priorité basse (`useDeferredValue`) pour que la frappe reste fluide. En cas d'échec la recherche de restaurants habituelle continue de fonctionner seule.
 */
export function useRechercheArticles(saisie: string): { etat: EtatRecherche; resultat: ResultatRecherche | null; saisieRetenue: string } {
  const [etat, setEtat] = useState<EtatRecherche>('repos');
  const [index, setIndex] = useState<IndexRecherche | null>(null);
  const enCours = useRef(false);
  const echecLe = useRef(0);
  const demande = saisie.trim().length >= LETTRES_MINIMUM;
  useEffect(() => {
    if (!demande || index !== null || enCours.current) return;
    if (echecLe.current !== 0 && Date.now() - echecLe.current < DELAI_NOUVEL_ESSAI_MS) return;
    enCours.current = true; setEtat('chargement');
    void (async () => {
      try {
        const stockage = await ouvrirCacheOuVide(ouvrirStockageCacheCatalogue);
        const r = await chargerIndexRecherche(creerLecteurCatalogue(), stockage, validerIndexArticles);
        setIndex(r.index); setEtat('pret'); void echaufferTypes(r.index.moteur).catch(() => undefined);
      } catch { echecLe.current = Date.now(); setEtat('indisponible'); }
      finally { enCours.current = false; }
    })();
  }, [demande, index]);
  const saisieRetenue = useDeferredValue(saisie);
  const resultat = useMemo(() => (index ? chercherArticles(saisieRetenue, index) : null), [index, saisieRetenue]);
  return { etat, resultat, saisieRetenue };
}
