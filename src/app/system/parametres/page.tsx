import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { SousNav } from "../SousNav";
import { listerParametresApplication } from "@/lib/system-admin/parametres";
import { PageHeader, Panneau } from "@/components/admin/blocs";
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
  const contexte = await exigerPermissionPage("parametres.editer");
  const parametres = await listerParametresApplication();

  return (
    <div>
      <PageHeader titre="Paramètres" description="Règles métier, comptes clients, assistance et textes d'accueil. Réservé aux super administrateurs." />

      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      <FormulaireParametres parametres={parametres} />

      <div style={{ marginTop: "var(--space-6)" }}>
        <Panneau titre="Livraison">
          <p style={{ marginTop: 0 }}>Frais de livraison au kilomètre, minimum, gratuité, rayon maximal et temps laissé aux livreurs pour accepter une course.</p>
          <Link href="/system/parametres/livraison" className="lien-texte">
            Régler la livraison
          </Link>
        </Panneau>
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <Panneau titre="Classement du catalogue">
          <p style={{ marginTop: 0 }}>Poids de la note des clients, du prix des plats et de la fréquentation dans l&apos;ordre « Recommandés ».</p>
          <Link href="/system/parametres/classement" className="lien-texte">
            Régler le classement
          </Link>
        </Panneau>
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <Panneau titre="Aide au choix">
          <p style={{ marginTop: 0 }}>Seuils des gammes de prix, rayon de recherche et nombre de propositions de l&apos;assistant « Aide-moi à choisir ».</p>
          <Link href="/system/parametres/aide-choix" className="lien-texte">
            Régler l&apos;aide au choix
          </Link>
        </Panneau>
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <Panneau titre="Zone dangereuse">
          <p style={{ marginTop: 0 }}>
            Remettre toute l&apos;application à l&apos;état neuf avant la mise en production : restaurants, commandes, clients et comptes sont supprimés
            (après une sauvegarde automatique).
          </p>
          <Link href="/system/parametres/reinitialisation" className="lien-texte">
            Réinitialiser l&apos;application
          </Link>
        </Panneau>
      </div>
    </div>
  );
}
