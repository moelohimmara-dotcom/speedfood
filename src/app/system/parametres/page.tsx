import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerParametresApplication } from "@/lib/system-admin/parametres";
import { Card, Alert } from "@/components/ui";
import { SousNav } from "../SousNav";
import { FormulaireParametres } from "./FormulaireParametres";

/**
 * Paramètres globaux de l'application, réservé à `super_admin`
 * (permission `parametres.editer`). Un seul groupe de réglages pour l'instant
 * (migration `parametres_et_medias`) : le délai de réponse à une proposition
 * client et le plafond de prix d'un plat — les seules règles métier qui
 * étaient jusqu'ici en dur dans le code ou en variable d'environnement.
 */
export default async function ParametresSystemePage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const parametres = await listerParametresApplication();

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Paramètres</h1>
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
        Le jeton de suivi des commandes (`COMMANDE_JETON_SECRET`) n&apos;est jamais
        modifiable ici : changer sa valeur invaliderait tous les liens de suivi déjà
        envoyés aux clients. Il reste géré comme secret Cloudflare.
      </Alert>

      <Card>
        <FormulaireParametres parametres={parametres} />
      </Card>
    </div>
  );
}
