import Link from "next/link";

/**
 * Accès rapides du tableau de bord : les actions de commandement fréquentes,
 * chacune déjà filtrée sur l'écran d'action concerné. Les entrées sont
 * construites côté serveur selon les permissions du rôle courant.
 */
export interface ActionRapide {
  href: string;
  libelle: string;
  description: string;
}

export function AccesRapides({ actions }: { actions: ActionRapide[] }) {
  return (
    <section style={{ minWidth: 0 }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>Accès rapides</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {actions.map((action) => (
          <Link
            key={action.href + action.libelle}
            href={action.href}
            className="card"
            style={{ display: "block", textDecoration: "none", padding: "var(--space-4)", minWidth: 0 }}
          >
            <p style={{ fontWeight: 700, margin: 0 }}>{action.libelle}</p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.8rem",
                color: "var(--secondaire)",
                overflowWrap: "anywhere",
              }}
            >
              {action.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
