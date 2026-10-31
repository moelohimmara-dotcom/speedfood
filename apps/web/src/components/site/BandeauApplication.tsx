"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const CLE = "speedfood_bandeau_app";
const REPORT_MS = 14 * 24 * 60 * 60 * 1000;

const abonnement = () => () => undefined;

/** Vrai sur un téléphone Android dont la personne n'a pas fermé le bandeau récemment (lu côté navigateur seulement ; faux au rendu serveur). */
function bandeauAttendu(): boolean {
  try {
    const jusqua = Number(localStorage.getItem(CLE));
    if (Number.isFinite(jusqua) && jusqua > Date.now()) return false;
  } catch {
    // Stockage indisponible (navigation privée) : le bandeau s'affiche, il se rouvrira à la prochaine visite.
  }
  return /Android/i.test(navigator.userAgent);
}

/**
 * Bandeau « Installez l'application » affiché en haut du site SEULEMENT sur un téléphone Android (l'application n'existe pas encore ailleurs). Il se ferme pour
 * 14 jours ; le choix est gardé dans le navigateur (jamais envoyé au serveur). Rien n'est rendu avant l'hydratation : pas de saut de mise en page ni d'écart de rendu.
 */
export function BandeauApplication() {
  const chemin = usePathname() ?? "";
  const attendu = useSyncExternalStore(abonnement, bandeauAttendu, () => false);
  const [ferme, setFerme] = useState(false);
  const visible = attendu && !ferme;

  if (!visible || chemin.startsWith("/installer")) return null;

  const fermer = () => {
    try {
      localStorage.setItem(CLE, String(Date.now() + REPORT_MS));
    } catch {
      // Sans stockage, la fermeture ne vaut que pour cette page.
    }
    setFerme(true);
  };

  return (
    <aside className="appbandeau" aria-label="Application Speedfood">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo local déjà optimisé. */}
      <img className="appbandeau-logo" src="/icons/icon-192.png" alt="" width={40} height={40} />
      <p className="appbandeau-texte">
        <strong>Speedfood sur votre téléphone</strong>
        <span>Commandez plus vite, suivez la livraison.</span>
      </p>
      <Link href="/installer" className="appbandeau-bouton">
        Installer
      </Link>
      <button type="button" className="appbandeau-fermer" aria-label="Fermer ce bandeau" onClick={fermer}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </aside>
  );
}
