import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerReglagesClassement } from "@/lib/system-admin/classement";
import { PageHeader } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../SousNav";
import { FormulaireClassement } from "./FormulaireClassement";

export const metadata = { title: "Classement (administration)" };
export const dynamic = "force-dynamic";

/** Poids du classement « recommandés » du catalogue, réservés à `super_admin`. Voir docs/NOTATION.md §9. */
export default async function ReglagesClassementPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const valeurs = await listerReglagesClassement();

  return (
    <div>
      <LienRetour href="/system/parametres">Paramètres</LienRetour>
      <PageHeader titre="Classement du catalogue" description="Comment les restaurants sont ordonnés dans « Recommandés » : note des clients, prix des plats et fréquentation. Aucune promotion payante." />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />
      <FormulaireClassement valeurs={valeurs} />
    </div>
  );
}
