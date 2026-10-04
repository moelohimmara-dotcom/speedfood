import Link from "next/link";
import { EtatVide, Panneau, Pastille } from "@/components/admin/blocs";
import { IconeAdmin } from "@/components/admin/icones";

/**
 * File « à traiter » du tableau de bord : uniquement ce qui attend une décision humaine, avec lien direct vers l'écran
 * d'action. Quand le rôle a accès à une file mais qu'elle est vide, un état vide le dit : c'est une information de
 * pilotage en soi.
 */
export interface LigneFilePriorite {
  href: string;
  titre: string;
  meta: string;
  badge: string;
  ton: "succes" | "danger" | "neutre";
}

export function FilePrioritaire({ lignes, notesDeTest = 0 }: { lignes: LigneFilePriorite[]; notesDeTest?: number }) {
  return (
    <Panneau id="file-prioritaire" titre="À traiter" compteur={lignes.length > 0 ? lignes.length : undefined} sansMarge>
      {lignes.length === 0 ? (
        <EtatVide
          titre="Tout est à jour"
          texte={`Aucune validation de restaurant ni de proposition client n'attend dans les files ouvertes à votre rôle.${notesDeTest > 0 ? ` ${notesDeTest} élément(s) de test sont rangés plus bas.` : ""}`}
        />
      ) : (
        <ul className="ad-liste">
          {lignes.map((ligne) => (
            <li key={ligne.href}>
              <Link href={ligne.href} className="ad-liste-lien">
                <span className="ad-liste-texte">
                  <span className="ad-liste-titre">{ligne.titre}</span>
                  <span className="ad-liste-meta">{ligne.meta}</span>
                </span>
                <span className="ad-liste-fin">
                  <Pastille ton={ligne.ton === "danger" ? "attention" : ligne.ton}>{ligne.badge}</Pastille>
                  <IconeAdmin nom="chevron" taille={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  );
}
