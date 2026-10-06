import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import Link from "next/link";
import type { Metadata } from "next";
import { CadreSite } from "@/components/CadreSite";
import { CartePub } from "@/components/site/CartePub";
import {
  SelecteurEnvie,
  type EnvieAffichee,
} from "@/components/site/SelecteurEnvie";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
import { Illustration } from "@/components/illustrations/Illustration";
import { lirePromesse } from "@/lib/parametres/promesse";
import { lireTextes } from "@/lib/cms/textes";
import { FAMILLES_ENVIE, lireAccueil, ticketExemple } from "@/lib/site/accueil";
import { TicketVoyage } from "@/components/site/TicketVoyage";
import { MotRoulant } from "@/components/site/MotRoulant";
import { BandeauAnnonces } from "@/components/site/BandeauAnnonces";
import {
  PALETTES,
  type Illustration as ModeleIllustration,
} from "@/lib/illustrations/modele";

/** Plats de l'accroche qui change : des plats qu'on trouve réellement sur la carte des restaurants de Conakry. */
const MOTS_ENVIE = ["alloco", "poisson braisé", "riz gras", "sauce feuille", "poulet braisé"];

// Rendue à chaque requête (et non figée à la construction) : l'accueil lit des données vivantes et le cadre du site lit les interrupteurs
// de fonctionnalités du super administrateur (voir src/lib/fonctionnalites/lire.ts) ; sinon un changement n'apparaîtrait qu'au prochain déploiement.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Les restaurants de Conakry",
  alternates: { canonical: "/" },
};

const FLECHE = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Illustrations des quatre étapes ; les titres et textes sont des emplacements (accueil.etapes.*). */
const MOTIFS_ETAPES = ["etape-choisir", "etape-commander", "etape-suivre", "emporter"] as const;

function pastille(motif: string): ModeleIllustration {
  return {
    style: "pastille",
    motif,
    ...PALETTES.defaut,
    fond: "#ffe9c7",
    texte: "",
    genere: true,
  };
}

