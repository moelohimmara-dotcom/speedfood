"use client";

import { useActionState, useState } from "react";
import { restaurerDepuisHistoriqueAction, type EntreeHistorique, type ResultatJeton } from "@/lib/studio/jetons-actions";

/**
 * Panneau « Historique » des réglages du site.
 *
 * Un journal d'ÉCRITURES : chaque ligne dit ce qu'un jeton VALAIT avant et après, et « Revenir »
 * remet ce jeton à la valeur précédente. Revenir N fois en arrière revient N actions en arrière.
 *
 * Différence avec un simple annuler/refaire : celui-ci vit dans la seule session et disparaît au
 * rechargement. Ici, l'historique est en base — il survit à la page, au navigateur et aux jours.
 *
 * La restauration est elle-même journalisée : revenir reste réversible.
 */

const etatInitial: ResultatJeton = { ok: false };

function horodatage(iso: string): string {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 8) return `il y a ${jours} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Rendu d'une valeur, lisible : une couleur par son nom, sinon la valeur entière. */
function valeurLisible(valeur: string | null): string {
  if (valeur === null) return "valeur d'origine";
  return /^#[0-9a-fA-F]{6}$/.test(valeur) ? valeur : valeur.length > 24 ? `${valeur.slice(0, 24)}…` : valeur;
}

export function PanneauHistorique({ entrees, aPersonnalise }: { entrees: EntreeHistorique[]; aPersonnalise: boolean }) {
  const [etat, action, enCours] = useActionState(restaurerDepuisHistoriqueAction, etatInitial);
  const [ouvert, setOuvert] = useState(false);
  // Pas de `router.refresh()` : `revalidatePath` dans l'action serveur fait déjà rerendre la
  // route courante dans le meme aller-retour (App Router). Appeler les deux rafraîchirait deux fois.

  return (
    <div className="dj-historique">
      <button
        type="button"
        className="dj-historique-tete"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
      >
        <span>
          Historique
          {entrees.length > 0 ? <span className="dj-historique-compte"> {entrees.length}</span> : null}
        </span>
        <span className="dj-historique-indice" aria-hidden="true">
          {ouvert ? "▲" : "▼"}
        </span>
      </button>

      {!ouvert ? (
        <p className="dj-historique-vide">
          {aPersonnalise
            ? "Aucun changement enregistré pour l'instant. L'historique se remplira au premier enregistrement."
            : "Le site est à ses valeurs d'origine : rien à revenir."}
        </p>
      ) : null}

      {ouvert && entrees.length === 0 ? (
        <p className="dj-historique-vide">
          Aucun changement enregistré. Dès que vous modifierez une couleur et que vous l&apos;enregistrerez, elle apparaîtra ici, avec la
          possibilité de revenir en arrière.
        </p>
      ) : null}

      {ouvert && entrees.length > 0 ? (
        <ol className="dj-historique-liste">
          {entrees.map((e) => (
            <li key={e.id} className="dj-historique-entree">
              <div className="dj-historique-contenu">
                <p className="dj-historique-titre">
                  {e.libelle}
                  <span className="dj-historique-date">{horodatage(e.creeLe)}</span>
                </p>
                <p className="dj-historique-valeurs">
                  {e.action === "suppression" ? (
                    <>
                      remis à <code>{valeurLisible(e.valeurApres)}</code> (valeur d&apos;origine)
                    </>
                  ) : e.valeurAvant === null ? (
                    <>passé de la valeur d&apos;origine à <code>{valeurLisible(e.valeurApres)}</code></>
                  ) : (
                    <>
                      <code>{valeurLisible(e.valeurAvant)}</code> → <code>{valeurLisible(e.valeurApres)}</code>
                    </>
                  )}
                </p>
              </div>
              <form action={action}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="btn dj-fantome" disabled={enCours}>
                  Revenir
                </button>
              </form>
            </li>
          ))}
        </ol>
      ) : null}

      {etat.ok && etat.message ? <p className="dj-succes">{etat.message}</p> : null}
      {!etat.ok && etat.message && etat.cleEnErreur === undefined ? (
        <p className="dj-erreur" role="alert">
          {etat.message}
        </p>
      ) : null}

      {ouvert ? (
        <p className="dj-historique-note">
          Revenir annule ce changement et le refait dans l&apos;historique : rien n&apos;est perdu. Les 200 changements les plus récents sont conservés.
        </p>
      ) : null}
    </div>
  );
}
