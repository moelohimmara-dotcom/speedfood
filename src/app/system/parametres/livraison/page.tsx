import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerReglagesLivraison } from "@/lib/system-admin/livraison";
import { PageHeader } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../SousNav";
import { FormulaireLivraison } from "./FormulaireLivraison";

export const metadata = { title: "Livraison (administration)" };

/** Réglages de livraison, réservés à `super_admin` (permission `parametres.editer`). Voir docs/LIVRAISON.md. */
export default async function ReglagesLivraisonPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const valeurs = await listerReglagesLivraison();

  return (
    <div>
      <LienRetour href="/system/parametres">Paramètres</LienRetour>
      <PageHeader titre="Livraison" description="Frais calculés d'après la distance, comme les plateformes de livraison. Réservé aux super administrateurs." />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />
      <FormulaireLivraison valeurs={valeurs} />
    </div>
  );
}
