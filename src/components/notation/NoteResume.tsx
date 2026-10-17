import type { Pastille } from "@/lib/decouverte/recommandation";
import { SEUIL_AFFICHAGE } from "@/lib/notation/regles";

interface NoteResumeProps {
  /** Moyenne publique (à partir de 5 avis), sinon `null`. */
  moyenne: number | null;
  total: number;
  pastilles?: Pastille[];
}

/**
 * Réputation d'un restaurant sur sa carte : « ★ 4,3 · 12 avis » à partir de 5 avis, « Nouveau » avant, plus les pastilles qui
 * expliquent le classement. La valeur est écrite en toutes lettres (l'étoile est décorative).
 */
export function NoteResume({ moyenne, total, pastilles = [] }: NoteResumeProps) {
  const texte =
    moyenne === null
      ? total === 0
        ? "Nouveau"
        : `Nouveau · ${total} avis (note visible dès ${SEUIL_AFFICHAGE})`
      : `${moyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 5 · ${total} avis`;
  return (
    <p className="notation-resume">
      {moyenne !== null ? <span className="notation-etoile" aria-hidden="true">★</span> : null}
      <span className={moyenne === null ? "notation-resume-neutre" : "notation-resume-valeur"}>{texte}</span>
      {pastilles.map((p) => (
        <span key={p.cle} className="notation-pastille">
          {p.libelle}
        </span>
      ))}
    </p>
  );
}
