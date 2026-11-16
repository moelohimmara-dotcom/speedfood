import type { ComponentType } from 'react';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bell from 'lucide-react-native/icons/bell';
import Bike from 'lucide-react-native/icons/bike';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ChefHat from 'lucide-react-native/icons/chef-hat';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleHelp from 'lucide-react-native/icons/circle-help';
import Clock from 'lucide-react-native/icons/clock';
import ExternalLink from 'lucide-react-native/icons/external-link';
import FileText from 'lucide-react-native/icons/file-text';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import List from 'lucide-react-native/icons/list';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Minus from 'lucide-react-native/icons/minus';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Plus from 'lucide-react-native/icons/plus';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Share from 'lucide-react-native/icons/share';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Star from 'lucide-react-native/icons/star';
import Store from 'lucide-react-native/icons/store';
import Trash2 from 'lucide-react-native/icons/trash-2';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import UtensilsCrossed from 'lucide-react-native/icons/utensils-crossed';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';
import { couleurs } from './tokens';

/**
 * Jeu d'icônes de l'application : Lucide (licence ISC), une grille de 24 px, trait de 2 px, extrémités arrondies : un seul dessin, cohérent partout.
 * Les noms sont ceux d'avant (français) pour que les écrans ne changent pas ; chaque icône est importée seule, jamais le jeu entier.
 */
interface PropsLucide { size?: number; color?: string; strokeWidth?: number; fill?: string; 'aria-hidden'?: boolean }
const icones = {
  accueil: House, coeur: Heart, panier: ShoppingCart, compte: User, recherche: Search, position: MapPin,
  retour: ArrowLeft, fleche: ArrowRight, bas: ChevronDown, chevron: ChevronRight, plus: Plus, moins: Minus, coche: Check, horloge: Clock, fermer: X,
  cloche: Bell, telephone: Phone, message: MessageCircle, cadenas: Lock, deconnexion: LogOut, corbeille: Trash2, crayon: Pencil, camera: Camera,
  actualiser: RefreshCw, externe: ExternalLink, document: FileText, engrenage: Settings, eclair: Zap, plat: UtensilsCrossed, liste: List, info: Info,
  alerte: TriangleAlert, partage: Share, etoile: Star,
  livreur: Bike, restaurateur: ChefHat, equipe: Users, restaurant: Store, recu: ReceiptText, aide: CircleHelp,
} as const satisfies Record<string, ComponentType<PropsLucide>>;
export type NomIcone = keyof typeof icones;
export function Icone({ nom, taille = 24, couleur = couleurs.encre, rempli = false }: { nom: NomIcone; taille?: number; couleur?: string; rempli?: boolean }) {
  const Dessin: ComponentType<PropsLucide> = icones[nom];
  return <Dessin size={taille} color={couleur} strokeWidth={2} fill={rempli ? couleur : 'none'} aria-hidden={true} />;
}
