"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createUsePuck } from "@puckeditor/core";
import { listerVersions, type VersionPage } from "@/lib/system-admin/pages-blocs";
import { Pastille } from "@/components/admin/blocs";
import { IconeAdmin } from "@/components/admin/icones";
import { formaterDateCourte } from "@/app/system/formatage";
import { LIBELLE_NON_ENREGISTRE, libelleStatut } from "@/lib/studio/possibilites";
import { TAILLES_APERCU } from "@/lib/studio/francisation";
import { useEditeur, type MessageErreur } from "./contexte";

/**
 * En-tête de l'éditeur (remplace celui de Puck, `overrides.header`) : titre, statut, actions serveur, annuler/rétablir,
 * taille de l'aperçu, messages. Rendu DANS Puck : il lit l'historique et l'aperçu par `usePuck`.
 *
 * Les boutons indisponibles (palier insuffisant) restent visibles, désactivés, avec leur explication reliée par
 * `aria-describedby`. Ce n'est qu'un confort : le serveur refuse de toute façon (tâche 6).
 */

const usePuck = createUsePuck();
const MAX_MOTIF = 200;

/** Empêche la touche Suppr/Retour arrière de supprimer le bloc sélectionné quand le focus est sur nos boutons (raccourci de Puck). */
export function bloquerSuppressionPuck(e: KeyboardEvent) {
  const cible = e.target as HTMLElement;
  if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName)) e.preventDefault();
}

