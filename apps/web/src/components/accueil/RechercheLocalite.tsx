"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface OptionLocalite {
  niveau: "region" | "prefecture" | "commune" | "quartier";
  nom: string;
  slug: string;
  /** Où se trouve la zone (« région de Kindia », « Conakry », « Matam, Conakry ») ; vide pour une région. */
  contexte: string;
  /** Autres façons d'écrire le nom, reconnues par la recherche. */
  alias?: string[];
  restaurants: number;
}

const MAX_SUGGESTIONS = 10;
const LIBELLE_NIVEAU: Record<OptionLocalite["niveau"], string> = { region: "Région", prefecture: "Préfecture", commune: "Commune", quartier: "Quartier" };
const ORDRE_NIVEAU: Record<OptionLocalite["niveau"], number> = { region: 0, prefecture: 1, commune: 2, quartier: 3 };

type EtatPosition = "repos" | "recherche" | "refusee" | "indisponible" | "introuvable" | "hors-guinee" | "erreur";

const MESSAGES_POSITION: Record<Exclude<EtatPosition, "repos">, string> = {
  recherche: "Recherche de votre zone…",
  refusee: "La position n'a pas été autorisée. Vous pouvez choisir votre zone dans la liste.",
  indisponible: "Votre appareil n'a pas pu donner sa position. Choisissez votre zone dans la liste.",
  introuvable: "Votre position ne correspond à aucune zone Speedfood pour le moment. Choisissez votre zone dans la liste.",
  "hors-guinee": "Votre position est en dehors de la Guinée. Choisissez votre zone dans la liste.",
  erreur: "Le service de localisation ne répond pas pour le moment. Choisissez votre zone dans la liste.",
};

/** Compare sans tenir compte des accents ni de la casse (« kenien » trouve « Kénien »). */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function lien(o: Pick<OptionLocalite, "niveau" | "slug">): string {
  return `/?${o.niveau}=${encodeURIComponent(o.slug)}#zone`;
}

/**
 * Recherche d'une localité par saisie : la zone se choisit à la main, sans géolocalisation. Les suggestions viennent des
 * zones réellement enregistrées (communes et quartiers) ; une saisie sans correspondance le dit au lieu d'inventer une zone.
 */
