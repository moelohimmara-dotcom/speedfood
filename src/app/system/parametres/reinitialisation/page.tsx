import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { Alert } from "@/components/ui";
import { FormulaireReinitialisation } from "./FormulaireReinitialisation";

export const metadata = { title: "Réinitialisation de l'application" };

/**
 * Remise de toute l'application à l'état neuf. Page invisible (404) pour tout rôle autre que super administrateur ; la
 * double authentification est exigée, et chaque action la revérifie côté serveur et dans la base.
 */
export default async function ReinitialisationPage() {
  await exigerPermissionPage("parametres.editer");
  const contexte = await obtenirContexteSysteme();
  if (contexte.role !== "super_admin") {
    notFound();
  }
  const mfa = await lireEtatMfa(contexte.supabase);

  return (
    <div>
      <PageHeader
        titre="Réinitialiser l'application"
        retour={{ href: "/system/parametres", libelle: "Paramètres" }}
        description="À utiliser une seule fois, avant d'enregistrer les vraies données de production."
      />
      <Alert ton="danger">
        Zone dangereuse. Cette action supprime tous les restaurants, menus, commandes, clients et comptes (sauf super administrateurs). Elle est
        enregistrée dans le journal d&apos;audit.
      </Alert>
      <div style={{ height: "var(--space-5)" }} />
      {!mfa.actif ? (
        <Panneau titre="Double authentification requise">
          <p style={{ marginTop: 0 }}>
            Pour votre sécurité, cette action n&apos;est possible qu&apos;avec la double authentification activée sur votre compte.
          </p>
          <Link href="/compte/securite" className="lien-texte">
            Activer la double authentification
          </Link>
        </Panneau>
      ) : !mfa.sessionRenforcee ? (
        <Panneau titre="Confirmez votre identité">
          <p style={{ marginTop: 0 }}>
            Déconnectez-vous puis reconnectez-vous en saisissant le code de votre application : la session doit être renforcée pour continuer.
          </p>
        </Panneau>
      ) : (
        <FormulaireReinitialisation />
      )}
    </div>
  );
}
