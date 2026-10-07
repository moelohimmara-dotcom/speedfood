import type { Metadata } from "next";
import { CadreSite } from "@/components/CadreSite";
import { AccueilAccroche } from "@/components/accueil/AccueilAccroche";
import { AccueilBandeau } from "@/components/accueil/AccueilBandeau";
import { AccueilEtapes } from "@/components/accueil/AccueilEtapes";
import { AccueilPro } from "@/components/accueil/AccueilPro";
import { AccueilQuartiers } from "@/components/accueil/AccueilQuartiers";
import { AccueilRestaurants } from "@/components/accueil/AccueilRestaurants";
import { AccueilSuivi } from "@/components/accueil/AccueilSuivi";
import { BandeauAnnonces } from "@/components/site/BandeauAnnonces";
import { RenduPage } from "@/components/studio/RenduPage";
import { lirePageApercu } from "@/lib/cms/apercu";
import { lirePagePubliee } from "@/lib/cms/lecture";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { decider, type DecisionAccueil, type EntreeDecisionAccueil } from "@/lib/studio/accueil";
import { peutVoirApercu } from "@/lib/studio/droit-apercu";
import { SLUG_ACCUEIL } from "@/lib/studio/registre";
import { lireTextes } from "@/lib/cms/textes";
import { promesseDeLaRequete } from "@/components/accueil/lectures";
import { lireAccueil } from "@/lib/site/accueil";

// Rendue à chaque requête (et non figée à la construction) : l'accueil lit des données vivantes et le cadre du site lit les interrupteurs
// de fonctionnalités du super administrateur (voir src/lib/fonctionnalites/lire.ts) ; sinon un changement n'apparaîtrait qu'au prochain déploiement.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ [cle: string]: string | string[] | undefined }> };

const apercuDemande = (valeur: string | string[] | undefined) => valeur === "1";

const TITRE = "Les restaurants de Conakry";

/** Métadonnées d'aujourd'hui (titre, adresse canonique) ; l'aperçu de l'équipe n'est jamais indexé. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const base: Metadata = { title: TITRE, alternates: { canonical: "/" } };
  if (!apercuDemande((await searchParams).apercu)) return base;
  return (await peutVoirApercu()) ? { ...base, robots: { index: false, follow: false } } : base;
}

/**
 * Quelle version de l'accueil afficher ? La page d'origine (le repli) est TOUJOURS la valeur par défaut : la version en blocs
 * ne s'affiche que si `decider` (module pur, testé) le décide. Aucune exception ne sort d'ici : toute panne de lecture donne le
 * repli. Lectures : l'interrupteur (déjà lu à chaque requête par le cadre du site, mémoïsé) puis, seulement s'il est actif, la
 * page `accueil` publiée (cache de 60 s). L'aperçu (`?apercu=1`, équipe avec `contenu.editer`) lit le brouillon.
 */
async function choisirAffichage(apercu: boolean): Promise<DecisionAccueil> {
  try {
    let entreeApercu: EntreeDecisionAccueil["apercu"] = null;
    if (apercu && (await peutVoirApercu())) {
      const p = await lirePageApercu(SLUG_ACCUEIL);
      entreeApercu = {
        page: p && p.format === "blocs" ? { format: p.format, blocs: p.blocs_brouillon, titre: p.titre, enLigne: p.statut === "publie" } : null,
      };
    }
    const interrupteurActif = await fonctionnaliteActive("accueil_en_blocs");
    const publiee =
      interrupteurActif && !entreeApercu?.page
        ? await lirePagePubliee(SLUG_ACCUEIL).then((p) => (p ? { format: p.format, blocs: p.blocs_publie, titre: p.titre } : null))
        : null;
    const decision = decider({ interrupteurActif, publiee, apercu: entreeApercu });
    if (decision.mode === "repli" && decision.raison === "document publié invalide") {
      // Sans donnée : le document publié ne passe plus la validation (schéma modifié depuis la publication ?).
      console.error("accueil_en_blocs_repli_document_invalide");
    }
    return decision;
  } catch {
    console.error("accueil_en_blocs_repli_lecture_indisponible");
    return { mode: "repli", raison: "erreur de lecture" };
  }
}

/** La page d'accueil d'origine : les sections dans l'ordre d'aujourd'hui. Elle reste le repli de la version en blocs. */
function AccueilRepli() {
  return (
    <CadreSite>
      <main className="pub-accueil">
        <BandeauAnnonces />
        <AccueilAccroche />
        <AccueilBandeau />
        <AccueilRestaurants />
        <AccueilQuartiers />
        <AccueilEtapes />
        <AccueilSuivi />
        <AccueilPro />
      </main>
    </CadreSite>
  );
}

/**
 * Précharge (sans attendre) les lectures dont les sections ont besoin : elles démarrent tout de suite, EN MÊME TEMPS que la
 * lecture de l'interrupteur et de la page « accueil », comme les quatre lectures de la page d'origine (un seul `Promise.all`).
 * Ce sont les mêmes fonctions mémoïsées par requête (`cache` de React) que celles des sections : aucune lecture en double, et
 * les sections reprennent les promesses déjà lancées. Un échec n'est pas perdu : la section qui attend la même promesse le voit.
 */
function precharger() {
  for (const lecture of [lireAccueil(), lireTextes(), promesseDeLaRequete()]) lecture.catch(() => undefined);
}

export default async function AccueilPage({ searchParams }: Props) {
  precharger();
  const decision = await choisirAffichage(apercuDemande((await searchParams).apercu));

  if (decision.mode === "repli") return <AccueilRepli />;

  if (decision.mode === "apercu-invalide") {
    return (
      <CadreSite>
        <main className="pub-accueil">
          <div className="pub-conteneur">
            <div className="cms-apercu" role="alert">
              <p>Ce brouillon de l&apos;accueil ne peut être ni affiché ni publié : il ne respecte pas le format des blocs.</p>
              <ul>
                {decision.erreurs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </CadreSite>
    );
  }

  return (
    <CadreSite>
      <main className="pub-accueil">
        <BandeauAnnonces />
        {decision.mode === "apercu" ? (
          <div className="pub-conteneur">
            <p className="cms-apercu" role="note">
              {decision.enLigne
                ? "Aperçu : brouillon de l'accueil, la version en ligne peut être différente"
                : "Aperçu : cette page n'est pas publiée"}
            </p>
          </div>
        ) : null}
        <RenduPage page={decision.page} accueil={{ titre: decision.titre }} />
      </main>
    </CadreSite>
  );
}
