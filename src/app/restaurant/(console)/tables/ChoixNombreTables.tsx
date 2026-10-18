"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const MIN = 1;

/** Nombre de tables avec − et + : la planche de QR se met à jour toute seule (l'adresse porte `?n=`), sans bouton « Préparer ». */
export function ChoixNombreTables({ valeur, max }: { valeur: number; max: number }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [saisie, setSaisie] = useState(valeur > 0 ? String(valeur) : "");
  const minuteur = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  function appliquer(brut: string) {
    setSaisie(brut);
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => {
      const n = Number.parseInt(brut, 10);
      if (Number.isInteger(n) && n >= MIN && n <= max) routeur.replace(`${chemin}?n=${n}`, { scroll: false });
    }, 350);
  }

  const courant = Number.parseInt(saisie, 10);
  const nombre = Number.isInteger(courant) ? courant : 0;

  return (
    <div className="ssp-nombre">
      <label htmlFor="ssp-n" className="ssp-sous-titre">
        Combien de tables ? (1 à {max})
      </label>
      <div className="ssp-nombre-ligne">
        <button type="button" className="btn btn-secondary" aria-label="Une table de moins" disabled={nombre <= MIN} onClick={() => appliquer(String(Math.max(MIN, nombre - 1)))}>
          −
        </button>
        <input id="ssp-n" type="number" inputMode="numeric" min={MIN} max={max} value={saisie} onChange={(e) => appliquer(e.target.value)} />
        <button type="button" className="btn btn-secondary" aria-label="Une table de plus" disabled={nombre >= max} onClick={() => appliquer(String(Math.min(max, nombre + 1)))}>
          +
        </button>
      </div>
    </div>
  );
}
