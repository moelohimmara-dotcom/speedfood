/** Câblage pur (testable sans le natif) entre le service de notifications, la session et la plateforme. */
export type NomPlateforme = 'android' | 'ios';
/** La vraie plateforme, ou `null` (web, autre) : rien n'est alors envoyé au serveur. */
export function plateformeDe(os: string): NomPlateforme | null { return os === 'ios' ? 'ios' : os === 'android' ? 'android' : null; }

export interface SessionBranchable { avantDeconnexion?: (acces: string) => Promise<void>; preparerDeconnexion?: () => (acces: string | null) => Promise<void>; apresOuverture?: () => void }
export interface ServiceBranchable { avantDeconnexion(acces: string): Promise<void>; preparerDeconnexion?(): (acces: string | null) => Promise<void>; sessionOuverte(): Promise<unknown> }
/** La déconnexion retire l'appareil AVANT l'effacement de la session ; l'ouverture d'une session le réenregistre (si l'autorisation est déjà accordée) et peut déclencher l'autorisation C. */
export function brancherSession(session: SessionBranchable, service: ServiceBranchable) {
  session.avantDeconnexion = acces => service.avantDeconnexion(acces);
  if (service.preparerDeconnexion) session.preparerDeconnexion = () => service.preparerDeconnexion!();
  session.apresOuverture = () => { void service.sessionOuverte(); };
}
