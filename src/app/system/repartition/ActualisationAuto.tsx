"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les données du serveur toutes les 20 secondes tant que l'onglet est visible : le poste de répartition suit les commandes sans action manuelle. */
export function ActualisationAuto({ secondes = 20 }: { secondes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const minuteur = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, secondes * 1000);
    return () => window.clearInterval(minuteur);
  }, [router, secondes]);
  return null;
}
