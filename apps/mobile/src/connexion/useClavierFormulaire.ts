import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type ScrollView, type TextInput } from 'react-native';
import { cibleDefilement, margeBasseClavier } from './clavier';

/**
 * Clavier d'un formulaire dans un `Modal` Android (essai du 18/11/2026 : sur l'écran « Valider ma commande », le clavier recouvrait le champ Téléphone qu'on venait de toucher).
 * Mécanisme du lot D3b, déjà employé par les espaces livreur et restaurateur, ici partagé : marge basse = hauteur du clavier (Android), défilement vers le champ actif.
 * Usage : `ref={k.defilement}` et `contentContainerStyle={[s.contenu, k.margeBasse(22)]}` sur le `ScrollView`, puis sur chaque champ
 * `ref={k.reference('nom')} onFocus={k.auFocus('nom')} onBlur={k.auBlur}`. Si une version d'Android redimensionne quand même la fenêtre, la marge n'est qu'un espace en plus.
 */
export function useClavierFormulaire() {
  const defilement = useRef<ScrollView>(null);
  const champActif = useRef<TextInput | null>(null);
  const champs = useRef<Record<string, TextInput | null>>({});
  const [hauteurClavier, setHauteurClavier] = useState(0);
  function defilerVersChampActif() {
    const champ = champActif.current; const zone = defilement.current;
    const contenu = zone && (zone as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.();
    if (!champ || !zone || !contenu) return;
    try { champ.measureLayout(contenu as never, (_x, y) => { zone.scrollTo({ y: cibleDefilement(y), animated: true }); }, () => {}); } catch { /* mesure impossible : l'écran reste utilisable en défilant à la main */ }
  }
  useEffect(() => {
    const montre = Keyboard.addListener('keyboardDidShow', e => { setHauteurClavier(e.endCoordinates?.height ?? 0); setTimeout(defilerVersChampActif, 80); });
    const cache = Keyboard.addListener('keyboardDidHide', () => setHauteurClavier(0));
    return () => { montre.remove(); cache.remove(); };
  }, []);
  return {
    defilement,
    hauteurClavier,
    /** Marge basse du contenu défilant : `base` + hauteur du clavier sous Android. */
    margeBasse: (base: number) => ({ paddingBottom: base + margeBasseClavier(hauteurClavier, Platform.OS) }),
    reference: (nom: string) => (t: TextInput | null) => { champs.current[nom] = t; },
    auFocus: (nom: string) => () => { champActif.current = champs.current[nom] ?? null; setTimeout(defilerVersChampActif, 80); },
    auBlur: () => { champActif.current = null; },
    /** Les trois propriétés d'un champ : `<TextInput {...k.champ('nom')} />`. */
    champ: (nom: string) => ({
      ref: (t: TextInput | null) => { champs.current[nom] = t; },
      onFocus: () => { champActif.current = champs.current[nom] ?? null; setTimeout(defilerVersChampActif, 80); },
      onBlur: () => { champActif.current = null; },
    }),
  };
}
