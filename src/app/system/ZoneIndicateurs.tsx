import Link from "next/link";

/**
 * Compteur cliquable du tableau de bord : le chiffre mène à la section
 * correspondante, déjà filtrée. La définition écrite accompagne toujours le
 * chiffre (règle des indicateurs du TDR §7, reprise de `/system/audit`).
 */
export interface CompteurAffiche {
  cle: string;
  valeur: number;
  libelle: string;
  definition: string;
  href: string;
  /** Accent du chiffre : `danger` quand il reste quelque chose à traiter. */
  ton?: "succes" | "danger" | "neutre";
}

export interface ZoneAffichee {
  titre: string;
  compteurs: CompteurAffiche[];
}

const COULEURS_TON: Record<NonNullable<CompteurAffiche["ton"]>, string> = {
  succes: "var(--succes)",
  danger: "var(--danger)",
  neutre: "var(--encre)",
};

export function ZoneIndicateurs({ zone }: { zone: ZoneAffichee }) {
  return (
    <section style={{ marginBottom: "var(--space-6)" }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>{zone.titre}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {zone.compteurs.map((compteur) => (
          <Link
            key={compteur.cle}
            href={compteur.href}
            className="card"
            style={{
              display: "block",
              textDecoration: "none",
              minWidth: 0,
              padding: "var(--space-4)",
            }}
          >
            <p
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                fontFamily: "var(--font-barlow)",
                margin: 0,
                color: COULEURS_TON[compteur.ton ?? "neutre"],
              }}
            >
              {compteur.valeur}
            </p>
            <p style={{ fontWeight: 700, margin: "4px 0", fontSize: "0.9rem" }}>{compteur.libelle}</p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--secondaire)",
                margin: 0,
                overflowWrap: "anywhere",
              }}
            >
              {compteur.definition}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
