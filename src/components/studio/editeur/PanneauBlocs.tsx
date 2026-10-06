"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Puck, createUsePuck } from "@puckeditor/core";
import { libelleBloc } from "@/lib/studio/editeur-donnees";
import {
  ZONE_RACINE,
  construirePlan,
  extraitBloc,
  nomsActions,
  planifierOperation,
  pluriel,
  type BlocContenu,
  type CibleBloc,
  type LignePanneau,
  type OperationPanneau,
} from "@/lib/studio/panneau-blocs";
import { CATEGORIES_BLOCS, REGISTRE, compterBlocsContenu, estTypeSimple } from "@/lib/studio/registre";
import { IconeAdmin } from "@/components/admin/icones";
import { useEditeur } from "./contexte";
import { bloquerSuppressionPuck } from "./EnteteEditeur";

/**
 * Panneau de gauche de l'éditeur : la réserve de blocs de Puck (glisser-déposer à la souris) et le panneau « Blocs de la
 * page », qui offre les MÊMES opérations au clavier et au lecteur d'écran (liste ordonnée, une ligne par bloc, boutons
 * Monter, Descendre, Dupliquer, Supprimer, Ajouter un bloc). Les blocs DANS une colonne sont listés sous leur bloc Colonnes,
 * colonne par colonne, avec les mêmes boutons. Chaque opération passe par `dispatch` de Puck (une seule source de données),
 * est annoncée dans une zone `aria-live` et replace le focus sur une ligne existante.
 */

const usePuck = createUsePuck();

type Cle = string;
const cleDe = (c: CibleBloc): Cle => `${c.zone}|${c.index}`;

