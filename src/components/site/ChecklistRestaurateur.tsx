"use client";

import { useState } from "react";

const POINTS: { cle: string; titre: string; aide: string; obligatoire: boolean }[] = [
  { cle: "etablissement", titre: "Nom, cuisine et quartier", aide: "Les trois champs de départ de votre inscription.", obligatoire: true },
  { cle: "menu", titre: "Au moins un plat avec son prix", aide: "Prix en francs guinéens. Sans plat, les clients ne peuvent rien commander.", obligatoire: true },
  { cle: "horaires", titre: "Vos horaires", aide: "Pour que vos clients sachent quand commander.", obligatoire: true },
  { cle: "photo", titre: "Une photo de couverture", aide: "Conseillé : une belle photo remplit la fiche.", obligatoire: false },
  { cle: "logo", titre: "Votre logo", aide: "Facultatif, il rassure vos clients.", obligatoire: false },
  { cle: "paiement", titre: "Vos moyens de paiement", aide: "Espèces, Orange Money, MTN MoMo : ce que vous acceptez vraiment.", obligatoire: false },
];

/**
 * « Ma fiche est-elle prête ? » : les mêmes points que ceux contrôlés par l'équipe avant publication (obligatoires : le restaurant doit avoir un
 * nom, un menu et des horaires). Pur outil de préparation, rien n'est envoyé ni enregistré.
 */
export function ChecklistRestaurateur() {
  const [faits, setFaits] = useState<Record<string, boolean>>({ etablissement: false });
  const total = POINTS.length;
  const nb = POINTS.filter((p) => faits[p.cle]).length;
  const bloquants = POINTS.filter((p) => p.obligatoire && !faits[p.cle]).length;
  const rayon = 52;
  const circ = 2 * Math.PI * rayon;

  return (
    <div className="pub-check">
      <div className="pub-check-anneau">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${nb} éléments prêts sur ${total}`}>
          <circle cx="60" cy="60" r={rayon} fill="none" stroke="var(--bordure)" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r={rayon}
            fill="none"
            stroke="var(--rouge-fonce)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - nb / total)}
            transform="rotate(-90 60 60)"
            className="pub-check-arc"
          />
        </svg>
        <strong>
          {nb}/{total}
        </strong>
      </div>
      <p className="pub-check-etat" role="status">
        {bloquants === 0 ? "Votre fiche est prête à être contrôlée par l'équipe." : `Il manque encore ${bloquants} élément${bloquants > 1 ? "s" : ""} obligatoire${bloquants > 1 ? "s" : ""}.`}
      </p>
      <ul className="pub-check-liste">
        {POINTS.map((p) => (
          <li key={p.cle}>
            <label>
              <input type="checkbox" checked={!!faits[p.cle]} onChange={(e) => setFaits((f) => ({ ...f, [p.cle]: e.target.checked }))} />
              <span>
                <strong>{p.titre}</strong>
                {p.obligatoire ? <span className="pub-check-tag"> obligatoire</span> : null}
                <small>{p.aide}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
