import { notFound } from "next/navigation";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { lireEtatDemonstration } from "@/lib/system-admin/demonstration";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { Alert } from "@/components/ui";
import { PanneauDemonstration } from "./PanneauDemonstration";

export const metadata = { title: "Contenu de démonstration" };

/** Gestion du contenu de démonstration : page invisible (404) pour tout rôle autre que super administrateur. */
export default async function DemonstrationPage() {
  await exigerPermissionPage("parametres.editer");
  const contexte = await obtenirContexteSysteme();
  if (contexte.role !== "super_admin") notFound();
  const [etat, mfa] = await Promise.all([lireEtatDemonstration(), lireEtatMfa(contexte.supabase)]);

  return (
    <div>
      <PageHeader
        titre="Contenu de démonstration"
        retour={{ href: "/system/parametres", libelle: "Paramètres" }}
        description="Faux restaurants, plats, avis, commandes d'historique et livreurs, affichés comme de vraies données. Rien n'indique « démo » au public."
      />
      {etat === null ? (
        <Alert ton="danger">Impossible de lire l&apos;état de la démonstration. Réessayez dans un instant.</Alert>
      ) : (
        <PanneauDemonstration etat={etat} sessionRenforcee={mfa.actif && mfa.sessionRenforcee} mfaActive={mfa.actif} />
      )}
      <div className="u-h-s5" />
      <Panneau titre="Comment ça marche">
        <ul className="u-mt-0">
          <li>Une commande passée par un client chez un faux restaurant est automatiquement une commande de test : elle n&apos;arrive à aucun vrai restaurateur et ne compte pas dans les vrais chiffres.</li>
          <li>Masquer retire la démonstration du site, de l&apos;application et des chiffres d&apos;accueil, sans rien perdre. Réafficher la remet.</li>
          <li>Pour modifier un faux restaurant ou un plat, utilisez les écrans habituels de la console : ce sont de vraies fiches.</li>
          <li>Avant l&apos;ouverture à de vrais clients, masquez ou supprimez la démonstration.</li>
        </ul>
      </Panneau>
    </div>
  );
}
