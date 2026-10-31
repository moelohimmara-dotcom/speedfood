import type { VersionApplication } from "@speedfood/shared/application/version";

/** Tout ce que les routes ont le droit d'appeler : injecté en production par `worker.ts`, remplacé par de fausses valeurs dans les tests. */
export interface Deps {
  version: VersionApplication;
  lireAssistance(): Promise<{ whatsapp: string | null }>;
}
