import Link from "next/link";
import { Panneau } from "@/components/admin/blocs";
import { IconeAdmin } from "@/components/admin/icones";

/**
 * Accès rapides du tableau de bord : les actions de commandement fréquentes, chacune déjà filtrée sur l'écran d'action
 * concerné. Les entrées sont construites côté serveur selon les permissions du rôle courant.
 */
export interface ActionRapide {
  href: string;
  libelle: string;
  description: string;
}

export function AccesRapides({ actions }: { actions: ActionRapide[] }) {
  return (
    <Panneau titre="Accès rapides" sansMarge>
      <ul className="ad-liste">
        {actions.map((action) => (
          <li key={action.href + action.libelle}>
            <Link href={action.href} className="ad-liste-lien">
              <span className="ad-liste-texte">
                <span className="ad-liste-titre">{action.libelle}</span>
                <span className="ad-liste-meta">{action.description}</span>
              </span>
              <span className="ad-liste-fin">
                <IconeAdmin nom="chevron" taille={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panneau>
  );
}
