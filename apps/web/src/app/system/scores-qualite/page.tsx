import type { Metadata } from "next";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { lireDerniersScores } from "@/lib/restaurant/score-lectures";
import type { PalierScore } from "@/lib/restaurant/score-qualite";
import { lireReglagesScore } from "@/lib/restaurant/score-service";
import { marquerEtapeDegradationAction, recalculerScoresAction } from "@/lib/system-admin/scores-actions";
import { ReglagesScoreForm } from "./ReglagesScore";

export const metadata: Metadata = { title: "Scores qualité (administration)" };
export const dynamic = "force-dynamic";

const LIBELLE_PALIER: Record<PalierScore, string> = {
  excellent: "Excellent",
  tres_bon: "Très bon",
  bon: "Bon",
  moyen: "Moyen",
  mauvais: "Mauvais",
};
const TON_PALIER: Record<PalierScore, "succes" | "neutre" | "attention" | "danger"> = {
  excellent: "succes",
  tres_bon: "succes",
  bon: "neutre",
  moyen: "attention",
  mauvais: "danger",
};
const LIBELLE_ETAPE: Record<string, string> = {
  aucune: "Aucune",
  avertissement_1: "Avertissement 1",
  avertissement_2_contact: "Avertissement 2 et contact",
  retrait_avantages: "Retrait des avantages",
  suspension: "Suspension",
  retrait_decision_humaine: "Retrait : décision humaine requise",
};

function pct(v: number | null | undefined): string {
  return typeof v === "number" ? `${v} %` : "sans données";
}

export default async function ScoresQualitePage() {
  await exigerPermissionPage("parametres.editer");
  const [{ mois, lignes }, reglages] = await Promise.all([lireDerniersScores(), lireReglagesScore()]);
  return (
    <div>
      <PageHeader titre="Scores qualité des restaurants" description="Score mensuel sur six indicateurs, du palier le plus faible au plus fort. Le retrait final reste une décision humaine." />
      <ReglagesScoreForm reglages={reglages} />
      <form action={recalculerScoresAction} className="ad-panneau">
        <h2 className="ad-panneau-titre">Recalculer maintenant</h2>
        <p className="ad-aide-champ">Relance le calcul du mois écoulé avec les réglages ci-dessus, sans attendre le déclenchement mensuel. Les mois déjà publiés sont réécrits à l’identique si rien n’a changé.</p>
        <button type="submit" className="btn btn-secondary">Recalculer le mois écoulé</button>
      </form>
      {mois === null || lignes.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide titre="Aucun score calculé" texte="Le premier calcul aura lieu au début du mois prochain, sur les données du mois écoulé." />
        </div>
      ) : (
        <>
          <p className="ad-aide-champ">Mois calculé : {mois}. La note mensuelle n’est pas encore mesurable en base : elle ne compte ni pour ni contre.</p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Scores qualité par restaurant</caption>
              <thead>
                <tr><th>Restaurant</th><th>Score</th><th>Acceptation</th><th>Préparation</th><th>Exactitude</th><th>Note</th><th>Fiche</th><th>Disponibilité</th><th>Dégradation</th></tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.restaurantId}>
                    <td className="ad-cellule-principale">{l.nom}<span className="ad-secondaire u-d-block-fs-0-8rem"><Pastille ton={TON_PALIER[l.palier]}>{LIBELLE_PALIER[l.palier]}</Pastille></span></td>
                    <td><strong>{l.score}</strong></td>
                    <td>{pct(l.indicateurs.acceptationDelai)}</td>
                    <td>{pct(l.indicateurs.preparationTenue)}</td>
                    <td>{pct(l.indicateurs.exactitude)}</td>
                    <td>{pct(l.indicateurs.note)}</td>
                    <td>{pct(l.indicateurs.ficheComplete)}</td>
                    <td>{pct(l.indicateurs.disponibilite)}</td>
                    <td>{l.moisBasConsecutifs > 0 ? <>{`${LIBELLE_ETAPE[l.etape]} (${l.moisBasConsecutifs} mois bas)`}{l.etape !== "retrait_decision_humaine" ? <>{" "}<form action={marquerEtapeDegradationAction} style={{ display: "inline" }}><input type="hidden" name="restaurant_id" value={l.restaurantId} /><input type="hidden" name="etape" value={l.etape} /><button type="submit" className="btn btn-secondary btn-compact">Marquer comme prise</button></form></> : null}</> : "Aucune"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
