"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { MOTIF_ANCRE, ANCRES_RESERVEES, CLES_REGLAGES, LIBELLE_ANCRE, OPTIONS_REGLAGES } from "@/lib/studio/reglages";
import { estUrlImageStudio } from "@/lib/studio/registre";
import {
  TAILLE_MAX_IMAGE,
  TYPES_IMAGE,
  decrireTaille,
  libelleImageListe,
  messageTailleImage,
} from "@/lib/studio/image-champ";
import { listerImagesStudio, televerserImageStudioAction, type ImageStudio } from "@/lib/system-admin/images-studio";
import {
  lireRestaurantPublie,
  listerTaxonomiesPubliques,
  rechercherRestaurantsPublies,
  type OptionTaxonomie,
  type RestaurantChoisissable,
  type ResultatTaxonomies,
} from "@/lib/system-admin/blocs-donnees";

/**
 * Champs « sur mesure » de l'éditeur de pages à blocs (palier 3, tâche 8) : réglages communs, image (avec téléversement),
 * restaurant et listes de quartiers ou de cuisines. Ce sont des champs `custom` de Puck : ils fournissent eux-mêmes leur
 * étiquette et leurs contrôles natifs (étiquetés, utilisables au clavier). Tous les textes sont en français. Aucune valeur
 * libre n'est possible pour les réglages : ce sont des listes fermées, la même table que le schéma (`reglages.ts`).
 */

interface ProprietesChamp<V> {
  libelle: string;
  value: V;
  onChange: (valeur: V) => void;
  readOnly?: boolean;
}

// --- Réglages ----------------------------------------------------------------------------------------------------------

type ValeurReglages = Record<string, unknown> | undefined;

function compterReglages(valeur: ValeurReglages): number {
  return CLES_REGLAGES.filter((cle) => valeur && valeur[cle] !== undefined && valeur[cle] !== "").length;
}

export function ChampReglages({ libelle, value, onChange, readOnly }: ProprietesChamp<ValeurReglages>) {
  const base = useId();
  const nombre = compterReglages(value);
  const courant = (cle: string) => (value && value[cle] !== undefined && value[cle] !== null ? String(value[cle]) : "");
  const modifier = (cle: string, brut: string) => {
    const suivant: Record<string, unknown> = { ...(value ?? {}) };
    if (brut === "") delete suivant[cle];
    // Les valeurs numériques (espaces) redeviennent des nombres ; les autres restent du texte de la liste fermée.
    else suivant[cle] = cle === "espaceHaut" || cle === "espaceBas" ? Number(brut) : brut;
    onChange(Object.keys(suivant).length > 0 ? suivant : undefined);
  };
  const ancre = courant("ancre");
  const ancreInvalide = ancre !== "" && (!MOTIF_ANCRE.test(ancre) || (ANCRES_RESERVEES as readonly string[]).includes(ancre));

  return (
    <details className="se-reglages">
      <summary className="se-reglages-titre">
        {libelle}
        <span className="se-reglages-compte">{nombre === 0 ? " (aucun réglage)" : ` (${nombre} modifié${nombre > 1 ? "s" : ""})`}</span>
      </summary>
      <div className="se-reglages-corps">
        {(Object.keys(OPTIONS_REGLAGES) as (keyof typeof OPTIONS_REGLAGES)[]).map((cle) => {
          const def = OPTIONS_REGLAGES[cle];
          const id = `${base}-${cle}`;
          return (
            <div key={cle} className="se-champ">
              <label className="se-champ-libelle" htmlFor={id}>
                {def.libelle}
              </label>
              <select id={id} className="se-saisie" value={courant(cle)} disabled={readOnly} aria-describedby={`${id}-aide`} onChange={(e: ChangeEvent<HTMLSelectElement>) => modifier(cle, e.target.value)}>
                {def.options.map((o) => (
                  <option key={o.valeur} value={o.valeur}>
                    {o.libelle}
                  </option>
                ))}
              </select>
              <p className="se-aide" id={`${id}-aide`}>
                {def.aide}
              </p>
            </div>
          );
        })}
        <div className="se-champ">
          <label className="se-champ-libelle" htmlFor={`${base}-ancre`}>
            {LIBELLE_ANCRE.libelle}
          </label>
          <input
            id={`${base}-ancre`}
            className="se-saisie"
            type="text"
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            value={ancre}
            disabled={readOnly}
            aria-invalid={ancreInvalide || undefined}
            aria-describedby={`${base}-ancre-aide`}
            onChange={(e) => modifier("ancre", e.target.value.toLowerCase())}
          />
          <p className="se-aide" id={`${base}-ancre-aide`}>
            {LIBELLE_ANCRE.aide}
            {ancreInvalide ? <strong className="se-aide-erreur"> Cette ancre n&apos;est pas valable : l&apos;enregistrement sera refusé.</strong> : null}
          </p>
        </div>
      </div>
    </details>
  );
}

// --- Image -------------------------------------------------------------------------------------------------------------

