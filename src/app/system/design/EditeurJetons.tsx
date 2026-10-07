"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTRASTE_AA_TEXTE,
  LIBELLES_GROUPES,
  cssDepuisJetons,
  verifierContraste,
  type Groupe,
} from "@/lib/studio/jetons";
import { enregistrerJetonAction, reinitialiserJetonAction, reinitialiserTousJetonsAction, type ResultatJeton } from "@/lib/studio/jetons-actions";

/**
 * Éditeur de jetons de design avec aperçu VIVANT (palier 4, phase 1).
 *
 * L'aperçu fonctionne par injection de CSS dans un iframe de la page d'accueil réelle, sans
 * rechargement et sans appel serveur : changer une couleur repeint l'aperçu immédiatement. C'est
 * ce qui rend l'usage proche d'un éditeur de design, et c'est pourquoi la validation est refaite
 * côté serveur à l'enregistrement — le client est ici un confort, jamais un juge.
 *
 * L'iframe charge la page PUBLIQUE du site : ni brouillon, ni aperçu privé. Le design que l'on
 * modifie est donc exactement celui que verront les visiteurs, ce qui est ce qu'on veut juger.
 */

interface JetonVue {
  cle: string;
  valeur: string;
  libelle: string;
  groupe: Groupe;
  personnalise: boolean;
}

const etatInitial: ResultatJeton = { ok: false };

/** Les backgrounds sombres, qui portent du texte clair. Même raisonnement que dans reglages.ts. */
const FONDS_SOMBRES = new Set(["couleur.rouge", "couleur.rouge-fonce", "couleur.encre", "couleur.danger"]);

