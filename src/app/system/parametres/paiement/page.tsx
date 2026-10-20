import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireReglagesAdmin } from "@/lib/paiement/en-ligne/admin-lectures";
import { Alert } from "@/components/ui";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../SousNav";
import { FormulaireReglagesPaiement } from "./FormulaireReglagesPaiement";

export const metadata = { title: "Paiement en ligne (paramètres)" };
export const dynamic = "force-dynamic";

/** Réglages du paiement en ligne, réservés à `super_admin` (permission `parametres.editer`). Voir docs/PAIEMENT-ARCHITECTURE.md. */
export default async function ReglagesPaiementPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const reglages = await lireReglagesAdmin();

  return (
    <div>
      <LienRetour href="/system/parametres">Paramètres</LienRetour>
      <PageHeader titre="Paiement en ligne" description="Interrupteur, fournisseur, frais et plafonds. Réservé aux super administrateurs." />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />
      {reglages.valeursValideesLe === null ? (
        <Alert ton="info" className="u-mb-s4">
          Les valeurs ci-dessous sont des <strong>valeurs de simulation</strong> : elles seront remplacées par les valeurs réelles, sans déploiement.
        </Alert>
      ) : null}
      <FormulaireReglagesPaiement reglages={reglages} />
      <div className="u-mt-s6">
        <Panneau titre="Comptes de versement">
          <p className="u-mt-0">Numéro mobile money où Speedfood verse chaque restaurant et chaque livreur. Un compte n&apos;est utilisé qu&apos;après vérification.</p>
          <Link href="/system/parametres/paiement/comptes" className="lien-texte">
            Gérer les comptes de versement
          </Link>
        </Panneau>
      </div>
    </div>
  );
}
