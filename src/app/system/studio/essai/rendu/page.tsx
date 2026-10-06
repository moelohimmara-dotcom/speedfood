import type { Metadata } from "next";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { donneesExemple } from "@/lib/studio/blocs/config";
import { RenduPage } from "@/lib/studio/blocs/rendu";

export const metadata: Metadata = { title: "Essai de rendu (administration)", robots: { index: false, follow: false } };

/**
 * Rendu serveur d'un JSON d'exemple, sans l'éditeur ni le `Render` de Puck (voir `RenduPage`). Le contrôle de permission reste
 * celui de l'essai ; une vraie page publique n'en aurait pas.
 */
export default async function EssaiRenduPage() {
  await exigerPermissionPage("contenu.editer");
  return (
    <div data-testid="rendu-serveur" style={{ display: "grid", gap: "var(--space-3)" }}>
      <RenduPage donnees={donneesExemple} />
    </div>
  );
}
