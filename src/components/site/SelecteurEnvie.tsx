"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

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

/**
 * « Votre envie du moment ? » : un clic sur une famille propose UN vrai plat disponible d'un restaurant ouvert. Sans JavaScript, la
 * première suggestion reste lisible (rendu serveur) ; avec, les puces changent la proposition.
 */
export function SelecteurEnvie({ envies }: { envies: EnvieAffichee[] }) {
  const [courante, setCourante] = useState(envies[0]?.famille ?? "");
  const e = envies.find((x) => x.famille === courante) ?? envies[0];
  if (!e) return null;

  return (
    <div className="pub-envie">
      <p className="pub-kicker">Votre envie du moment ?</p>
      <div className="pub-puces" role="group" aria-label="Familles de plats">
        {envies.map((x) => (
          <button key={x.famille} type="button" className="pub-puce" aria-pressed={x.famille === e.famille} onClick={() => setCourante(x.famille)}>
            {x.libelle}
          </button>
        ))}
      </div>
      <div className="pub-envie-resultat" aria-live="polite">
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
