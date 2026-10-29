"use client";

import { useEffect, useState } from "react";

/**
 * Barre d'action fixe, téléphone et tablette seulement : la décision se trouvait tout en bas de la fiche (84 % de la page à 375 px). Elle rappelle l'état et
 * mène au bloc « Décision ». Elle s'efface dès que ce bloc est à l'écran, pour ne pas le recouvrir. Au-delà de 1200 px la décision reste à droite
 * et la barre n'existe pas (feuille de style).
 */
export function BarreDecisionMobile({ titre, sous, ton }: { titre: string; sous: string; ton: "attention" | "succes" | "danger" | "neutre" }) {
  const [decisionVisible, setDecisionVisible] = useState(false);

  useEffect(() => {
    const cible = document.getElementById("decision");
    if (!cible) return;
    const observateur = new IntersectionObserver(([entree]) => setDecisionVisible(entree.isIntersecting), { threshold: 0.15 });
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);

  if (decisionVisible) return null;
  return (
    <div className={`ad-barre-decision ad-barre-decision-${ton}`} role="region" aria-label="Résumé de la décision">
      <p className="ad-barre-decision-texte">
        <strong>{titre}</strong>
        <span>{sous}</span>
      </p>
      <a className="btn btn-primary" href="#decision">
        Décision <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
