"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/** Sérialise les champs d'un formulaire (sans les champs techniques de React) pour détecter une modification. */
function serialiser(formulaire: HTMLFormElement): string {
  const donnees = Array.from(new FormData(formulaire).entries())
    .filter(([cle]) => !cle.startsWith("$ACTION"))
    // Un fichier choisi doit compter comme une modification : on retient son nom et sa taille (un champ vide = « : 0 »).
    .map(([cle, valeur]) => [
      cle,
      valeur instanceof File ? `${valeur.name}:${valeur.size}` : String(valeur),
    ]);
  return JSON.stringify(donnees);
}

/**
 * Suivi des modifications d'un formulaire : compare l'état courant à l'état de départ (pris au chargement, puis après
 * chaque enregistrement réussi). Prévient aussi l'utilisateur avant qu'il quitte la page avec des modifications perdues.
 */
export function useSuiviModifications(
  formulaire: React.RefObject<HTMLFormElement | null>,
  enregistre: boolean,
) {
  const base = useRef<string | null>(null);
  const [modifie, setModifie] = useState(false);

  function mesurer() {
    if (formulaire.current && base.current !== null) {
      setModifie(serialiser(formulaire.current) !== base.current);
    }
  }

  useEffect(() => {
    if (formulaire.current) {
      base.current = serialiser(formulaire.current);
    }
  }, [formulaire]);

  // Après un enregistrement réussi, l'état courant devient la nouvelle référence (le formulaire se réinitialise d'abord).
  useEffect(() => {
    if (!enregistre) {
      return;
    }
    const minuteur = window.setTimeout(() => {
      if (formulaire.current) {
        base.current = serialiser(formulaire.current);
        setModifie(false);
      }
    }, 300);
    return () => window.clearTimeout(minuteur);
  }, [enregistre, formulaire]);

  useEffect(() => {
    if (!modifie) {
      return;
    }
    const avertir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [modifie]);

  function annuler() {
    formulaire.current?.reset();
    setModifie(false);
  }

  return { modifie, mesurer, annuler };
}

/**
 * Barre d'enregistrement collée en bas de l'écran. Sur ordinateur elle reste toujours visible (« Aucune modification », boutons
 * grisés) pour qu'on sache où enregistrer. Sur téléphone elle n'apparaît que lorsqu'il y a quelque chose à faire (modifications,
 * erreur, ou confirmation pendant 4 secondes) afin de ne pas masquer le formulaire. Un message équivalent reste annoncé aux
 * lecteurs d'écran (région `status`).
 */
export function BarreEnregistrement({
  modifie,
  enCours,
  etat,
  onAnnuler,
  libelle = "Enregistrer",
  messageSucces = "Modifications enregistrées",
  variante = "admin",
}: {
  modifie: boolean;
  enCours: boolean;
  /** Résultat de la dernière action du formulaire (`useActionState`). */
  etat: { erreur?: string; succes?: boolean };
  onAnnuler: () => void;
  libelle?: string;
  /** Texte affiché après un enregistrement réussi. */
  messageSucces?: string;
  /** `console` : au-dessus de la navigation basse de la console restaurateur (téléphone). */
  variante?: "admin" | "console";
}) {
  // La confirmation disparaît d'elle-même après 4 secondes : on retient l'objet d'état déjà « vu » (setState asynchrone).
  const [etatMasque, setEtatMasque] = useState<object | null>(null);
  const erreur = etat.erreur;
  const succes = Boolean(etat.succes);

  useEffect(() => {
    if (!succes) {
      return;
    }
    const minuteur = window.setTimeout(() => setEtatMasque(etat), 4000);
    return () => window.clearTimeout(minuteur);
  }, [succes, etat]);

  const confirmationVisible = succes && etatMasque !== etat;
  const visible = modifie || Boolean(erreur) || confirmationVisible || enCours;
  const annonce =
    erreur ??
    (modifie
      ? "Modifications non enregistrées"
      : confirmationVisible
        ? messageSucces
        : "");

  return (
    <>
      <p className="sr-only" role="status">
        {annonce}
      </p>
      {/* Au repos (rien à enregistrer) : visible sur ordinateur, masquée sur téléphone pour ne pas cacher le formulaire. */}
      <div
        className={`ad-barre-enregistrement-conteneur${variante === "console" ? " ad-barre-console" : ""}${visible ? "" : " ad-barre-repos"}`}
      >
        <div
          className="ad-barre-enregistrement"
          role="group"
          aria-label="Enregistrement"
        >
          <p
            className={`ad-barre-etat${modifie ? " ad-barre-etat-modifie" : ""}`}
            aria-hidden="true"
          >
            {erreur ? (
              <span className="ad-barre-etat-erreur">{erreur}</span>
            ) : modifie ? (
              "Modifications non enregistrées"
            ) : confirmationVisible ? (
              messageSucces
            ) : (
              "Aucune modification"
            )}
          </p>
          <div className="ad-barre-actions">
            <Button
              type="button"
              variante="secondary"
              disabled={!modifie || enCours}
              onClick={onAnnuler}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!modifie || enCours}>
              {enCours ? "Enregistrement…" : libelle}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
