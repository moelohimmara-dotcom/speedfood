import Link from "next/link";
import { Panneau } from "@/components/admin/blocs";
import { IconeAdmin } from "@/components/admin/icones";
import { libelleActionAudit } from "@/lib/system-admin/actionsAuditConnues";
import { formaterDateCourte } from "./formatage";

/**
 * Activité récente du tableau de bord : derniers événements `audit_events` (via `fn_lister_audit`), chacun cliquable
 * vers le journal filtré sur son type d'action.
 */
export interface LigneActivite {
  id: string;
  action: string;
  cibleType: string;
  cibleId: string;
  acteurEmail: string | null;
  horodatage: string;
}

export function ActiviteRecente({ evenements }: { evenements: LigneActivite[] }) {
  return (
    <Panneau
      titre="Activité récente"
      sansMarge
      actions={
        <Link href="/system/audit" className="lien-texte">
          Tout le journal
        </Link>
      }
    >
      {evenements.length === 0 ? (
        <p className="ad-liste-meta" style={{ padding: "var(--space-4)" }}>
          Aucun événement pour l&apos;instant.
        </p>
      ) : (
        <ul className="ad-liste">
          {evenements.map((evenement) => (
            <li key={evenement.id}>
              <Link href={`/system/audit?action=${encodeURIComponent(evenement.action)}`} className="ad-liste-lien">
                <span className="ad-liste-texte">
                  <span className="ad-liste-titre">{libelleActionAudit(evenement.action)}</span>
                  <span className="ad-liste-meta">
                    {evenement.cibleType} · {formaterDateCourte(evenement.horodatage)}
                    {evenement.acteurEmail ? ` · ${evenement.acteurEmail}` : ""}
                  </span>
                </span>
                <span className="ad-liste-fin">
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
