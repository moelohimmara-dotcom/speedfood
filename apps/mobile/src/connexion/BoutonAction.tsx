import { Bouton } from '../design/Composants';
import type { NomIcone } from '../design/Icone';

/**
 * Bouton des écrans métier (restaurateur, livreur) : délègue au bouton canonique de `design/Composants`
 * (phase 2 de la refonte — un seul bouton dans l'application). Cet alias garde les appels existants inchangés.
 */
export function Action({ titre, agir, disabled = false, secondaire = false, icone, iconeSeule = false }: { titre: string; agir(): void; disabled?: boolean; secondaire?: boolean; icone?: NomIcone; iconeSeule?: boolean }) {
  return <Bouton titre={titre} onPress={agir} disabled={disabled} secondaire={secondaire} icone={icone} iconeSeule={iconeSeule} />;
}
