"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ouvrirJourneeAction } from "@/lib/menu/actions";

export interface PlatOuverture {
  id: string;
  nom: string;
  prixAffiche: string;
  /** Phrase courte sous le nom : « confirmé il y a 2 h », « à reconfirmer », « épuisé hier ». */
  etat: string;
  disponible: boolean;
  section: string | null;
}

function BoutonOuvrir({ disponibles, epuises }: { disponibles: number; epuises: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="rc-ouv-barre">
      <p className="rc-ouv-resume" role="status">
        <strong>{disponibles}</strong> disponible{disponibles > 1 ? "s" : ""} · <strong>{epuises}</strong> épuisé{epuises > 1 ? "s" : ""}
      </p>
      <button type="submit" className="btn btn-primary rc-ouv-valider" disabled={pending}>
        {pending ? "Enregistrement…" : "Ouvrir ma journée"}
      </button>
    </div>
  );
}

/**
 * Une ligne par plat, deux gros boutons (Oui / Épuisé). Aucun champ à taper. Les choix partent en une seule requête.
 * Sans JavaScript, les boutons radio natifs et le bouton d'envoi fonctionnent quand même (seuls « Tout… » et le compteur
 * demandent du JavaScript).
 */
export function FormulaireOuverture({ plats, erreur }: { plats: PlatOuverture[]; erreur: boolean }) {
  const [choix, setChoix] = useState<Record<string, boolean>>(() => Object.fromEntries(plats.map((p) => [p.id, p.disponible])));
  const disponibles = plats.filter((p) => choix[p.id]).length;

  const sections = new Map<string, PlatOuverture[]>();
  for (const p of plats) {
    const cle = p.section ?? "";
    sections.set(cle, [...(sections.get(cle) ?? []), p]);
  }

  return (
    <form action={ouvrirJourneeAction} className="rc-ouv">
      {erreur ? (
        <div className="ad-bandeau ad-bandeau-attention" role="alert">
          <p style={{ margin: 0 }}>Vos choix n&apos;ont pas pu être enregistrés. Réessayez dans un instant.</p>
        </div>
      ) : null}

      <div className="rc-ouv-tout">
        <button type="button" className="btn btn-secondary" onClick={() => setChoix(Object.fromEntries(plats.map((p) => [p.id, true])))}>
          Tout est disponible
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setChoix(Object.fromEntries(plats.map((p) => [p.id, false])))}>
          Tout est épuisé
        </button>
      </div>

      {[...sections.entries()].map(([section, liste]) => (
        <section key={section || "sans-section"} className="rc-ouv-groupe">
          {section ? <h2 className="rc-ouv-titre">{section}</h2> : null}
          <ul className="rc-ouv-liste">
            {liste.map((p) => (
              <li key={p.id} className="rc-ouv-ligne" data-etat={choix[p.id] ? "oui" : "non"}>
                <fieldset className="rc-ouv-champ">
                  <legend className="rc-ouv-plat">
                    <span className="rc-ouv-nom">{p.nom}</span>
                    <span className="rc-ouv-meta">
                      {p.prixAffiche} · {p.etat}
                    </span>
                  </legend>
                  <div className="rc-ouv-choix">
                    <label className="rc-ouv-bouton rc-ouv-oui">
                      <input type="radio" name={`plat_${p.id}`} value="oui" checked={choix[p.id] === true} onChange={() => setChoix((c) => ({ ...c, [p.id]: true }))} />
                      <span>Oui</span>
                    </label>
                    <label className="rc-ouv-bouton rc-ouv-non">
                      <input type="radio" name={`plat_${p.id}`} value="non" checked={choix[p.id] === false} onChange={() => setChoix((c) => ({ ...c, [p.id]: false }))} />
                      <span>Épuisé</span>
                    </label>
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <BoutonOuvrir disponibles={disponibles} epuises={plats.length - disponibles} />
    </form>
  );
}
