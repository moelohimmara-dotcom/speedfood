import { CommandeClient } from "./CommandeClient";

/**
 * La clé de site Turnstile est publique mais lue à l'exécution côté serveur (variable du
 * Worker `TURNSTILE_SITE_KEY`) puis transmise au composant client : pas de variable à
 * intégrer au build. Absente = vérification anti-robot désactivée.
 */
export const dynamic = "force-dynamic";

export default function CommandePage() {
  return <CommandeClient cleSiteTurnstile={process.env.TURNSTILE_SITE_KEY || undefined} />;
}