export default async function AccueilPage() {
  const [promesse, donnees, scenesActives, t] = await Promise.all([
    lirePromesse(),
    lireAccueil(),
    fonctionnaliteActive("scenes_envie_accueil"),
    lireTextes(),
  ]);
  const { ouverts, quartiers, suggestions, restaurants, platsParRestaurant } =
    donnees;

  const envies: EnvieAffichee[] = suggestions.map((s) => ({
    famille: s.famille,
    libelle:
      FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    visuel: (
      <Illustration
        valeur={s.illustration ?? pastille(s.motif)}
        nom={s.platNom}
        decoratif
      />
    ),
  }));

  const etapes = [
    { titre: t["accueil.etapes.choisir_titre"], texte: t["accueil.etapes.choisir_texte"], motif: MOTIFS_ETAPES[0] },
    { titre: t["accueil.etapes.commander_titre"], texte: t["accueil.etapes.commander_texte"], motif: MOTIFS_ETAPES[1] },
    { titre: t["accueil.etapes.suivre_titre"], texte: t["accueil.etapes.suivre_texte"], motif: MOTIFS_ETAPES[2] },
    { titre: t["accueil.etapes.recevoir_titre"], texte: t["accueil.etapes.recevoir_texte"], motif: MOTIFS_ETAPES[3] },
  ];

  const ticket = ticketExemple(donnees);
  const mises = (ouverts.length >= 3 ? ouverts : restaurants).slice(0, 3);
  const bandeau = [
    ...quartiers.map((q) => q.nom),
    ...FAMILLES_ENVIE.map((f) => f.libelle),
  ];

  return (
    <CadreSite>
      <main className="pub-accueil">
        <BandeauAnnonces />
        <section
          className="pub-conteneur pub-accueil-hero"
          aria-labelledby="accueil-titre"
        >
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
              {t["accueil.hero.preuve_question"] + " "}<span className="pub-surligne">{t["accueil.hero.preuve_reponse"]}</span>
            </p>
          </div>
          <aside className="pub-accueil-envie" aria-label={t["accueil.hero.encart_aria"]}>
            {envies.length > 0 ? (
              <SelecteurEnvie envies={envies} scenes={scenesActives} />
            ) : (
              <div className="pub-envie">
                <p className="pub-kicker">{t["accueil.vide.kicker"]}</p>
                <p className="pub-envie-plat">
                  {t["accueil.vide.titre"]}
                </p>
                <p className="pub-envie-resto">
                  {t["accueil.vide.texte"]}
                </p>
              </div>
            )}
            <span className="pub-autocollant pub-accueil-sticker boucle">
              {t["accueil.hero.macaron"]}
            </span>
          </aside>
        </section>

        {bandeau.length > 0 ? (
          <div className="pub-bandeau" aria-hidden="true">
            <div className="pub-bandeau-piste">
              {[...bandeau, ...bandeau].map((mot, i) => (
                <span key={`${mot}-${i}`}>{mot}</span>
              ))}
            </div>
          </div>
        ) : null}

        {mises.length > 0 ? (
          <section
            className="pub-conteneur pub-rubrique"
            aria-labelledby="accueil-carte"
          >
            <div className="pub-entete-rubrique">
              <p className="pub-kicker">
                {ouverts.length >= 3 ? t["accueil.carte.kicker_ouverts"] : t["accueil.carte.kicker_catalogue"]}
              </p>
              <h2 id="accueil-carte" className="pub-titre pub-h2">
                {t["accueil.carte.titre_debut"]}{" "}
                <span className="pub-surligne">{t["accueil.carte.titre_surligne"]}</span>
              </h2>
            </div>
            <div className="pub-grille-cartes">
              {mises.map((r, i) => (
                <CartePub
                  key={r.id}
                  restaurant={r}
                  plats={platsParRestaurant.get(r.id) ?? []}
                  grande={i === 0}
                />
              ))}
            </div>
            <div>
              <Link href="/restaurants" className="pub-btn pub-btn-clair">
                {t["accueil.carte.bouton_tous"]}
                <span className="pub-btn-point" aria-hidden="true">
                  {FLECHE}
                </span>
              </Link>
            </div>
          </section>
        ) : null}

        {quartiers.length > 0 ? (
          <div className="pub-bloc">
            <section
              className="pub-conteneur pub-rubrique"
              aria-labelledby="accueil-quartiers"
            >
              <div className="pub-entete-rubrique">
                <p className="pub-kicker">{t["accueil.quartiers.kicker"]}</p>
                <h2 id="accueil-quartiers" className="pub-titre pub-h2">
                  {t["accueil.quartiers.titre"]}
                </h2>
              </div>
              <ul className="pub-quartiers">
                {quartiers.map((q, i) => (
                  <li
                    key={q.slug}
                    className={`pub-quartier pub-quartier-${i % 3}`}
                  >
                    <Link href={`/quartiers/${q.slug}`}>
                      <span className="pub-quartier-nom">{q.nom}</span>
                      <span className="pub-quartier-compte">
                        {q.restaurants} restaurant{q.restaurants > 1 ? "s" : ""}
                        {q.ouverts > 0
                          ? `, ${q.ouverts} ouvert${q.ouverts > 1 ? "s" : ""}`
                          : ""}
                      </span>
                      <span className="pub-quartier-fleche" aria-hidden="true">
                        {FLECHE}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        <section
          className="pub-conteneur pub-rubrique"
          aria-labelledby="accueil-etapes"
        >
          <div className="pub-entete-rubrique">
            <p className="pub-kicker">{t["accueil.etapes.kicker"]}</p>
            <h2 id="accueil-etapes" className="pub-titre pub-h2">
              {t["accueil.etapes.titre_debut"] + " "}<span className="pub-surligne">{t["accueil.etapes.titre_surligne"]}</span>
            </h2>
          </div>
          <ol className="pub-etapes">
            {etapes.map((e, i) => (
              <li key={e.titre} className="pub-etape">
                <span className="pub-etape-visuel">
                  <Illustration
                    valeur={pastille(e.motif)}
                    nom={e.titre}
                    decoratif
                  />
                </span>
                <h3 className="pub-titre pub-etape-titre">
                  <span className="pub-etape-num">{i + 1}</span> {e.titre}
                </h3>
                <p>{e.texte}</p>
              </li>
            ))}
          </ol>
          <div>
            <Link href="/comment-ca-marche" className="pub-btn">
              {t["accueil.etapes.bouton_detail"]}
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
          </div>
        </section>

        {ticket ? (
          <div className="pub-bloc">
            <section
              className="pub-conteneur pub-rubrique"
              aria-labelledby="accueil-ticket"
            >
              <div className="pub-section-ticket">
                <div className="pub-entete-rubrique">
                  <p className="pub-kicker">{t["accueil.suivi.kicker"]}</p>
                  <h2 id="accueil-ticket" className="pub-titre pub-h2">
                    {t["accueil.suivi.titre_debut"]}{" "}
                    <span className="pub-surligne">{t["accueil.suivi.titre_surligne"]}</span>
                  </h2>
                  <p className="pub-accueil-lead">
                    {t["accueil.suivi.texte"]}
                  </p>
                </div>
                <TicketVoyage
                  restaurant={ticket.restaurant}
                  lignes={ticket.lignes}
                />
              </div>
            </section>
          </div>
        ) : null}

        {!ticket ? (
          <div className="pub-conteneur">
            <SeparateurBloc />
          </div>
        ) : null}

        <section
          className="pub-conteneur pub-rubrique"
          aria-labelledby="accueil-pro"
        >
          <div className="pub-bande-pro">
            <div className="pub-bande-contenu">
              {/* Toque : le pictogramme du restaurateur, en pastille comme les étapes. */}
              <span className="pub-bande-icone">
                <Illustration valeur={pastille("trait-toque")} nom="" decoratif />
              </span>
              <div>
                <p className="pub-kicker pub-kicker-encre">
                  {t["accueil.pro.kicker"]}
                </p>
                <h2 id="accueil-pro" className="pub-titre pub-h2">
                  {t["accueil.pro.titre_debut"]}{" "}
                  <span className="pub-surligne-blanc">
                    {t["accueil.pro.titre_surligne"]}
                  </span>
                </h2>
                <p className="pub-accueil-lead pub-lead-encre">
                  {t["accueil.pro.texte"]}
                </p>
              </div>
            </div>
            <Link href="/devenir-partenaire" className="pub-btn pub-btn-clair">
              {t["accueil.pro.bouton"]}
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
          </div>
        </section>
      </main>
    </CadreSite>
  );
}
