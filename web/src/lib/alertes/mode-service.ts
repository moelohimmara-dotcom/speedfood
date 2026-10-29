// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Mode service du restaurateur : l'écran reste allumé pendant le service pour que le carillon et la liste des commandes ne s'endorment pas.
 * Ce module décide de ce qu'on DIT au restaurateur ; il ne touche à aucune API du navigateur (voir `ModeService.tsx`).
 * Règle : ne jamais afficher « actif » quand l'écran n'est pas réellement gardé allumé. Un restaurateur qui se croit alerté perd des clients.
 */
export type NiveauService = "inactif" | "actif" | "pause" | "non_supporte";

export interface EntreeService {
  /** Le restaurateur a activé le mode service. */
  voulu: boolean;
  /** Le navigateur propose la garde d'écran (Screen Wake Lock). */
  supporte: boolean;
  /** Le navigateur a accordé la garde et ne l'a pas retirée. */
  verrouActif: boolean;
  /** La connexion réseau est présente. */
  enLigne: boolean;
  /** L'onglet est affiché (le navigateur retire la garde d'un onglet caché). */
  visible: boolean;
}

export interface SortieService {
  niveau: NiveauService;
  /** Phrase affichée à côté du bouton. */
  message: string;
}

export function etatService(e: EntreeService): SortieService {
  if (!e.supporte) {
    return {
      niveau: "non_supporte",
      message: "Ce navigateur ne peut pas garder l'écran allumé. Les alertes marchent, mais réglez la veille de l'appareil sur « jamais » pendant le service.",
    };
  }
  if (!e.voulu) {
    return { niveau: "inactif", message: "Mode service désactivé : l'écran peut s'éteindre." };
  }
  if (!e.enLigne) {
    return { niveau: "pause", message: "Service en pause : pas de réseau. Les commandes n'arrivent plus tant que la connexion n'est pas revenue." };
  }
  if (!e.verrouActif) {
    return e.visible
      ? { niveau: "pause", message: "Le navigateur n'a pas gardé l'écran allumé (batterie faible ou économie d'énergie ?). Branchez l'appareil, puis réessayez." }
      : { niveau: "pause", message: "Page en arrière-plan : l'écran reste allumé dès que vous revenez sur Speedfood." };
  }
  return { niveau: "actif", message: "Service actif : l'écran reste allumé et les alertes sont en marche." };
}
