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
  cloche: 'M6 16c1-1 2-2.5 2-5a4 4 0 0 1 8 0c0 2.5 1 4 2 5z M5 16h14 M10 20a2 2 0 0 0 4 0',
  telephone: 'M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2',
  message: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.1L3 20l1.5-5.4A8.5 8.5 0 1 1 21 11.5',
  cadenas: 'M7 11h10a1 1 0 0 1 1 1v9H6v-9a1 1 0 0 1 1-1 M9 11V7a3 3 0 0 1 6 0v4 M12 16v2',
  deconnexion: 'M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3 M16 17l5-5-5-5 M21 12H9',
  corbeille: 'M4 7h16 M10 11v7 M14 11v7 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13 M9 7V4h6v3',
  crayon: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  camera: 'M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1 M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  actualiser: 'M21 12a9 9 0 1 1-2.6-6.4 M21 3v6h-6',
  externe: 'M15 3h6v6 M21 3l-9 9 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  document: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M14 3v4h4 M9.5 12h5 M9.5 16h5',
  engrenage: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M12 2.5v2.6 M12 18.9v2.6 M2.5 12h2.6 M18.9 12h2.6 M5 5l1.8 1.8 M17.2 17.2L19 19 M19 5l-1.8 1.8 M6.8 17.2L5 19',
  eclair: 'M13 2L4.5 13.5H11L9.5 22 19 10h-6.5z',
  plat: 'M3 20h18 M4 17a8 8 0 0 1 16 0z M12 9V7.5 M9.5 5h5',
  liste: 'M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 11v5 M12 7.5h.01',
  alerte: 'M12 3.5L2.5 20h19z M12 10v4.5 M12 17.5h.01',
  partage: 'M12 15V4 M7.5 7.5L12 3l4.5 4.5 M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8',
  etoile: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
} as const;
export type NomIcone = keyof typeof traces;
export function Icone({ nom, taille = 22, couleur = couleurs.encre, rempli = false }: { nom: NomIcone; taille?: number; couleur?: string; rempli?: boolean }) {
  return <Svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden={true}>
    <Path d={traces[nom]} stroke={couleur} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill={rempli ? couleur : 'none'} />
  </Svg>;
}