export function EditeurJetons({ jetons }: { jetons: JetonVue[] }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => Object.fromEntries(jetons.map((j) => [j.cle, j.valeur])));
  const [personnalises, setPersonnalises] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(jetons.map((j) => [j.cle, j.personnalise]))
  );
  /**
   * Dernière valeur ENREGISTRÉE par jeton. C'est la référence du bandeau « modification non
   * enregistrée », et non la valeur reçue au rendu du serveur : sans cette copie locale, un
   * enregistrement réussi continuerait d'afficher « non enregistré » tant que la page n'aurait pas
   * été rechargée.
   */
  const [enregistrees, setEnregistrees] = useState<Record<string, string>>(() =>
    Object.fromEntries(jetons.map((j) => [j.cle, j.valeur]))
  );
  /**
   * Les trois résultats d'action sont normalisés dans UN état, parce que l'effet de la section
   * suivante les traite de la même façon : chacun annonce soit un jeton enregistré, soit une liste
   * de jetons rétablis.
   */
  const [etat, actionEnregistrer, enCoursEnregistrement] = useActionState(enregistrerJetonAction, etatInitial);
  const [etatReinit, actionReinit, enCoursReinit] = useActionState(reinitialiserJetonAction, etatInitial);
  const [etatGlobal, actionToutRetablir, enCoursGlobal] = useActionState(reinitialiserTousJetonsAction, etatInitial);

  /** Dernière réponse reçue, quel que soit le bouton : un seul effet à écrire. */
  const derniereReponse = etat.ok ? etat : etatReinit.ok ? etatReinit : etatGlobal.ok ? etatGlobal : null;
  const [largeur, setLargeur] = useState<"bureau" | "telephone">("bureau");
  const [groupeActif, setGroupeActif] = useState<Groupe>("couleurs");
  const iframe = useRef<HTMLIFrameElement>(null);
  const styleApercu = useRef<HTMLStyleElement | null>(null);

  /**
   * Valeurs courantes vues par les effets.
   *
   * Indispensable : l'effet ci-dessous ne doit dépendre QUE de la réponse du serveur. S'il
   * dépendait aussi de `valeurs`, choisir une nouvelle couleur le relancerait avec le SUCCÈS
   * précédent en mémoire, et la nouvelle valeur — non enregistrée — serait marquée comme
   * enregistrée. C'était exactement le défaut signalé : « Enregistrer » devenait.disable
   * dès qu'on choisissait une seconde couleur.
   */
  const valeursCourantes = useRef(valeurs);
  valeursCourantes.current = valeurs;

  /**
   * La pastule « personnalisé » n'apparaît qu'après une réponse RÉUSSIE du serveur.
   * Avant ce correctif, elle était posée sur `onSubmit` — donc même quand l'enregistrement était
   * refusé (par exemple pour un contraste trop bas) : l'écran affichait « personnalisé » alors
   * que rien n'avait changé sur le site.
   */
  useEffect(() => {
    if (!derniereReponse) return;
    if (derniereReponse.cleEnregistree) {
      const cle = derniereReponse.cleEnregistree;
      setPersonnalises((p) => ({ ...p, [cle]: true }));
      setEnregistrees((e) => ({ ...e, [cle]: valeursCourantes.current[cle] ?? e[cle] }));
    }
    // « Rétablir » et « Revenir aux valeurs actuelles » : le serveur a supprimé les lignes, donc la
    // référence doit devenir la valeur DU CODE, sinon « Enregistrer » resterait désactivé sur une
    // valeur que le serveur ne connaît plus.
    if (derniereReponse.clesRétablies?.length) {
      for (const cle of derniereReponse.clesRétablies) {
        const original = jetons.find((j) => j.cle === cle);
        setPersonnalises((p) => ({ ...p, [cle]: Boolean(original?.personnalise) }));
        if (original) {
          setEnregistrees((e) => ({ ...e, [cle]: original.valeur }));
          setValeurs((v) => ({ ...v, [cle]: original.valeur }));
        }
      }
    }
  }, [derniereReponse, jetons]);

  /** Le CSS de l'aperçu, recalculé à chaque frappe. */
  const cssApercu = useMemo(() => cssDepuisJetons(new Map(Object.entries(valeurs))), [valeurs]);

  /**
   * Injection dans le document de l'iframe. Une balise dédiée, créée une fois et réutilisée : on ne
   * touche à rien d'autre dans l'aperçu, et le CSS disparaît net au retour aux valeurs actuelles.
   */
  const appliquerApercu = useCallback((css: string) => {
    const doc = iframe.current?.contentDocument;
    if (!doc) return;
    if (!styleApercu.current || !doc.body.contains(styleApercu.current)) {
      const style = doc.createElement("style");
      style.setAttribute("data-apercu-jetons", "1");
      doc.head.appendChild(style);
      styleApercu.current = style;
    }
    styleApercu.current.textContent = css;
  }, []);

  /**
   * Remet l'aperçu en haut de la page.
   *
   * Une iframe dont le `src` ne change jamais NE revient pas en haut d'elle-même : mesurer le
   * confirmait (défilement à 1300 px, puis plus aucun retour automatique). Un jour où l'on regarde
   * les cartes de restaurants, l'aperçu y restait ensuite — et on croyait que le haut de la page
   * était cassé. Le cadre se recharge au changement de largeur et à chaque navigation : c'est le
   * moment de le ramener.
   */
  const remonterApercu = useCallback(() => {
    try {
      iframe.current?.contentWindow?.scrollTo(0, 0);
    } catch {
      // Document non accessible : rien à faire, l'aperçu est déjà vide.
    }
  }, []);

  // Le style doit survivre au chargement de l'iframe : on le réapplique à chaque `load`.
  useEffect(() => {
    const node = iframe.current;
    if (!node) return;
    const surChargement = () => {
      appliquerApercu(cssApercu);
      remonterApercu();
    };
    node.addEventListener("load", surChargement);
    return () => node.removeEventListener("load", surChargement);
  }, [appliquerApercu, remonterApercu, cssApercu]);

  useEffect(() => {
    appliquerApercu(cssApercu);
  }, [appliquerApercu, cssApercu]);

  const groupes = Object.keys(LIBELLES_GROUPES) as Groupe[];
  const visibles = jetons.filter((j) => j.groupe === groupeActif);
  const modifiees = jetons.filter((j) => valeurs[j.cle] !== enregistrees[j.cle]);

  const changer = (cle: string, valeur: string) => setValeurs((v) => ({ ...v, [cle]: valeur }));

  /**
   * « Revenir aux valeurs actuelles » : remet **le SITE** à ses couleurs d'origine, pas seulement
   * l'écran. Correction du 7 octobre 2026 : la version précédente ne faisait qu'annuler les
   * modifications locales — le site gardait la couleur enregistrée, alors que l'intitule promettait
   * un retour. Si rien n'est personnalisé, le bouton n'envoie rien.
   */
  const revenirAuxActuelles = () => {
    if (modifiees.length > 0) {
      // Il y a des modifications non enregistrées : on ne touche pas au site, on les annule.
      setValeurs(Object.fromEntries(jetons.map((j) => [j.cle, enregistrees[j.cle] ?? j.valeur])));
      return;
    }
    if (!Object.values(personnalises).some(Boolean)) return;
    actionToutRetablir(new FormData());
  };

  return (
    <div className="dj">
      <div className="dj-reglages">
        <div className="dj-barre-actions">
          <div className="dj-groupes" role="tablist" aria-label="Groupes de réglages">
            {groupes.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={groupeActif === g}
                className={`dj-groupe ${groupeActif === g ? "actif" : ""}`}
                onClick={() => setGroupeActif(g)}
              >
                {LIBELLES_GROUPES[g]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondaire dj-retour"
            onClick={revenirAuxActuelles}
            disabled={enCoursGlobal}
            title={
              modifiees.length > 0
                ? "Annule les modifications non enregistrées"
                : "Remet le site à ses couleurs d'origine"
            }
          >
            {enCoursGlobal ? "Retour en cours…" : "Revenir aux valeurs actuelles"}
          </button>
        </div>

        {modifiees.length > 0 ? (
          <p className="dj-modifie" role="status">
            {modifiees.length} modification{modifiees.length > 1 ? "s" : ""} non enregistrée
            {modifiees.length > 1 ? "s" : ""} : visible{modifiees.length > 1 ? "s" : ""} uniquement dans l&apos;aperçu.
          </p>
        ) : null}

        <div className="dj-liste">
          {visibles.map((j) => (
            <LigneJeton
              key={j.cle}
              jeton={j}
              valeur={valeurs[j.cle]}
              enregistree={enregistrees[j.cle]}
              personnalise={Boolean(personnalises[j.cle])}
              autres={valeurs}
              onChange={(v) => changer(j.cle, v)}
              etat={etat}
              actionEnregistrer={actionEnregistrer}
              etatReinit={etatReinit}
              actionReinit={actionReinit}
              enCours={enCoursEnregistrement}
              enCoursReinit={enCoursReinit}
            />
          ))}
        </div>
      </div>

      <div className="dj-apercu">
        <div className="dj-apercu-barre">
          <div className="dj-groupe-boutons" role="group" aria-label="Largeur d&apos;aperçu">
            <button
              type="button"
              className={`dj-taille ${largeur === "bureau" ? "actif" : ""}`}
              aria-pressed={widthIs(largeur, "bureau")}
              onClick={() => setLargeur("bureau")}
            >
              Ordinateur
            </button>
            <button
              type="button"
              className={`dj-taille ${largeur === "telephone" ? "actif" : ""}`}
              aria-pressed={widthIs(largeur, "telephone")}
              onClick={() => setLargeur("telephone")}
            >
              Téléphone
            </button>
          </div>
          <div className="dj-apercu-actions">
            <button type="button" className="dj-haut" onClick={remonterApercu}>
              Haut de page
            </button>
          </div>
          <p className="dj-apercu-note">Aperçu de l&apos;accueil, tel qu&apos;un visiteur le voit.</p>
        </div>
        <div className={`dj-cadre dj-${largeur}`}>
          <iframe ref={iframe} title="Aperçu du site avec les jetons en cours" src="/" />
        </div>
      </div>
    </div>
  );
}

function widthIs(largeur: string, attendu: string): boolean {
  return largeur === attendu;
}

/** Une ligne : libellé, champ, contraste, enregistrement, rétablissement. */
function LigneJeton({
  jeton,
  valeur,
  enregistree,
  personnalise,
  autres,
  onChange,
  etat,
  actionEnregistrer,
  etatReinit,
  actionReinit,
  enCours,
  enCoursReinit,
}: {
  jeton: JetonVue;
  valeur: string;
  /** Dernière valeur enregistrée : c'est elle qui décide si « Enregistrer » est utile. */
  enregistree: string;
  personnalise: boolean;
  autres: Record<string, string>;
  onChange: (v: string) => void;
  etat: ResultatJeton;
  actionEnregistrer: (formData: FormData) => void;
  etatReinit: ResultatJeton;
  actionReinit: (formData: FormData) => void;
  enCours: boolean;
  enCoursReinit: boolean;
}) {
  const id = `jeton-${jeton.cle.replace(/\./g, "-")}`;
  const estCouleur = jeton.groupe === "couleurs" && jeton.cle !== "couleur.gradient-marque";

  /**
   * Le contraste s'affiche sous la couleur, avec le texte que cette couleur implique. Un refus,
   * pas une correction : la propriétaire garde le choix, elle voit seulement pourquoi
   * l'accessibilité s'y oppose.
   */
  let contraste: { rapport: number; conforme: boolean } | null = null;
  if (estCouleur) {
    const cleTexte = FONDS_SOMBRES.has(jeton.cle) ? "couleur.surface" : "couleur.encre";
    const texte = autres[cleTexte];
    if (texte) contraste = verifierContraste(valeur, texte);
  }

  const erreur = etat.cleEnErreur === jeton.cle ? etat.message : null;
  const succes = etat.ok && !etat.cleEnErreur ? etat.message : null;

  return (
    <div className="dj-ligne">
      <div className="dj-ligne-tete">
        <label htmlFor={id} className="dj-libelle">
          {jeton.libelle}
          {personnalise ? (
            <span className="dj-modifie-marque" title="Modifié par rapport aux valeurs d'origine">
              •
            </span>
          ) : null}
        </label>
        <code className="dj-cle">{jeton.cle}</code>
      </div>

      <div className="dj-champ">
        {estCouleur ? (
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(valeur) ? valeur : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="dj-pinceau"
            aria-label={`Couleur : ${jeton.libelle}`}
          />
        ) : null}
        <input
          id={id}
          type="text"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className="dj-valeur"
          spellCheck={false}
          disabled={jeton.cle === "couleur.gradient-marque"}
        />
      </div>

      {contraste ? (
        <p className={`dj-contraste ${contraste.conforme ? "ok" : "bas"}`}>
          Texte dessus : <strong>{contraste.rapport} : 1</strong>
          {contraste.conforme ? " — lisible" : ` — trop bas (il faut ${CONTRASTE_AA_TEXTE} : 1)`}
        </p>
      ) : null}

      {erreur ? (
        <p className="dj-erreur" role="alert">
          {erreur}
        </p>
      ) : null}
      {succes ? <p className="dj-succes">{succes}</p> : null}

      <div className="dj-actions">
        <form action={actionEnregistrer}>
          <input type="hidden" name="cle" value={jeton.cle} />
          <input type="hidden" name="portee" value="site" />
          <input type="hidden" name="valeur" value={valeur} />
          <button type="submit" className="btn btn-secondaire" disabled={enCours || valeur === enregistree}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
        {personnalise ? (
          <form action={actionReinit}>
            <input type="hidden" name="cle" value={jeton.cle} />
            <input type="hidden" name="portee" value="site" />
            <button type="submit" className="btn dj-fantome" disabled={enCoursReinit} title="Remettre à la valeur du code">
              Rétablir
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
