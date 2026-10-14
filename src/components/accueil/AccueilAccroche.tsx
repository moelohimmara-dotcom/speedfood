import Link from "next/link";
import { lireTextes } from "@/lib/cms/textes";
import { lireZones, type ZoneChoisie } from "@/lib/site/zones";
import { promesseDeLaRequete } from "./lectures";
import { RechercheLocalite, type OptionLocalite } from "./RechercheLocalite";

/**
 * Accroche de l'accueil : titre (le h1 de la page), recherche de localité, mention de la couverture réelle (phase pilote),
 * puis la zone choisie. La zone se choisit à la main (communes et quartiers enregistrés) : aucune géolocalisation n'est
 * demandée ni nécessaire. Mots : emplacements `accueil.hero.*` ; signature et sous-titre : `lirePromesse()`.
 */
export async function AccueilAccroche({ zone = null }: { zone?: ZoneChoisie | null }) {
  const [promesse, zones, t] = await Promise.all([promesseDeLaRequete(), lireZones(), lireTextes()]);

  const options: OptionLocalite[] = [
    ...zones.map((c) => ({ niveau: "commune" as const, nom: c.nom, slug: c.slug, communeNom: "", restaurants: c.restaurants })),
    ...zones.flatMap((c) =>
      c.quartiers.map((q) => ({ niveau: "quartier" as const, nom: q.nom, slug: q.slug, communeNom: c.nom, restaurants: q.restaurants }))
    ),
  ];

  return (
    <section className="pub-conteneur pub-accueil-hero pub-accueil-hero-recherche" aria-labelledby="accueil-titre">
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
        />

        {zone ? (
          <p className="pub-zone-active" role="status">
            Zone sélectionnée :{" "}
            <strong>
              {zone.niveau === "quartier"
                ? `${zone.nom} · ${zone.communeNom}${zone.villeNom ? `, ${zone.villeNom}` : ""}`
                : `${zone.nom}${zone.villeNom ? ` · ${zone.villeNom}` : ""}`}
            </strong>
            {" — "}
            <Link href="/" className="lien-texte">
              Modifier
            </Link>
          </p>
        ) : null}
        <p className="pub-accueil-pilote">{t["accueil.hero.pilote"]}</p>

        <div className="pub-accueil-actions">
          <Link href="/quartiers" className="pub-btn pub-btn-clair">
            {t["accueil.hero.lien_localites"]}
          </Link>
        </div>
        <p className="pub-accueil-preuve-ligne">
          {t["accueil.hero.preuve_question"] + " "}
          <span className="pub-surligne">{t["accueil.hero.preuve_reponse"]}</span>
        </p>
      </div>
    </section>
  );
}
