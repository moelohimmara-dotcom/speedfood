"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { supprimerComptesAction, type EtatSuppressionCompte } from "@/lib/system-admin/suppression-compte";
import { Alert, Button } from "@/components/ui";
import { IconeAdmin } from "@/components/admin/icones";

const SELECTEUR = 'input[type="checkbox"][data-selection-comptes]';
const ID_FORMULAIRE = "suppression-groupee";
const etatInitial: EtatSuppressionCompte = {};

function cochees(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`${SELECTEUR}:checked`));
}

/** Case de l'en-tête de colonne : coche ou décoche tous les comptes sélectionnables de la page. */
export function CaseToutSelectionner() {
  return (
    <label className="ad-case-ligne" style={{ margin: "-12px 0 -12px -16px" }}>
      <input
        type="checkbox"
        aria-label="Sélectionner tous les comptes de la page"
        onChange={(evenement) => {
          for (const case_ of document.querySelectorAll<HTMLInputElement>(SELECTEUR)) {
            case_.checked = evenement.target.checked;
          }
          document.dispatchEvent(new Event("selection-comptes"));
        }}
      />
    </label>
  );
}

/** Case d'un compte (liée au formulaire de suppression groupée par l'attribut `form`). */
export function CaseCompte({ utilisateurId, email }: { utilisateurId: string; email: string }) {
  return (
    <label className="ad-case-ligne">
      <input
        type="checkbox"
        name="utilisateur_id"
        value={utilisateurId}
        form={ID_FORMULAIRE}
        data-selection-comptes=""
        aria-label={`Sélectionner ${email}`}
        onChange={() => document.dispatchEvent(new Event("selection-comptes"))}
      />
    </label>
  );
}

/**
 * Barre de suppression groupée : affiche le nombre de comptes cochés et ouvre une fenêtre de confirmation (motif
 * obligatoire, mot « SUPPRIMER » à retaper). Irréversible ; les garde-fous (jamais soi-même, jamais un super
 * administrateur, restaurants avec commandes conservés) sont appliqués par le serveur compte par compte.
 */
export function BarreSelectionGroupee() {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState(0);
  // Valeurs contrôlées : après une erreur, React réinitialise un formulaire non contrôlé et le motif saisi serait perdu.
  const [motif, setMotif] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [etat, action] = useActionState(supprimerComptesAction, etatInitial);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    const maj = () => setNombre(cochees().length);
    document.addEventListener("selection-comptes", maj);
    return () => document.removeEventListener("selection-comptes", maj);
  }, []);

  return (
    <div className="ad-barre-selection" data-vide={nombre === 0} role="region" aria-label="Suppression groupée">
      <p style={{ margin: 0 }} role="status">
        <strong>{nombre}</strong> compte{nombre > 1 ? "s" : ""} sélectionné{nombre > 1 ? "s" : ""}
      </p>
      <button
        type="button"
        className="btn btn-danger ad-action-discrete"
        disabled={nombre === 0}
        aria-haspopup="dialog"
        onClick={() => dialogue.current?.showModal()}
      >
        <IconeAdmin nom="corbeille" taille={18} />
        Supprimer la sélection
      </button>

      <dialog ref={dialogue} className="ad-dialogue" aria-labelledby="suppression-groupee-titre">
        <form
          id={ID_FORMULAIRE}
          className="ad-dialogue-corps"
          // Envoi manuel plutôt que `action={...}` : après une erreur, React réinitialiserait le formulaire ET les cases de
          // sélection qui lui sont liées par l'attribut `form` (la sélection serait perdue sans que le compteur le sache).
          onSubmit={(evenement) => {
            evenement.preventDefault();
            const donnees = new FormData(evenement.currentTarget);
            demarrer(() => action(donnees));
          }}
        >
          <h2 id="suppression-groupee-titre">
            Supprimer {nombre} compte{nombre > 1 ? "s" : ""} ?
          </h2>
          <Alert ton="danger">
            <strong>Suppression définitive.</strong> Les comptes cochés disparaissent et ne peuvent pas être récupérés. Un compte
            propre au vôtre ou super administrateur est refusé automatiquement. L&apos;historique d&apos;audit est conservé, sans lien
            vers les comptes.
          </Alert>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.9rem" }}>
            <input type="checkbox" name="supprimer_restaurants" style={{ marginTop: 3 }} />
            <span>
              Supprimer aussi leurs restaurants <strong>s&apos;ils n&apos;ont aucun autre membre et aucune commande</strong> (menus et
              plats inclus). Un restaurant qui a des commandes n&apos;est jamais supprimé.
            </span>
          </label>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="motif-groupe">Motif (obligatoire, ex. « comptes de test »)</label>
            <input id="motif-groupe" name="motif" type="text" maxLength={500} required value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="confirmation-groupe">
              Pour confirmer, tapez <strong>SUPPRIMER</strong>
            </label>
            <input
              id="confirmation-groupe"
              name="confirmation"
              type="text"
              autoComplete="off"
              placeholder="SUPPRIMER"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogue.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" variante="danger" disabled={enCours || nombre === 0} style={{ borderColor: "var(--danger)" }}>
              {enCours ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
