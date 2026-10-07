import "server-only";
import { chargerContexteSysteme } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";

/**
 * L'utilisateur connecté a-t-il une session système avec `contenu.editer` ? Passe par `chargerContexteSysteme` (même contrôle que
 * la console : session, double authentification, rôle lu par la RLS), SANS 404 : une page publique retombe sur son comportement
 * public. Sert à l'aperçu de l'équipe (`?apercu=1`) des pages à blocs et de l'accueil. Une erreur vaut « non ».
 */
export async function peutVoirApercu(): Promise<boolean> {
  try {
    const contexte = await chargerContexteSysteme();
    return !!contexte && roleAPermission(contexte.role, "contenu.editer");
  } catch {
    return false;
  }
}
