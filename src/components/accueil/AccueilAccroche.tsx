import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { SelecteurEnvie, type EnvieAffichee } from "@/components/site/SelecteurEnvie";
import { lireTextes } from "@/lib/cms/textes";
import { etatDisponibilite, libelleDisponibilite } from "@/lib/disponibilite/etat";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { FAMILLES_ENVIE, catalogueDeLaRequete, choisirSuggestions, lireAccueil } from "@/lib/site/accueil";
import { descriptionZone, lireHierarchieZones, restaurantsDeLaZone, type ZoneChoisie } from "@/lib/site/zones";
import { pastille } from "./commun";
import { promesseDeLaRequete } from "./lectures";
import { RechercheLocalite, type OptionLocalite } from "./RechercheLocalite";

/**
 * Accroche de l'accueil : titre (le h1 de la page), boutons, phrase de preuve et encart « Votre envie du moment ? » (une seule
 * section en grille à deux colonnes). Mots : emplacements `accueil.hero.*` et `accueil.vide.*` ; signature et sous-titre :
 * `lirePromesse()` ; plats suggérés : `lireAccueil()`.
 */
export async function AccueilAccroche({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [promesse, donnees, hierarchie, catalogue, scenesActives, t] = await Promise.all([
    promesseDeLaRequete(),
    lireAccueil(),
    lireHierarchieZones(),
    catalogueDeLaRequete(),
    fonctionnaliteActive("scenes_envie_accueil"),
    lireTextes(),
  ]);

  /** « Confirmé il y a 12 min » si le restaurant a confirmé le plat récemment, sinon « Disponibilité à confirmer ». */
  const confirmationDe = (confirmeLe: string | null): string => {
    const etat = etatDisponibilite({ disponible: true, confirmeLe }, catalogue.fraicheurHeures, catalogue.maintenant);
    if (etat.type !== "disponible") return "Disponibilité à confirmer";
    const detail = libelleDisponibilite(etat, catalogue.maintenant).detail ?? "";
    return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : "Disponibilité à confirmer";
  };

  // Avec une zone choisie, les plats suggérés viennent des restaurants de cette zone seulement.
  const suggestions = zone ? choisirSuggestions(restaurantsDeLaZone(donnees.restaurants, zone), donnees.platsParRestaurant) : donnees.suggestions;

  const options: OptionLocalite[] = hierarchie.flatMap((r) => [
    { niveau: "region" as const, nom: r.nom, slug: r.slug, contexte: "", restaurants: r.restaurants },
    ...r.prefectures.flatMap((p) => [
      { niveau: "prefecture" as const, nom: p.nom, slug: p.slug, contexte: `région de ${r.nom}`, restaurants: p.restaurants },
      ...p.communes.flatMap((c) => [
        {
          niveau: "commune" as const,
          nom: c.nom,
          slug: c.slug,
          contexte: c.villeNom || `préfecture de ${p.nom}`,
          ...(c.nomsAlternatifs.length > 0 ? { alias: c.nomsAlternatifs } : {}),
          restaurants: c.restaurants,
        },
        ...c.quartiers.map((q) => ({
          niveau: "quartier" as const,
          nom: q.nom,
          slug: q.slug,
          contexte: `${c.nom}${c.villeNom ? `, ${c.villeNom}` : ""}`,
          ...(q.nomsAlternatifs.length > 0 ? { alias: q.nomsAlternatifs } : {}),
          restaurants: q.restaurants,
        })),
      ]),
    ]),
  ]);

  const envies: EnvieAffichee[] = suggestions.map((s) => ({
    famille: s.famille,
    libelle: FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    confirmation: confirmationDe(s.confirmeLe),
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
          {t["accueil.hero.titre"]}
        </h1>
        <p className="pub-accueil-lead">{promesse.sousTitre}</p>

        <RechercheLocalite
          options={options}
          libelle={t["accueil.hero.recherche_libelle"]}
          placeholder={t["accueil.hero.recherche_placeholder"]}
          boutonLibelle={t["accueil.hero.recherche_bouton"]}
          positionLibelle={t["accueil.hero.position_bouton"]}
        />

        {zone ? (
          <p className="pub-zone-active" role="status">
            Zone sélectionnée : <strong>{descriptionZone(zone)}</strong>
            {" — "}
            <Link href="/" className="lien-texte">
              Modifier
            </Link>
          </p>
        ) : null}
        <div className="pub-accueil-actions">
          <Link href="/quartiers" className="pub-btn pub-btn-clair">
            {t["accueil.hero.lien_localites"]}
          </Link>
        </div>
        <p className="pub-accueil-preuve-ligne">
          {t["accueil.hero.preuve_question"] + " "}
          <span className="pub-surligne">{t["accueil.hero.preuve_reponse"]}</span>
        </p>
        <p className="pub-accueil-preuve-ligne">{t["accueil.hero.pilote"]}</p>
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
