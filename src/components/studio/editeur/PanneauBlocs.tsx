"use client";

import { useEffect, useRef, useState } from "react";
import { Puck, createUsePuck } from "@puckeditor/core";
import { libelleBloc, TYPES_AJOUTABLES } from "@/lib/studio/editeur-donnees";
import { ZONE_RACINE, extraitBloc, nomsActions, planifierOperation, pluriel, type OperationPanneau } from "@/lib/studio/panneau-blocs";
import { IconeAdmin } from "@/components/admin/icones";
import { useEditeur } from "./contexte";
import { bloquerSuppressionPuck } from "./EnteteEditeur";

/**
 * Panneau de gauche de l'éditeur (palier 3, tâche 7) : la réserve de blocs de Puck (glisser-déposer à la souris) et le
 * panneau « Blocs de la page », qui offre les MÊMES opérations au clavier et au lecteur d'écran (liste ordonnée, une ligne
 * par bloc, boutons Monter, Descendre, Dupliquer, Supprimer, Ajouter un bloc). Chaque opération passe par `dispatch` de
 * Puck (une seule source de données), est annoncée dans une zone `aria-live` et replace le focus sur une ligne existante.
 */

const usePuck = createUsePuck();

type Focus = { cible: number | "ajout"; jeton: number } | null;

function PanneauBlocs() {
  const { possibilites, annoncer } = useEditeur();
  const contenu = usePuck((s) => s.appState.data.content);
  const selection = usePuck((s) => s.appState.ui.itemSelector);
  const dispatch = usePuck((s) => s.dispatch);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const lignes = useRef<(HTMLButtonElement | null)[]>([]);
  const boutonAjout = useRef<HTMLButtonElement>(null);
  const premierChoix = useRef<HTMLButtonElement>(null);
  const modifiable = possibilites.peutEnregistrer;
  const types = contenu.map((b) => b.type);
  const indexSelectionne = selection && (selection.zone ?? ZONE_RACINE) === ZONE_RACINE ? selection.index : null;

  // Après chaque opération, le focus va sur la ligne concernée (ou sur « Ajouter un bloc » si la page est vide).
  useEffect(() => {
    if (!focus) return;
    if (focus.cible === "ajout") boutonAjout.current?.focus();
    else lignes.current[focus.cible]?.focus();
  }, [focus, contenu.length]);

  useEffect(() => {
    if (menuOuvert) premierChoix.current?.focus();
  }, [menuOuvert]);

  const selectionner = (index: number | null) => dispatch({ type: "setUi", ui: { itemSelector: index === null ? null : { index, zone: ZONE_RACINE } } });

  const executer = (operation: OperationPanneau) => {
    const plan = planifierOperation(operation, types);
    annoncer(plan.annonce);
    if (!plan.ok) return;
    dispatch(plan.action);
    selectionner(plan.cible);
    const cible = plan.cible ?? "ajout";
    setFocus((f) => ({ cible, jeton: (f?.jeton ?? 0) + 1 }));
  };

  const ajouter = (typeBloc: string) => {
    setMenuOuvert(false);
    executer({ type: "ajouter", typeBloc, apres: indexSelectionne });
  };

  return (
    <section className="se-section" aria-labelledby="se-blocs-titre" onKeyDown={bloquerSuppressionPuck}>
      <h2 id="se-blocs-titre" className="se-section-titre">
        Blocs de la page <span className="se-compte">({pluriel(contenu.length, "bloc")})</span>
      </h2>
      {contenu.length === 0 ? <p className="se-aide">La page est vide : ajoutez un premier bloc.</p> : null}
      <ol className="se-liste">
        {contenu.map((bloc, i) => {
          const noms = nomsActions(i, bloc.type);
          const choisi = indexSelectionne === i;
          return (
            <li key={String(bloc.props.id ?? i)} className={`se-ligne${choisi ? " se-ligne-choisie" : ""}`}>
              <button
                ref={(el) => {
                  lignes.current[i] = el;
                }}
                type="button"
                className="se-ligne-bouton"
                aria-current={choisi ? "true" : undefined}
                onClick={() => {
                  selectionner(i);
                  annoncer(`Bloc ${i + 1}, ${libelleBloc(bloc.type)}, sélectionné : ses réglages sont affichés à droite.`);
                }}
              >
                <span className="se-ligne-type">
                  <span className="sr-only">Bloc </span>
                  {i + 1}. {libelleBloc(bloc.type)}
                </span>
                <span className="se-ligne-extrait">{extraitBloc(bloc.type, bloc.props)}</span>
              </button>
              {modifiable ? (
                <span className="se-ligne-actions">
                  <button type="button" className="se-icone" aria-label={noms.monter} title={noms.monter} aria-disabled={i === 0} onClick={() => executer({ type: "monter", index: i })}>
                    <span className="se-fleche-haut" aria-hidden="true">
                      <IconeAdmin nom="chevron" taille={16} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="se-icone"
                    aria-label={noms.descendre}
                    title={noms.descendre}
                    aria-disabled={i === contenu.length - 1}
                    onClick={() => executer({ type: "descendre", index: i })}
                  >
                    <span className="se-fleche-bas" aria-hidden="true">
                      <IconeAdmin nom="chevron" taille={16} />
                    </span>
                  </button>
                  <button type="button" className="se-icone" aria-label={noms.dupliquer} title={noms.dupliquer} onClick={() => executer({ type: "dupliquer", index: i })}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
                      <path d="M15.5 8.5V5.5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2h3" />
                    </svg>
                  </button>
                  <button type="button" className="se-icone se-icone-danger" aria-label={noms.supprimer} title={noms.supprimer} onClick={() => executer({ type: "supprimer", index: i })}>
                    <IconeAdmin nom="corbeille" taille={16} />
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {modifiable ? (
        <div className="se-ajout">
          <button
            ref={boutonAjout}
            type="button"
            className="btn btn-secondary se-bouton-petit"
            aria-expanded={menuOuvert}
            aria-controls="se-menu-ajout"
            onClick={() => setMenuOuvert((v) => !v)}
          >
            Ajouter un bloc
          </button>
          {menuOuvert ? (
            <div
              id="se-menu-ajout"
              className="se-menu-ajout"
              role="group"
              aria-label="Type de bloc à ajouter"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setMenuOuvert(false);
                  boutonAjout.current?.focus();
                }
              }}
            >
              <p className="se-aide">
                {indexSelectionne === null ? "Le bloc sera ajouté à la fin de la page." : `Le bloc sera ajouté après le bloc ${indexSelectionne + 1}.`}
              </p>
              {TYPES_AJOUTABLES.map((t, i) => (
                <button key={t.type} ref={i === 0 ? premierChoix : undefined} type="button" className="se-choix" onClick={() => ajouter(t.type)}>
                  {t.libelle}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Contenu du panneau de gauche (remplace la barre d'onglets de Puck). */
export function PanneauGauche() {
  const { possibilites } = useEditeur();
  return (
    <div className="se-gauche">
      {/* La structure de la page d'abord (ordre de tabulation logique), la réserve à glisser (souris seulement) ensuite. */}
      <PanneauBlocs />
      {possibilites.peutEnregistrer ? (
        <section className="se-section se-reserve" aria-labelledby="se-reserve-titre">
          <h2 id="se-reserve-titre" className="se-section-titre">
            Glisser un bloc dans l&apos;aperçu
          </h2>
          <p className="se-aide">À la souris. Au clavier, utilisez « Ajouter un bloc » ci-dessus.</p>
          <Puck.Components />
        </section>
      ) : null}
    </div>
  );
}