export function ChampImage({ libelle, value, onChange, readOnly }: ProprietesChamp<string | undefined>) {
  const id = useId();
  const entree = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [liste, setListe] = useState<ImageStudio[] | null>(null);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [chargement, setChargement] = useState(false);
  const valide = typeof value === "string" && estUrlImageStudio(value);

  async function televerser(fichier: File) {
    setErreur(null);
    setInfo(null);
    // Contrôles de confort (le serveur refait tous les contrôles, entête du fichier compris).
    const refus = messageTailleImage(fichier.size, fichier.type);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.append("image", fichier);
      const resultat = await televerserImageStudioAction(donnees);
      if (!resultat.ok || !resultat.url) {
        setErreur(resultat.erreur ?? "L'image n'a pas pu être téléversée.");
        return;
      }
      onChange(resultat.url);
      setListe(null);
      setInfo(resultat.avertissement ? `Image téléversée et choisie. ${resultat.avertissement}` : "Image téléversée et choisie.");
    } catch {
      setErreur("Le serveur n'a pas répondu : vérifiez la connexion puis réessayez (l'image fait 5 Mo au plus).");
    } finally {
      setEnvoi(false);
      if (entree.current) entree.current.value = "";
    }
  }

  async function basculerListe() {
    if (listeOuverte) {
      setListeOuverte(false);
      return;
    }
    setListeOuverte(true);
    if (liste) return;
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await listerImagesStudio();
      if (!resultat.ok) setErreur(resultat.erreur ?? "La liste des images n'a pas pu être lue.");
      else setListe(resultat.images);
    } catch {
      setErreur("Le serveur n'a pas répondu : réessayez dans un instant.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="se-champ" role="group" aria-labelledby={`${id}-libelle`}>
      <span className="se-champ-libelle" id={`${id}-libelle`}>
        {libelle}
        {readOnly ? <span className="se-champ-lecture"> (lecture seule)</span> : null}
      </span>
      {valide ? (
        // eslint-disable-next-line @next/next/no-img-element -- image du stockage Speedfood, adresse vérifiée ci-dessus.
        <img className="se-image-apercu" src={value} alt="Aperçu de l'image choisie" />
      ) : (
        <p className="se-aide">{value ? "L'adresse de cette image n'est pas valable : téléversez une nouvelle image." : "Aucune image choisie."}</p>
      )}
      <div className="se-image-actions">
        <button type="button" className="btn btn-secondary se-bouton-petit" disabled={readOnly || envoi} onClick={() => entree.current?.click()}>
          {envoi ? "Téléversement en cours…" : "Téléverser une image"}
        </button>
        <button type="button" className="btn btn-secondary se-bouton-petit" disabled={readOnly || envoi} aria-expanded={listeOuverte} aria-controls={`${id}-liste`} onClick={basculerListe}>
          Choisir parmi les images déjà téléversées
        </button>
      </div>
      <input
        ref={entree}
        id={`${id}-fichier`}
        className="se-fichier-cache"
        type="file"
        accept={TYPES_IMAGE.join(",")}
        tabIndex={-1}
        aria-hidden="true"
        data-champ-image="fichier"
        disabled={readOnly || envoi}
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          if (fichier) void televerser(fichier);
        }}
      />
      <p className="se-aide">
        JPEG, PNG ou WebP, {decrireTaille(TAILLE_MAX_IMAGE)} au plus. Les images SVG et GIF ne sont pas acceptées.
      </p>
      {erreur ? (
        <p className="se-champ-erreur" role="alert">
          {erreur}
        </p>
      ) : null}
      <p className="se-champ-info" role="status">
        {info ?? ""}
      </p>
      {listeOuverte ? (
        <div id={`${id}-liste`} className="se-images">
          {chargement ? <p className="se-aide">Chargement des images…</p> : null}
          {!chargement && liste && liste.length === 0 ? <p className="se-aide">Aucune image n&apos;a encore été téléversée.</p> : null}
          {liste && liste.length > 0 ? (
            <ul className="se-images-liste">
              {liste.map((image, i) => (
                <li key={image.nom}>
                  <button
                    type="button"
                    className="se-image-choix"
                    aria-pressed={image.url === value}
                    disabled={readOnly}
                    onClick={() => {
                      onChange(image.url);
                      setInfo("Image choisie.");
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- image du stockage Speedfood. */}
                    <img src={image.url} alt="" loading="lazy" />
                    <span className="sr-only">{libelleImageListe(i, image.creeLe)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// --- Restaurant --------------------------------------------------------------------------------------------------------

export function ChampRestaurant({ libelle, value, onChange, readOnly }: ProprietesChamp<string | undefined>) {
  const id = useId();
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<RestaurantChoisissable[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Le restaurant enregistré : son nom est relu (un restaurant dépublié ou suspendu n'est plus trouvé). `lu` garde l'identifiant
  // demandé : un résultat qui ne correspond plus à la valeur courante est ignoré.
  const [lu, setLu] = useState<{ id: string; restaurant: RestaurantChoisissable | null } | null>(null);
  const choisi = value && lu?.id === value ? lu.restaurant : undefined;

  useEffect(() => {
    let actif = true;
    if (!value) return;
    lireRestaurantPublie(value)
      .then((r) => {
        if (actif) setLu({ id: value, restaurant: r });
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [value]);

  // Recherche à la frappe, 300 ms après la dernière touche (une seule requête en cours à la fois).
  useEffect(() => {
    if (readOnly) return;
    let actif = true;
    const minuteur = setTimeout(() => {
      rechercherRestaurantsPublies(recherche)
        .then((r) => {
          if (!actif) return;
          if (r.ok) {
            setResultats(r.restaurants);
            setErreur(null);
          } else {
            setErreur(r.erreur ?? "La recherche n'a pas pu être faite.");
          }
        })
        .catch(() => {
          if (actif) setErreur("Le serveur n'a pas répondu : réessayez dans un instant.");
        });
    }, 300);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, [recherche, readOnly]);

  return (
    <div className="se-champ" role="group" aria-labelledby={`${id}-libelle`}>
      <span className="se-champ-libelle" id={`${id}-libelle`}>
        {libelle}
        {readOnly ? <span className="se-champ-lecture"> (lecture seule)</span> : null}
      </span>
      {value ? (
        <p className="se-restaurant-choisi" role="status">
          {choisi ? (
            <>
              Restaurant choisi : <strong>{choisi.nom}</strong>
              {choisi.quartier ? ` (${choisi.quartier})` : ""}
            </>
          ) : choisi === null ? (
            "Ce restaurant n'est pas (ou plus) publié : la carte ne s'affichera pas sur le site. Choisissez-en un autre."
          ) : (
            "Restaurant choisi."
          )}
        </p>
      ) : (
        <p className="se-aide">Aucun restaurant choisi.</p>
      )}
      <label className="se-champ-libelle" htmlFor={`${id}-recherche`}>
        Rechercher un restaurant publié par son nom
      </label>
      <input id={`${id}-recherche`} className="se-saisie" type="search" autoComplete="off" maxLength={60} value={recherche} disabled={readOnly} onChange={(e) => setRecherche(e.target.value)} />
      {erreur ? (
        <p className="se-champ-erreur" role="alert">
          {erreur}
        </p>
      ) : null}
      <p className="se-aide" role="status">
        {resultats === null ? "" : resultats.length === 0 ? "Aucun restaurant publié ne correspond." : `${resultats.length} restaurant${resultats.length > 1 ? "s" : ""} trouvé${resultats.length > 1 ? "s" : ""} (20 au plus).`}
      </p>
      {resultats && resultats.length > 0 ? (
        <ul className="se-resultats">
          {resultats.map((r) => (
            <li key={r.id}>
              <button type="button" className="se-choix" aria-pressed={r.id === value} disabled={readOnly} onClick={() => onChange(r.id)}>
                {r.nom}
                {r.quartier || r.categorie ? <span className="se-resultat-detail"> {[r.categorie, r.quartier].filter(Boolean).join(" · ")}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// --- Quartier ou famille de cuisine -----------------------------------------------------------------------------------

let taxonomies: Promise<ResultatTaxonomies> | null = null;
function lireTaxonomies(): Promise<ResultatTaxonomies> {
  // Une lecture par chargement de la page : les listes changent rarement.
  if (!taxonomies) {
    taxonomies = listerTaxonomiesPubliques().catch(() => ({ ok: false, quartiers: [], categories: [], erreur: "Le serveur n'a pas répondu." }));
  }
  return taxonomies;
}

export function ChampTaxonomie({ libelle, value, onChange, readOnly, source }: ProprietesChamp<string | undefined> & { source: "quartiers" | "categories" }) {
  const id = useId();
  const [options, setOptions] = useState<OptionTaxonomie[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    lireTaxonomies().then((r) => {
      if (!actif) return;
      if (r.ok) setOptions(source === "quartiers" ? r.quartiers : r.categories);
      else {
        taxonomies = null;
        setErreur(r.erreur ?? "Les listes n'ont pas pu être lues.");
      }
    });
    return () => {
      actif = false;
    };
  }, [source]);

  const actuel = value ?? "";
  const inconnu = actuel !== "" && options !== null && !options.some((o) => o.id === actuel);
  return (
    <div className="se-champ">
      <label className="se-champ-libelle" htmlFor={id}>
        {libelle}
        {readOnly ? <span className="se-champ-lecture"> (lecture seule)</span> : null}
      </label>
      <select id={id} className="se-saisie" value={actuel} disabled={readOnly || options === null} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
        <option value="">{source === "quartiers" ? "Tous les quartiers" : "Toutes les cuisines"}</option>
        {inconnu ? <option value={actuel}>(valeur introuvable : choisissez-en une autre)</option> : null}
        {(options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom}
          </option>
        ))}
      </select>
      {erreur ? (
        <p className="se-champ-erreur" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