/** Menu « Ajouter un bloc » : types regroupés par famille ; dans une colonne, seulement les blocs simples. */
function MenuAjout({
  texteBouton,
  aide,
  zone,
  seulementSimples,
  refBouton,
  onChoisir,
  desactive,
}: {
  texteBouton: string;
  aide: string;
  zone: string;
  seulementSimples: boolean;
  refBouton?: (el: HTMLButtonElement | null) => void;
  onChoisir: (typeBloc: string, zone: string) => void;
  desactive?: boolean;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement | null>(null);
  const premierChoix = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (ouvert) premierChoix.current?.focus();
  }, [ouvert]);
  const premierType = REGISTRE.find((e) => !seulementSimples || estTypeSimple(e.type))?.type;
  return (
    <div className="se-ajout">
      <button
        ref={(el) => {
          bouton.current = el;
          refBouton?.(el);
        }}
        type="button"
        className="btn btn-secondary se-bouton-petit"
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        aria-disabled={desactive || undefined}
        onClick={() => {
          if (!desactive) setOuvert((v) => !v);
        }}
      >
        {texteBouton}
      </button>
      {ouvert ? (
        <div
          id={id}
          className="se-menu-ajout"
          role="group"
          aria-label="Type de bloc à ajouter"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOuvert(false);
              bouton.current?.focus();
            }
          }}
        >
          <p className="se-aide">{aide}</p>
          {CATEGORIES_BLOCS.map((categorie) => {
            const types = REGISTRE.filter((e) => e.categorie === categorie.code && (!seulementSimples || estTypeSimple(e.type)));
            if (types.length === 0) return null;
            return (
              <div key={categorie.code} role="group" aria-label={categorie.libelle} className="se-menu-famille">
                <p className="se-menu-famille-titre" aria-hidden="true">
                  {categorie.libelle}
                </p>
                {types.map((t) => (
                  <button
                    key={t.type}
                    ref={t.type === premierType ? premierChoix : undefined}
                    type="button"
                    className="se-choix"
                    onClick={() => {
                      setOuvert(false);
                      onChoisir(t.type, zone);
                    }}
                  >
                    {t.libelle}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PanneauBlocs() {
  const { possibilites, annoncer } = useEditeur();
  const contenu = usePuck((s) => s.appState.data.content) as BlocContenu[];
  const selection = usePuck((s) => s.appState.ui.itemSelector);
  const dispatch = usePuck((s) => s.dispatch);
  const lignes = useRef(new Map<Cle, HTMLButtonElement>());
  const boutonAjout = useRef<HTMLButtonElement | null>(null);
  // Focus à poser après la prochaine mise à jour des données (les lignes n'existent qu'après elle) ; borné à quelques rendus.
  const enAttente = useRef<{ cible: CibleBloc | "ajout"; rendus: number } | null>(null);
  const [, setJeton] = useState(0);
  const modifiable = possibilites.peutEnregistrer;
  const plan = construirePlan(contenu);
  const selectionZone = selection ? (selection.zone ?? ZONE_RACINE) : null;
  const selectionRacine = selection && selectionZone === ZONE_RACINE ? selection.index : null;

  useEffect(() => {
    const attente = enAttente.current;
    if (!attente) return;
    const element = attente.cible === "ajout" ? boutonAjout.current : lignes.current.get(cleDe(attente.cible));
    if (element) {
      enAttente.current = null;
      element.focus();
    } else if (++attente.rendus > 3) {
      enAttente.current = null;
    }
  });

  const selectionner = (cible: CibleBloc | null) =>
    dispatch({ type: "setUi", ui: { itemSelector: cible === null ? null : { index: cible.index, zone: cible.zone } } });

  const executer = (operation: OperationPanneau) => {
    const resultat = planifierOperation(operation, contenu);
    annoncer(resultat.annonce);
    if (!resultat.ok) return;
    dispatch(resultat.action);
    selectionner(resultat.cible);
    enAttente.current = { cible: resultat.cible ?? "ajout", rendus: 0 };
    setJeton((j) => j + 1);
  };

  const ajouterRacine = (typeBloc: string) => executer({ type: "ajouter", typeBloc, apres: selectionRacine, zone: ZONE_RACINE });

  const ligneBloc = (ligne: LignePanneau) => {
    const { bloc, zone, index, total, situation } = ligne;
    const noms = nomsActions(index, bloc.type, situation);
    const choisi = selection !== null && selectionZone === zone && selection.index === index;
    const nomLigne = situation ? `Bloc ${index + 1}, ${libelleBloc(bloc.type)}, de la colonne ${situation.colonne}` : `Bloc ${index + 1}, ${libelleBloc(bloc.type)}`;
    return (
      <li key={String(bloc.props.id ?? `${zone}-${index}`)} className={`se-ligne${choisi ? " se-ligne-choisie" : ""}`}>
        <button
          ref={(el) => {
            const cle = cleDe({ zone, index });
            if (el) lignes.current.set(cle, el);
            else lignes.current.delete(cle);
          }}
          type="button"
          className="se-ligne-bouton"
          aria-current={choisi ? "true" : undefined}
          onClick={() => {
            selectionner({ zone, index });
            annoncer(`${nomLigne}, sélectionné : ses réglages sont affichés à droite.`);
          }}
        >
          <span className="se-ligne-type">
            <span className="sr-only">Bloc </span>
            {index + 1}. {libelleBloc(bloc.type)}
          </span>
          <span className="se-ligne-extrait">{extraitBloc(bloc.type, bloc.props)}</span>
        </button>
        {modifiable ? (
          <span className="se-ligne-actions">
            <button type="button" className="se-icone" aria-label={noms.monter} title={noms.monter} aria-disabled={index === 0} onClick={() => executer({ type: "monter", index, zone })}>
              <span className="se-fleche-haut" aria-hidden="true">
                <IconeAdmin nom="chevron" taille={16} />
              </span>
            </button>
            <button type="button" className="se-icone" aria-label={noms.descendre} title={noms.descendre} aria-disabled={index === total - 1} onClick={() => executer({ type: "descendre", index, zone })}>
              <span className="se-fleche-bas" aria-hidden="true">
                <IconeAdmin nom="chevron" taille={16} />
              </span>
            </button>
            <button type="button" className="se-icone" aria-label={noms.dupliquer} title={noms.dupliquer} onClick={() => executer({ type: "dupliquer", index, zone })}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
                <path d="M15.5 8.5V5.5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2h3" />
              </svg>
            </button>
            <button type="button" className="se-icone se-icone-danger" aria-label={noms.supprimer} title={noms.supprimer} onClick={() => executer({ type: "supprimer", index, zone })}>
              <IconeAdmin nom="corbeille" taille={16} />
            </button>
          </span>
        ) : null}
        {ligne.colonnes ? (
          <div className="se-colonnes-plan">
            {ligne.colonnes.map((colonne) => {
              const selectionDansColonne = selection !== null && selectionZone === colonne.zone ? selection.index : null;
              return (
                <section key={colonne.zone} className="se-colonne-plan" aria-label={`Colonne ${colonne.numero} du bloc ${index + 1}${colonne.affichee ? "" : " (non affichée)"}`}>
                  <h3 className="se-colonne-titre">
                    Colonne {colonne.numero}
                    {colonne.affichee ? "" : " (non affichée : à vider)"} <span className="se-compte">({pluriel(colonne.lignes.length, "bloc")})</span>
                  </h3>
                  {colonne.lignes.length > 0 ? <ol className="se-liste">{colonne.lignes.map(ligneBloc)}</ol> : <p className="se-aide">Cette colonne est vide.</p>}
                  {modifiable && colonne.affichee ? (
                    <MenuAjout
                      texteBouton={`Ajouter un bloc dans la colonne ${colonne.numero} du bloc ${index + 1}`}
                      aide={selectionDansColonne === null ? "Le bloc sera ajouté à la fin de la colonne." : `Le bloc sera ajouté après le bloc ${selectionDansColonne + 1} de la colonne.`}
                      zone={colonne.zone}
                      seulementSimples
                      onChoisir={(typeBloc, z) => executer({ type: "ajouter", typeBloc, apres: selectionDansColonne, zone: z })}
                    />
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section className="se-section" aria-labelledby="se-blocs-titre" onKeyDown={bloquerSuppressionPuck}>
      <h2 id="se-blocs-titre" className="se-section-titre">
        Blocs de la page <span className="se-compte">({pluriel(compterBlocsContenu(contenu), "bloc")})</span>
      </h2>
      {contenu.length === 0 ? <p className="se-aide">La page est vide : ajoutez un premier bloc.</p> : null}
      <ol className="se-liste">{plan.map(ligneBloc)}</ol>

      {modifiable ? (
        <MenuAjout
          texteBouton="Ajouter un bloc"
          aide={selectionRacine === null ? "Le bloc sera ajouté à la fin de la page." : `Le bloc sera ajouté après le bloc ${selectionRacine + 1}.`}
          zone={ZONE_RACINE}
          seulementSimples={false}
          refBouton={(el) => {
            boutonAjout.current = el;
          }}
          onChoisir={ajouterRacine}
        />
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
