import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { SelecteurEnvie, type EnvieAffichee } from "@/components/site/SelecteurEnvie";
import { MotRoulant } from "@/components/site/MotRoulant";
import { lireTextes } from "@/lib/cms/textes";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { FAMILLES_ENVIE, lireAccueil } from "@/lib/site/accueil";
import { FLECHE, MOTS_ENVIE, pastille } from "./commun";
import { promesseDeLaRequete } from "./lectures";

/**
 * Accroche de l'accueil : titre (le h1 de la page), boutons, phrase de preuve et encart « Votre envie du moment ? » (une seule
 * section en grille à deux colonnes). Mots : emplacements `accueil.hero.*` et `accueil.vide.*` ; signature et sous-titre :
 * `lirePromesse()` ; plats suggérés : `lireAccueil()`.
 */
export async function AccueilAccroche() {
  const [promesse, donnees, scenesActives, t] = await Promise.all([
    promesseDeLaRequete(),
    lireAccueil(),
    fonctionnaliteActive("scenes_envie_accueil"),
    lireTextes(),
  ]);

  const envies: EnvieAffichee[] = donnees.suggestions.map((s) => ({
    famille: s.famille,
    libelle: FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    visuel: <Illustration valeur={s.illustration ?? pastille(s.motif)} nom={s.platNom} decoratif />,
  }));

  return (
    <section className="pub-conteneur pub-accueil-hero" aria-labelledby="accueil-titre">
      {/* Deux grandes taches de couleur qui dérivent lentement (décor, en pause hors écran et si les animations sont coupées). */}
      <span className="pub-blob pub-blob-mangue boucle" aria-hidden="true" />
      <span className="pub-blob pub-blob-orange boucle" aria-hidden="true" />
      <div className="pub-accueil-texte">
        <p className="pub-kicker pub-kicker-encre">{promesse.signature}</p>
        <h1 id="accueil-titre" className="pub-titre pub-accueil-h1">
          {/* Phrase complète et stable pour les lecteurs d'écran ; le mot qui change est purement visuel. */}
          <span className="sr-only">{t["accueil.hero.titre_lecteur"]}</span>
          <span aria-hidden="true">
            {t["accueil.hero.titre_debut"]}{" "}
            <span className="pub-nowrap">
              <MotRoulant mots={MOTS_ENVIE} />&nbsp;?
            </span>{" "}
            {t["accueil.hero.titre_fin"]}
          </span>
        </h1>
        <p className="pub-accueil-lead">{promesse.sousTitre}</p>
        <div className="pub-accueil-actions">
          <Link href="/restaurants" className="pub-btn boucle boucle-cta">
            {t["accueil.hero.bouton_commander"]}
            <span className="pub-btn-point" aria-hidden="true">
              {FLECHE}
            </span>
          </Link>
          <Link href="/comment-ca-marche" className="pub-btn pub-btn-clair">
            {t["accueil.hero.bouton_fonctionnement"]}
          </Link>
        </div>
        <p className="pub-accueil-preuve-ligne">
          {t["accueil.hero.preuve_question"] + " "}
          <span className="pub-surligne">{t["accueil.hero.preuve_reponse"]}</span>
        </p>
      </div>
      <aside className="pub-accueil-envie" aria-label={t["accueil.hero.encart_aria"]}>
        {envies.length > 0 ? (
          <SelecteurEnvie envies={envies} scenes={scenesActives} />
        ) : (
          <div className="pub-envie">
            <p className="pub-kicker">{t["accueil.vide.kicker"]}</p>
            <p className="pub-envie-plat">{t["accueil.vide.titre"]}</p>
            <p className="pub-envie-resto">{t["accueil.vide.texte"]}</p>
          </div>
        )}
        <span className="pub-autocollant pub-accueil-sticker boucle">{t["accueil.hero.macaron"]}</span>
      </aside>
    </section>
  );
}
