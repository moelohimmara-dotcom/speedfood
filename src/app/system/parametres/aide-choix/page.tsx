import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerReglagesAideChoix } from "@/lib/system-admin/aide-choix";
import { PageHeader } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../SousNav";
import { FormulaireAideChoix } from "./FormulaireAideChoix";

export const metadata = { title: "Aide au choix (administration)" };
export const dynamic = "force-dynamic";

/** Réglages de l'assistant « Aide-moi à choisir », réservés à `super_admin`. Voir docs/AIDE-AU-CHOIX.md. */
export default async function ReglagesAideChoixPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const valeurs = await listerReglagesAideChoix();

  return (
    <div>
      <LienRetour href="/system/parametres">Paramètres</LienRetour>
      <PageHeader titre="Aide au choix" description="Seuils des gammes de prix, rayon de recherche et nombre de propositions de l'assistant « Aide-moi à choisir »." />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />
      <FormulaireAideChoix valeurs={valeurs} />
    </div>
  );
}