export function RechercheLocalite({
  options,
  libelle,
  placeholder,
  boutonLibelle,
  positionLibelle,
}: {
  options: OptionLocalite[];
  libelle: string;
  placeholder: string;
  boutonLibelle: string;
  positionLibelle: string;
}) {
  const routeur = useRouter();
  const identifiant = useId();
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const [aucune, setAucune] = useState(false);
  const [position, setPosition] = useState<EtatPosition>("repos");

  /** Demande la position à l'appareil (uniquement sur clic), puis la rattache à une zone enregistrée côté serveur. */
  function utiliserMaPosition() {
    setAucune(false);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPosition("indisponible");
      return;
    }
    setPosition("recherche");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const reponse = await fetch("/api/zone/position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
          });
          if (!reponse.ok) throw new Error("service");
          const donnees: { zone: { niveau: OptionLocalite["niveau"]; slug: string } | null; horsGuinee?: boolean } = await reponse.json();
          if (donnees.zone) {
            setPosition("repos");
            routeur.push(lien({ niveau: donnees.zone.niveau, slug: donnees.zone.slug } as OptionLocalite));
          } else {
            setPosition(donnees.horsGuinee ? "hors-guinee" : "introuvable");
          }
        } catch {
          setPosition("erreur");
        }
      },
      (erreur) => setPosition(erreur.code === erreur.PERMISSION_DENIED ? "refusee" : "indisponible"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  const suggestions = useMemo(() => {
    const cherche = normaliser(saisie);
    // Sans saisie : les régions, pour parcourir le pays du plus large au plus précis.
    if (!cherche) return options.filter((o) => o.niveau === "region").slice(0, MAX_SUGGESTIONS);
    const noms = (o: OptionLocalite) => [o.nom, ...(o.alias ?? [])].map(normaliser);
    const parNom = options.filter((o) => noms(o).some((n) => n.includes(cherche)));
    const dejaVus = new Set(parNom);
    // Les zones qui se trouvent dans le lieu cherché (« kindia » trouve aussi les communes de la préfecture de Kindia) viennent après.
    const parLieu = options.filter((o) => !dejaVus.has(o) && normaliser(o.contexte).includes(cherche));
    const rang = (o: OptionLocalite) => (noms(o).some((n) => n.startsWith(cherche)) ? 0 : 1);
    // À rang égal, les zones qui ont déjà des restaurants passent d'abord : ce sont celles où l'on peut commander.
    const avecRestaurants = (o: OptionLocalite) => (o.restaurants > 0 ? 0 : 1);
    return [
      ...parNom.sort((a, b) => rang(a) - rang(b) || avecRestaurants(a) - avecRestaurants(b) || ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau] || a.nom.localeCompare(b.nom, "fr")),
      ...parLieu.sort((a, b) => avecRestaurants(a) - avecRestaurants(b) || ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau] || a.nom.localeCompare(b.nom, "fr")),
    ].slice(0, MAX_SUGGESTIONS);
  }, [saisie, options]);

  function aller(option: OptionLocalite | undefined) {
    if (!option) {
      setAucune(true);
      return;
    }
    setAucune(false);
    setOuvert(false);
    routeur.push(lien(option));
  }

  function surClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOuvert(false);
      setActif(0);
    }
  }

  const idListe = `${identifiant}-liste`;
  const listeVisible = ouvert && suggestions.length > 0;
  const aucuneZone = aucune || (saisie.trim() !== "" && suggestions.length === 0);

  // L'option active reste dans la zone visible de la liste (dix suggestions : sans cela, les dernières sont inaccessibles au clavier).
  useEffect(() => {
    if (!listeVisible) return;
    document.getElementById(`${identifiant}-opt-${actif}`)?.scrollIntoView({ block: "nearest" });
  }, [actif, listeVisible, identifiant]);

  return (
    <form
      className="recherche-localite"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        aller(ouvert ? suggestions[actif] : suggestions[0]);
      }}
    >
      <label htmlFor={`${identifiant}-champ`} className="recherche-localite-etiquette">
        {libelle}
      </label>
      <div className="recherche-localite-ligne">
        <div className="recherche-localite-champ">
          <input
            id={`${identifiant}-champ`}
            type="text"
            role="combobox"
            aria-expanded={listeVisible}
            aria-controls={listeVisible ? idListe : undefined}
            aria-describedby={aucuneZone ? `${identifiant}-vide` : undefined}
            aria-activedescendant={ouvert && suggestions[actif] ? `${identifiant}-opt-${actif}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={saisie}
            placeholder={placeholder}
            onChange={(e) => {
              setSaisie(e.target.value);
              setOuvert(true);
              setActif(0);
              setAucune(false);
            }}
            onFocus={() => setOuvert(true)}
            onBlur={() => window.setTimeout(() => setOuvert(false), 120)}
            onKeyDown={surClavier}
          />
          {ouvert && suggestions.length > 0 ? (
            <ul id={idListe} role="listbox" className="recherche-localite-liste" aria-label="Localités proposées">
              {suggestions.map((o, i) => (
                <li
                  key={`${o.niveau}-${o.slug}`}
                  id={`${identifiant}-opt-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  className={`recherche-localite-option${i === actif ? " est-actif" : ""}`}
                  onMouseEnter={() => setActif(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aller(o);
                  }}
                >
                  <span className="recherche-localite-nom">{o.nom}</span>
                  <span className="recherche-localite-sous">
                    {LIBELLE_NIVEAU[o.niveau]}
                    {o.contexte ? ` · ${o.contexte}` : ""}
                    {o.restaurants > 0 ? ` · ${o.restaurants} restaurant${o.restaurants > 1 ? "s" : ""}` : " · pas encore de restaurant"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="pub-btn recherche-localite-bouton">
          {boutonLibelle}
        </button>
      </div>
      {positionLibelle ? (
      <button
        type="button"
        className="recherche-localite-position"
        onClick={() => {
          if (position !== "recherche") utiliserMaPosition();
        }}
        aria-disabled={position === "recherche" || undefined}
        aria-busy={position === "recherche" || undefined}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
        {positionLibelle}
      </button>
      ) : null}
      <p className="recherche-localite-statut" role="status" aria-live="polite">
        {position !== "repos" ? MESSAGES_POSITION[position] : ""}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {ouvert && saisie.trim() !== "" ? (suggestions.length === 0 ? "Aucune localité trouvée" : `${suggestions.length} localité${suggestions.length > 1 ? "s" : ""} proposée${suggestions.length > 1 ? "s" : ""}`) : ""}
      </p>
      {aucuneZone ? (
        <p className="recherche-localite-vide" id={`${identifiant}-vide`}>
          Aucune localité ne correspond à « {saisie.trim()} ». Essayez le nom d&apos;une région, d&apos;une préfecture, d&apos;une commune ou d&apos;un quartier.
        </p>
      ) : null}
    </form>
  );
}
