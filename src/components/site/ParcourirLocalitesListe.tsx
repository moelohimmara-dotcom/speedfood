"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normaliserNom } from "@/lib/site/zone-position";

export interface LocaliteCommune {
  id: string;
  nom: string;
  lien: string;
  restaurants: number;
  /** Annonce publique d'une zone sans restaurant : « Bientôt » ou « Pilote ». */
  annonce: "bientot" | "pilote" | null;
  cle: string;
}
export interface LocalitePrefecture {
  id: string;
  nom: string;
  lien: string;
  restaurants: number;
  cle: string;
  communes: LocaliteCommune[];
}
export interface LocaliteRegion {
  id: string;
  nom: string;
  lien: string;
  restaurants: number;
  cle: string;
  /** Nombre de préfectures de la région avant toute recherche : le niveau intermédiaire n'est masqué que s'il est unique en réalité. */
  prefecturesTotal: number;
  prefectures: LocalitePrefecture[];
}

function pluriel(n: number, singulier: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : singulier}`;
}

/** Pastille de décompte : mangue quand il y a des restaurants, neutre sinon (un vrai décompte, jamais une estimation). */
function Pastille({ restaurants }: { restaurants: number }) {
  return restaurants > 0 ? (
    <span className="localites-pastille">{pluriel(restaurants, "restaurant", "restaurants")}</span>
  ) : (
    <span className="localites-pastille est-vide">pas encore de restaurant</span>
  );
}

const FLECHE = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function LienZone({ href, nom }: { href: string; nom: string }) {
  return (
    <p className="localites-acces">
      <Link href={href} className="pub-btn pub-btn-clair localites-acces-bouton">
        Voir les restaurants<span className="sr-only"> de {nom}</span>
        <span className="pub-btn-point" aria-hidden="true">
          {FLECHE}
        </span>
      </Link>
    </p>
  );
}

function Communes({ communes, attenteActive }: { communes: LocaliteCommune[]; attenteActive: boolean }) {
  return (
    <ul className="localites-communes">
      {communes.map((c) => (
        <li key={c.id}>
          <Link href={c.lien} className={`localites-commune${c.restaurants === 0 ? " est-vide" : ""}`}>
            <span>{c.nom}</span>
            <span className="localites-commune-bilan">
              {c.restaurants > 0 ? (
                pluriel(c.restaurants, "restaurant", "restaurants")
              ) : c.annonce ? (
                <>
                  <span className="sr-only">pas encore de restaurant, </span>
                  <span className="localites-annonce">{c.annonce === "bientot" ? "Bientôt" : "Pilote"}</span>
                </>
              ) : attenteActive ? (
                <>
                  <span className="sr-only">pas encore de restaurant, </span>Prévenez-moi
                </>
              ) : (
                <>
                  <span className="sr-only">pas encore de restaurant</span>
                  <span aria-hidden="true">—</span>
                </>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ParcourirLocalitesListe({ regions, attenteActive }: { regions: LocaliteRegion[]; attenteActive: boolean }) {
  const idRecherche = useId();
  const idEtat = useId();
  const [saisie, setSaisie] = useState("");
  const [avecRestaurants, setAvecRestaurants] = useState(false);
  const requete = normaliserNom(saisie);

  const totaux = useMemo(() => {
    let prefectures = 0;
    let communes = 0;
    let restaurants = 0;
    for (const r of regions) {
      prefectures += r.prefectures.length;
      restaurants += r.restaurants;
      for (const p of r.prefectures) communes += p.communes.length;
    }
    return { regions: regions.length, prefectures, communes, restaurants };
  }, [regions]);

  // Les régions qui comptent des restaurants d'abord (puis l'ordre d'origine) ; la recherche garde les zones dont le nom correspond
  // (ou dont un enfant correspond), la commune seule quand c'est elle qui correspond.
  const { affichees, nbCommunes } = useMemo(() => {
    const trier = [...regions].sort((a, b) => Number(b.restaurants > 0) - Number(a.restaurants > 0));
    let compte = 0;
    const resultat: LocaliteRegion[] = [];
    for (const region of trier) {
      if (requete === "") {
        if (avecRestaurants && region.restaurants === 0) continue;
        const prefectures = avecRestaurants ? region.prefectures.filter((p) => p.restaurants > 0) : region.prefectures;
        const filtrees = prefectures.map((p) => ({ ...p, communes: avecRestaurants ? p.communes.filter((c) => c.restaurants > 0) : p.communes }));
        for (const p of filtrees) compte += p.communes.length;
        resultat.push({ ...region, prefectures: filtrees });
        continue;
      }
      const regionOk = region.cle.includes(requete);
      const prefectures: LocalitePrefecture[] = [];
      for (const p of region.prefectures) {
        const prefOk = regionOk || p.cle.includes(requete);
        const communes = prefOk ? p.communes : p.communes.filter((c) => c.cle.includes(requete));
        if (communes.length > 0 || prefOk) prefectures.push({ ...p, communes });
        compte += communes.length;
      }
      if (prefectures.length > 0) resultat.push({ ...region, prefectures });
    }
    return { affichees: resultat, nbCommunes: compte };
  }, [regions, requete, avecRestaurants]);

  const enRecherche = requete !== "";

  return (
    <section className="localites" aria-labelledby="localites-titre">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Toute la Guinée</p>
        <h2 id="localites-titre" className="pub-titre pub-h2 localites-titre">
          Régions, préfectures et communes
        </h2>
        <p className="localites-chiffres">
          {pluriel(totaux.regions, "région", "régions")} · {pluriel(totaux.prefectures, "préfecture", "préfectures")} ·{" "}
          {pluriel(totaux.communes, "commune", "communes")} · {pluriel(totaux.restaurants, "restaurant", "restaurants")}
        </p>
        <p className="pub-accueil-lead">
          Choisissez une zone pour voir ses restaurants. Là où aucun restaurant n&apos;est encore référencé, vous pouvez demander à être prévenu à
          l&apos;ouverture du premier.
        </p>
      </div>

      <div className="localites-outils" role="search">
        <label htmlFor={idRecherche} className="localites-recherche-etiquette">
          Rechercher une région, une préfecture ou une commune
        </label>
        <input
          id={idRecherche}
          type="search"
          className="localites-recherche-champ"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Ex. Kindia, Ratoma, Labé"
          autoComplete="off"
          aria-describedby={idEtat}
        />
        <label className="localites-filtre">
          <input type="checkbox" checked={avecRestaurants} onChange={(e) => setAvecRestaurants(e.target.checked)} disabled={enRecherche} />
          <span>Seulement les zones avec des restaurants</span>
        </label>
        <p id={idEtat} className="localites-etat" role="status">
          {enRecherche
            ? affichees.length === 0
              ? "Aucune zone ne correspond à cette recherche. Vérifiez l'orthographe ou essayez le nom de la région."
              : `${pluriel(nbCommunes, "commune trouvée", "communes trouvées")}.`
            : ""}
        </p>
      </div>

      <div className="localites-liste">
        {affichees.map((region) => {
          const unique = region.prefecturesTotal === 1 && region.prefectures.length === 1;
          return (
            <details
              // La clé change avec la recherche : les zones trouvées s'ouvrent d'emblée, sans état à synchroniser.
              key={`${region.id}-${enRecherche ? "q" : "n"}`}
              className={`localites-region${region.restaurants === 0 ? " est-vide" : ""}`}
              open={enRecherche || region.restaurants > 0}
            >
              <summary>
                <span className="localites-nom">{region.nom}</span>
                <span className="localites-bilan">
                  {unique ? pluriel(region.prefectures[0].communes.length, "commune", "communes") : pluriel(region.prefectures.length, "préfecture", "préfectures")}
                  <Pastille restaurants={region.restaurants} />
                </span>
              </summary>
              {unique ? (
                // Une seule préfecture (Conakry) : le niveau intermédiaire n'apporte rien, on passe directement aux communes.
                <>
                  <LienZone href={region.lien} nom={region.nom} />
                  <Communes communes={region.prefectures[0].communes} attenteActive={attenteActive} />
                </>
              ) : (
                <>
                  <LienZone href={region.lien} nom={region.nom} />
                  {region.prefectures.map((pref) => (
                    <details
                      key={`${pref.id}-${enRecherche ? "q" : "n"}`}
                      className={`localites-prefecture${pref.restaurants === 0 ? " est-vide" : ""}`}
                      open={enRecherche || pref.restaurants > 0}
                    >
                      <summary>
                        <span className="localites-nom">{pref.nom}</span>
                        <span className="localites-bilan">
                          {pluriel(pref.communes.length, "commune", "communes")}
                          <Pastille restaurants={pref.restaurants} />
                        </span>
                      </summary>
                      <LienZone href={pref.lien} nom={pref.nom} />
                      <Communes communes={pref.communes} attenteActive={attenteActive} />
                    </details>
                  ))}
                </>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}
