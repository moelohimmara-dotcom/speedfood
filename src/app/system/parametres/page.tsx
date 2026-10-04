import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerParametresApplication } from "@/lib/system-admin/parametres";
import { Alert } from "@/components/ui";
import { PageHeader } from "@/components/admin/blocs";
import { FormulaireParametres } from "./FormulaireParametres";

export const metadata = { title: "Paramètres (administration)" };

/**
 * Paramètres globaux de l'application, réservé à `super_admin`
 * (permission `parametres.editer`). Un seul groupe de réglages pour l'instant
 * (migration `parametres_et_medias`) : le délai de réponse à une proposition
 * client et le plafond de prix d'un plat — les seules règles métier qui
 * étaient jusqu'ici en dur dans le code ou en variable d'environnement.
 */
export default async function ParametresSystemePage() {
  await exigerPermissionPage("parametres.editer");
  const parametres = await listerParametresApplication();

  return (
    <div>
      <PageHeader titre="Paramètres" description="Règles métier, comptes clients, assistance et textes d'accueil. Réservé aux super administrateurs." />

      <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
        Le jeton de suivi des commandes (`COMMANDE_JETON_SECRET`) n&apos;est jamais
        modifiable ici : changer sa valeur invaliderait tous les liens de suivi déjà
        envoyés aux clients. Il reste géré comme secret Cloudflare.
      </Alert>

      <FormulaireParametres parametres={parametres} />
    </div>
  );
}
