import Link from "next/link";
import { Card } from "@/components/ui";
import { Chevron } from "@/components/Chevron";
import { formaterDateCourte } from "./formatage";

/**
 * Activité récente du tableau de bord : derniers événements `audit_events`
 * (via `fn_lister_audit`), chacun cliquable vers le journal filtré sur son
 * type d'action.
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
    <section style={{ minWidth: 0 }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>Activité récente</h2>
      {evenements.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun événement pour l&apos;instant.</p>
        </Card>
      ) : (
        <Card style={{ padding: "var(--space-3) var(--space-4)" }}>
          <ul style={{ listStyle: "none" }}>
            {evenements.map((evenement) => (
              <li
                key={evenement.id}
                style={{
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--bordure)",
                  minWidth: 0,
                }}
              >
                <Link
                  href={`/system/audit?action=${encodeURIComponent(evenement.action)}`}
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    overflowWrap: "anywhere",
                  }}
                >
                  {evenement.action}
                </Link>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    color: "var(--secondaire)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {evenement.cibleType} · {formaterDateCourte(evenement.horodatage)}
                  {evenement.acteurEmail ? ` · ${evenement.acteurEmail}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ margin: "var(--space-3) 0 var(--space-2)" }}>
            <Link
              href="/system/audit"
              style={{ fontWeight: 700, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Voir tout le journal d&apos;audit <Chevron sens="droite" />
            </Link>
          </p>
        </Card>
      )}
    </section>
  );
}
