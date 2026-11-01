import Svg, { Path } from 'react-native-svg';
import { couleurs } from './tokens';
const traces = {
  accueil: 'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',
  coeur: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  panier: 'M3 4h2l3 12h11l3-9H6 M9 21h.01 M18 21h.01',
  compte: 'M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  recherche: 'M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M15 15l6 6',
  position: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  retour: 'M15 5 8 12l7 7 M8 12h13',
  fleche: 'M5 12h14 M13 6l6 6-6 6',
  bas: 'm6 9 6 6 6-6',
  plus: 'M12 5v14 M5 12h14',
  moins: 'M5 12h14',
  coche: 'm5 12 4 4L19 6',
  horloge: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2',
  fermer: 'm6 6 12 12 M6 18 18 6',
} as const;
export type NomIcone = keyof typeof traces;
export function Icone({ nom, taille = 22, couleur = couleurs.encre, rempli = false }: { nom: NomIcone; taille?: number; couleur?: string; rempli?: boolean }) {
  return <Svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden={true}>
    <Path d={traces[nom]} stroke={couleur} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill={rempli ? couleur : 'none'} />
  </Svg>;
}
