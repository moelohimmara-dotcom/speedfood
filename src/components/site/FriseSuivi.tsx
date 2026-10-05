import type { EtatDeriveCommande } from "@/lib/contracts/commande";

const ETAPES = [
  { cle: "en_attente", libelle: "Envoyée" },
  { cle: "acceptee", libelle: "Acceptée" },
  { cle: "prete", libelle: "Prête" },
  { cle: "terminee", libelle: "Terminée" },
] as const;

/** Rang de l'étape atteinte ; `null` pour une commande refusée ou annulée (pas de frise). `attente_confirmation_client` reste à « Envoyée ». */
function rang(etat: EtatDeriveCommande): number | null {
  if (etat === "refusee" || etat === "annulee") return null;
  if (etat === "acceptee") return 1;
  if (etat === "prete") return 2;
  if (etat === "terminee") return 3;
  return 0;
}

/**
 * Frise de suivi à quatre étapes. L'étape en cours bat doucement (boucle, en pause hors écran et si les animations sont coupées) : elle dit
 * « ça avance » pendant l'attente, le moment où le client s'inquiète. Les étapes passées sont pleines. Texte réel, annoncé comme liste.
 */
export function FriseSuivi({ etat }: { etat: EtatDeriveCommande }) {
  const r = rang(etat);
  if (r === null) return null;
  return (
    <ol className="suivi-frise" aria-label="Avancement de la commande">
      {ETAPES.map((e, i) => {
        const etatEtape = i < r ? "faite" : i === r ? "courante" : "a-venir";
        const finale = r === 3 && i === 3;
        return (
          <li
            key={e.cle}
            className={`suivi-etape suivi-etape-${finale ? "faite" : etatEtape}${etatEtape === "courante" && !finale ? " suivi-etape-courante boucle" : ""}`}
            aria-current={etatEtape === "courante" ? "step" : undefined}
          >
            <span className="suivi-etape-point" aria-hidden="true">
              {i < r || finale ? "✓" : i + 1}
            </span>
            <span className="suivi-etape-libelle">{e.libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}
