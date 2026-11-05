/** Câblage pur (testable sans le natif) entre le service de notifications, la session et la plateforme. */
export type NomPlateforme = 'android' | 'ios';
/** La vraie plateforme, ou `null` (web, autre) : rien n'est alors envoyé au serveur. */
export function plateformeDe(os: string): NomPlateforme | null { return os === 'ios' ? 'ios' : os === 'android' ? 'android' : null; }

export interface SessionBranchable { avantDeconnexion?: (acces: string) => Promise<void>; apresOuverture?: () => void }
export interface ServiceBranchable { avantDeconnexion(acces: string): Promise<void>; sessionOuverte(): Promise<void> }
/** La déconnexion retire l'appareil AVANT l'effacement de la session ; l'ouverture d'une session le réenregistre (si l'autorisation est déjà accordée). */
export function brancherSession(session: SessionBranchable, service: ServiceBranchable) {
  session.avantDeconnexion = acces => service.avantDeconnexion(acces);
  session.apresOuverture = () => { void service.sessionOuverte(); };
}