function ZoneErreur({ erreur }: { erreur: MessageErreur | null }) {
  // Zone toujours présente (role="alert") : son contenu est annoncé dès qu'il change.
  return (
    <div role="alert" className={erreur ? "se-erreur" : undefined}>
      {erreur ? (
        <>
          <p>{erreur.message}</p>
          {erreur.details.length > 0 ? (
            <ul>
              {erreur.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Explication({ id, texte }: { id: string; texte: string | null }) {
  return texte ? (
    <p className="ad-palier-note se-explication" id={id}>
      {texte}
    </p>
  ) : null;
}

function DialoguePublier({ fermer, dialogue }: { fermer: () => void; dialogue: React.RefObject<HTMLDialogElement | null> }) {
  const { publier, modifie, enCours } = useEditeur();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<MessageErreur | null>(null);

  const confirmer = async (e: React.FormEvent) => {
    e.preventDefault();
    const resultat = await publier(motif.trim());
    if (resultat.ok) {
      setMotif("");
      setErreur(null);
      fermer();
    } else {
      setErreur(resultat.erreur);
    }
  };

  return (
    <dialog ref={dialogue} className="ad-dialogue se-dialogue" aria-labelledby="se-publier-titre" onClose={() => setErreur(null)}>
      <form className="ad-dialogue-corps" onSubmit={confirmer}>
        <h2 id="se-publier-titre">Publier la page ?</h2>
        <p>
          Le brouillon remplace la version en ligne : les visiteurs le verront aussitôt.
          {modifie ? " Vos modifications en cours seront d'abord enregistrées." : ""}
        </p>
        <div className="field">
          <label htmlFor="se-motif">Motif (facultatif, {MAX_MOTIF} caractères au maximum)</label>
          <textarea
            id="se-motif"
            rows={3}
            maxLength={MAX_MOTIF}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            aria-describedby="se-motif-compteur"
          />
          <p className="se-compteur" id="se-motif-compteur">
            {motif.length} / {MAX_MOTIF}
          </p>
        </div>
        <ZoneErreur erreur={erreur} />
        <div className="ad-dialogue-actions">
          <button type="button" className="btn btn-secondary" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={enCours !== null}>
            {enCours === "publier" ? "Publication…" : enCours === "enregistrer" ? "Enregistrement…" : "Publier maintenant"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DialogueHistorique({ fermer, dialogue, versions }: { fermer: () => void; dialogue: React.RefObject<HTMLDialogElement | null>; versions: VersionPage[] | null }) {
  const { restaurer, possibilites, statut, version: versionEnLigne, modifie, enCours } = useEditeur();
  const dispatch = usePuck((s) => s.dispatch);
  const [aConfirmer, setAConfirmer] = useState<number | null>(null);
  const [erreur, setErreur] = useState<MessageErreur | null>(null);
  const boutonConfirmer = useRef<HTMLButtonElement>(null);
  const boutonsRemettre = useRef(new Map<number, HTMLButtonElement | null>());
  // Version dont le bouton « Remettre… » doit reprendre le focus (après « Annuler »).
  const [retourFocus, setRetourFocus] = useState<number | null>(null);

  // Le focus suit l'affichage : sur « Oui, remettre… » quand la confirmation apparaît (un effet, pas une image d'animation,
  // qui pouvait passer avant l'affichage du bouton), puis sur « Remettre… » de la version si on annule.
  useEffect(() => {
    if (aConfirmer !== null) boutonConfirmer.current?.focus();
  }, [aConfirmer]);
  useEffect(() => {
    if (retourFocus !== null) boutonsRemettre.current.get(retourFocus)?.focus();
  }, [retourFocus]);

  const confirmer = async (numero: number) => {
    const resultat = await restaurer(numero);
    if (!resultat.ok) {
      setErreur(resultat.erreur);
      return;
    }
    if (resultat.donnees) {
      const donnees = resultat.donnees;
      // Remplacement des données de Puck (gardé dans l'historique : Ctrl+Z revient en arrière).
      dispatch({ type: "setData", data: () => donnees, recordHistory: true });
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    }
    setAConfirmer(null);
    setErreur(null);
    fermer();
  };

  return (
    <dialog
      ref={dialogue}
      className="ad-dialogue se-dialogue"
      aria-labelledby="se-historique-titre"
      onClose={() => {
        setAConfirmer(null);
        setErreur(null);
      }}
    >
      <div className="ad-dialogue-corps">
        <h2 id="se-historique-titre">Historique des publications</h2>
        <p>
          Remettre une version dans le brouillon ne change pas la page en ligne : elle ne change qu&apos;à la prochaine publication.
        </p>
        {possibilites.explications.restaurer ? <p className="ad-palier-note" id="se-restaurer-limite">{possibilites.explications.restaurer}</p> : null}
        {versions === null ? (
          <p role="status">Chargement des versions…</p>
        ) : versions.length === 0 ? (
          <p>Cette page n&apos;a encore jamais été publiée.</p>
        ) : (
          <ol className="se-versions">
            {versions.map((v) => (
              <li key={v.version}>
                <div className="se-version-entete">
                  <strong>Version {v.version}</strong>
                  {statut === "publie" && v.version === versionEnLigne ? <Pastille ton="succes">En ligne</Pastille> : null}
                </div>
                <p className="se-version-meta">
                  Publiée le {formaterDateCourte(v.cree_le)}
                  {v.motif ? ` · Motif : ${v.motif}` : ""}
                </p>
                {aConfirmer === v.version ? (
                  <div className="se-confirmation" role="group" aria-labelledby={`se-confirmer-${v.version}`}>
                    <p id={`se-confirmer-${v.version}`}>
                      Remettre la version {v.version} dans le brouillon ?{modifie ? " Vos modifications non enregistrées seront remplacées." : ""}
                    </p>
                    <div className="ad-dialogue-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setAConfirmer(null);
                          setRetourFocus(v.version);
                        }}
                      >
                        Annuler
                      </button>
                      <button ref={boutonConfirmer} type="button" className="btn btn-primary" disabled={enCours !== null} onClick={() => confirmer(v.version)}>
                        {enCours === "restaurer" ? "Restauration…" : `Oui, remettre la version ${v.version}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    ref={(el) => {
                      boutonsRemettre.current.set(v.version, el);
                    }}
                    type="button"
                    className="btn btn-secondary se-bouton-petit"
                    disabled={!possibilites.peutRestaurer}
                    aria-describedby={possibilites.peutRestaurer ? undefined : "se-restaurer-limite"}
                    onClick={() => {
                      setRetourFocus(null);
                      setAConfirmer(v.version);
                    }}
                  >
                    Remettre la version {v.version} dans le brouillon
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        <ZoneErreur erreur={erreur} />
        <div className="ad-dialogue-actions">
          <button type="button" className="btn btn-secondary" onClick={fermer}>
            Fermer
          </button>
        </div>
      </div>
    </dialog>
  );
}

function BoutonTaille({ largeur, libelle, actif }: { largeur: number; libelle: string; actif: boolean }) {
  const dispatch = usePuck((s) => s.dispatch);
  const { annoncer } = useEditeur();
  return (
    <button
      type="button"
      className={`se-taille${actif ? " se-taille-active" : ""}`}
      aria-pressed={actif}
      onClick={() => {
        dispatch({
          type: "setUi",
          ui: (ui) => ({ viewports: { ...ui.viewports, current: { width: largeur, height: "auto" } } }),
          recordHistory: false,
        });
        annoncer(`Aperçu ${libelle.toLowerCase()} (${largeur} pixels de large).`);
      }}
    >
      {libelle} <span className="se-taille-px">{largeur}</span>
    </button>
  );
}

export function EnteteEditeur() {
  const ctx = useEditeur();
  const { page, possibilites, modifie, enCours, statut, version } = ctx;
  const retour = usePuck((s) => s.history.back);
  const avance = usePuck((s) => s.history.forward);
  const aPasse = usePuck((s) => s.history.hasPast);
  const aFutur = usePuck((s) => s.history.hasFuture);
  const largeur = usePuck((s) => s.appState.ui.viewports.current.width);
  const dialoguePublier = useRef<HTMLDialogElement>(null);
  const dialogueHistorique = useRef<HTMLDialogElement>(null);
  const boutonPublier = useRef<HTMLButtonElement>(null);
  const boutonHistorique = useRef<HTMLButtonElement>(null);
  const [versions, setVersions] = useState<VersionPage[] | null>(null);
  const etat = libelleStatut(statut, version);
  const lectureSeule = !possibilites.peutEnregistrer;

  const ouvrirHistorique = async () => {
    setVersions(null);
    dialogueHistorique.current?.showModal();
    try {
      setVersions(await listerVersions(page.id));
    } catch {
      setVersions([]);
      ctx.annoncer("L'historique n'a pas pu être chargé.");
    }
  };

  const quitter = (e: MouseEvent<HTMLAnchorElement>) => {
    if (modifie && !window.confirm("Des modifications ne sont pas enregistrées. Quitter l'éditeur quand même ?")) e.preventDefault();
  };

  return (
    <div className="se-entete" onKeyDown={bloquerSuppressionPuck}>
      <div className="se-entete-haut">
        <Link href="/system/contenu/pages" className="ad-retour se-retour" onClick={quitter}>
          <span className="ad-retour-fleche" aria-hidden="true">
            <IconeAdmin nom="chevron" taille={16} />
          </span>
          Retour à la liste
        </Link>
        <div className="se-entete-titre">
          <h1>{page.titre}</h1>
          <span className="se-entete-pastilles">
            <Pastille ton={etat.ton}>{etat.texte}</Pastille>
            {modifie ? <Pastille ton="attention">{LIBELLE_NON_ENREGISTRE}</Pastille> : null}
            {lectureSeule ? <Pastille ton="neutre">Lecture seule</Pastille> : null}
          </span>
        </div>
      </div>

      <div className="se-entete-outils">
        {!lectureSeule ? (
          <div className="se-groupe" role="group" aria-label="Annuler ou rétablir">
            <button type="button" className="se-outil" onClick={retour} disabled={!aPasse} aria-keyshortcuts="Control+Z">
              Annuler <kbd>Ctrl+Z</kbd>
            </button>
            <button type="button" className="se-outil" onClick={avance} disabled={!aFutur} aria-keyshortcuts="Control+Shift+Z Control+Y">
              Rétablir <kbd>Ctrl+Maj+Z</kbd>
            </button>
          </div>
        ) : null}

        <div className="se-groupe" role="group" aria-label="Taille de l'aperçu">
          {TAILLES_APERCU.map((t) => (
            <BoutonTaille key={t.code} largeur={t.largeur} libelle={t.libelle} actif={largeur === t.largeur} />
          ))}
        </div>

        <div className="se-groupe se-actions">
          <a className="btn btn-secondary se-bouton-petit" href={`/p/${page.slug}?apercu=1`} target="_blank" rel="noopener">
            Voir l&apos;aperçu<span className="sr-only"> du brouillon enregistré (s&apos;ouvre dans un nouvel onglet)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
          <button ref={boutonHistorique} type="button" className="btn btn-secondary se-bouton-petit" aria-haspopup="dialog" onClick={ouvrirHistorique}>
            Historique
          </button>
          <button
            type="button"
            className="btn btn-secondary se-bouton-petit"
            disabled={lectureSeule || enCours !== null || !modifie}
            aria-describedby={lectureSeule ? "se-limite-enregistrer" : undefined}
            onClick={() => void ctx.enregistrer()}
          >
            {enCours === "enregistrer" ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
          <button
            ref={boutonPublier}
            type="button"
            className="btn btn-primary se-bouton-petit"
            disabled={!possibilites.peutPublier || enCours !== null}
            aria-describedby={possibilites.peutPublier ? undefined : "se-limite-publier"}
            aria-haspopup="dialog"
            onClick={() => dialoguePublier.current?.showModal()}
          >
            Publier
          </button>
        </div>
      </div>

      <Explication id="se-limite-enregistrer" texte={possibilites.explications.enregistrer} />
      {possibilites.peutEnregistrer ? <Explication id="se-limite-publier" texte={possibilites.explications.publier} /> : null}
      {!possibilites.peutEnregistrer && possibilites.explications.publier ? (
        <span className="sr-only" id="se-limite-publier">
          {possibilites.explications.publier}
        </span>
      ) : null}

      <ZoneErreur erreur={ctx.erreur} />
      {ctx.avertissement ? (
        <div className="se-avertissement" role="status">
          <p>{ctx.avertissement}</p>
          <button type="button" className="btn btn-secondary se-bouton-petit" onClick={ctx.fermerAvertissement}>
            Fermer l&apos;avertissement
          </button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {ctx.annonce}
      </p>

      <DialoguePublier
        dialogue={dialoguePublier}
        fermer={() => {
          dialoguePublier.current?.close();
          boutonPublier.current?.focus();
        }}
      />
      <DialogueHistorique
        dialogue={dialogueHistorique}
        versions={versions}
        fermer={() => {
          dialogueHistorique.current?.close();
          boutonHistorique.current?.focus();
        }}
      />
    </div>
  );
}
