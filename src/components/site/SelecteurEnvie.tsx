"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SceneEnvie } from "@/components/site/vecteurs/ScenesEnvie";

export interface EnvieAffichee {
  famille: string;
  libelle: string;
  platNom: string;
  prix: number;
  restaurantId: string;
  restaurantNom: string;
  quartier: string;
  /** Illustration du plat, déjà dessinée côté serveur (garde l'énorme catalogue de motifs hors du JavaScript du navigateur). */
  visuel: ReactNode;
}

/** Durée d'affichage de chaque famille avant de passer à la suivante (la barre sous la puce la fait voir). */
const DUREE_MS = 4200;

const REQUETE_REDUIT = "(prefers-reduced-motion: reduce)";
function suivreReduit(rappel: () => void) {
  const m = window.matchMedia(REQUETE_REDUIT);
  m.addEventListener("change", rappel);
  return () => m.removeEventListener("change", rappel);
}

function animationsPermises(racine: HTMLElement | null): boolean {
  const html = document.documentElement;
  if (html.hasAttribute("data-calme") || html.hasAttribute("data-eco") || html.hasAttribute("data-cache")) return false;
  return !racine?.classList.contains("hors-ecran");
}

/**
 * « Votre envie du moment ? » : quatre familles de plats, chacune avec sa scène vectorielle animée et UN vrai plat disponible d'un restaurant
 * ouvert. Les familles s'enchaînent d'elles-mêmes en boucle (la puce active clignote puis une barre se remplit sous elle) ; un clic sur une
 * puce choisit la famille et arrête le défilement ; un bouton permet de le mettre en pause ou de le relancer. Le défilement ne tourne que si la
 * page est visible, le bloc à l'écran et les animations non coupées (voir PilotageAnimations) ; mouvement réduit : aucun défilement.
 * Sans JavaScript, la première suggestion reste lisible (rendu serveur).
 */
export function SelecteurEnvie({ envies }: { envies: EnvieAffichee[] }) {
  const [courante, setCourante] = useState(envies[0]?.famille ?? "");
  const [auto, setAuto] = useState(true);
  const racine = useRef<HTMLDivElement>(null);
  const reduit = useSyncExternalStore(suivreReduit, () => window.matchMedia(REQUETE_REDUIT).matches, () => false);
  const defile = auto && !reduit && envies.length > 1;

  useEffect(() => {
    if (!defile) return;
    // Un délai par famille (et non un intervalle global) : il repart avec la barre de la puce, les deux restent synchrones.
    // Si le bloc est hors écran ou les animations coupées, on laisse la famille en place et on re-teste un peu plus tard.
    let minuteur = 0;
    const planifier = (delai: number) => {
      minuteur = window.setTimeout(() => {
        if (!animationsPermises(racine.current)) return planifier(800);
        const i = envies.findIndex((x) => x.famille === courante);
        setCourante(envies[(i + 1) % envies.length].famille);
      }, delai);
    };
    planifier(DUREE_MS);
    return () => window.clearTimeout(minuteur);
  }, [defile, envies, courante]);

  const e = envies.find((x) => x.famille === courante) ?? envies[0];
  if (!e) return null;

  return (
    <div className="pub-envie boucle" ref={racine} data-famille={e.famille}>
      <div className="pub-envie-tete">
        <p className="pub-kicker">Votre envie du moment ?</p>
        {envies.length > 1 && !reduit ? (
          <button type="button" className="pub-envie-pause" aria-pressed={!auto} onClick={() => setAuto((v) => !v)}>
            <span aria-hidden="true">{auto ? "⏸" : "▶"}</span>
            <span className="sr-only">{auto ? "Mettre le défilement des familles en pause" : "Relancer le défilement des familles"}</span>
          </button>
        ) : null}
      </div>

      <div className="pub-puces" role="group" aria-label="Familles de plats">
        {envies.map((x) => {
          const active = x.famille === e.famille;
          return (
            <button
              key={x.famille}
              type="button"
              className={`pub-puce${active && defile ? " pub-puce-defile" : ""}`}
              aria-pressed={active}
              onClick={() => {
                setCourante(x.famille);
                setAuto(false);
              }}
              style={active && defile ? ({ ["--duree-envie" as string]: `${DUREE_MS}ms` } as React.CSSProperties) : undefined}
            >
              {x.libelle}
            </button>
          );
        })}
      </div>

      {/* La scène change avec la famille : `key` la remonte, ce qui rejoue son entrée en scène. */}
      <div className="pub-envie-scene" aria-hidden="true" data-famille={e.famille}>
        <div key={e.famille} className="pub-envie-scene-interieur">
          <SceneEnvie famille={e.famille} />
        </div>
      </div>

      <div className="pub-envie-resultat" aria-live={auto && !reduit ? "off" : "polite"}>
        <span className="pub-envie-visuel">{e.visuel}</span>
        <div>
          <p className="pub-envie-plat">{e.platNom}</p>
          <p className="pub-envie-resto">
            {e.restaurantNom}
            {e.quartier ? ` · ${e.quartier}` : ""}
          </p>
          <p className="pub-envie-prix">{e.prix.toLocaleString("fr-FR")}&nbsp;GNF</p>
        </div>
      </div>
      <Link href={`/restaurants/${e.restaurantId}`} className="pub-btn">
        Voir {e.restaurantNom}
        <span className="pub-btn-point" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
