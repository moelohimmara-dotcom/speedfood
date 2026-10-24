"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  libererEtablissementAction,
  prendreEtablissementAction,
  relancerCommandeAction,
  type EtatQuart,
} from "@/lib/system-admin/quarts-actions";
import { libelleRoleOperateur, type EtatEtablissement, type OperateurQuart } from "@/lib/system-admin/quarts-regles";

/**
 * Actions de l'écran « Quarts et affectation » (boutons et messages).
 *
 * Une seule forme par établissement : le choix de l'opérateur est posé une fois, et le bouton
 * « Je prends » vit SUR LA COMMANDE (c'est la commande qui montre pourquoi l'établissement est
 * repris). Le message de résultat est donc rattaché à l'établissement, pas repeté sur chaque
 * commande. Les messages d'erreur sont rédigés pour l'utilisateur (jamais un message technique
 * de la base).
 */

const ETAT_INITIAL: EtatQuart = {};

/** Une commande affichée dans la forme de l'établissement (textes déjà calculés côté serveur). */
export interface CommandeAffichee {
  id: string;
  reference: string;
  /** Ancienneté lisible (« il y a 3 min »), calculée côté serveur. */
  attente: string;
  statut: string;
  mode: string;
}

/**
 * Prise en charge d'un établissement (« je prends ») ou libération (« je libère »).
 *
 * Un établissement non pris se prend ; un établissement tenu se libère. Le sélecteur d'opérateur
 * n'apparaît que s'il y a plus d'un membre de l'équipe : par défaut, l'opérateur connecté prend
 * pour lui-même.
 */
export function ActionsEtablissement({
  restaurantId,
  etat,
  operateurId,
  moiId,
  operateurs,
  commandes,
}: {
  restaurantId: string;
  etat: EtatEtablissement;
  /** Titulaire actuel de l'établissement (l'opérateur connecté pour une prise). */
  operateurId: string;
  moiId: string;
  operateurs: OperateurQuart[];
  commandes: CommandeAffichee[];
}) {
  const [etatPrise, actionPrise, enCoursPrise] = useActionState(prendreEtablissementAction, ETAT_INITIAL);
  const [etatLiberation, actionLiberation, enCoursLiberation] = useActionState(libererEtablissementAction, ETAT_INITIAL);

  const prise = etat === "non_pris";
  const action = prise ? actionPrise : actionLiberation;
  const message = prise ? etatPrise : etatLiberation;
  const enCours = prise ? enCoursPrise : enCoursLiberation;
  const libelleBouton =
    etat === "non_pris" ? "Je prends" : etat === "a_moi" ? "Je libère" : "Libérer (déblocage)";
  const variante = etat === "non_pris" ? "btn-primary" : "btn-secondary";
  const identifiantSelect = `operateur-${restaurantId}`;

  return (
    <form action={action} className="ad-liste">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      {prise ? (
        operateurs.length > 1 ? (
          <>
            <label htmlFor={identifiantSelect} className="ad-aide-champ">
              Opérateur
            </label>
            <select id={identifiantSelect} name="operateur_id" defaultValue={moiId}>
              {operateurs.map((operateur) => (
                <option key={operateur.utilisateurId} value={operateur.utilisateurId}>
                  {operateur.utilisateurId === moiId
                    ? "Moi-même"
                    : `${operateur.email || "Sans e-mail"} · ${libelleRoleOperateur(operateur.role)}`}
                </option>
              ))}
            </select>
          </>
        ) : (
          <input type="hidden" name="operateur_id" value={moiId} />
        )
      ) : (
        <input type="hidden" name="operateur_id" value={operateurId} />
      )}

      {commandes.length === 0 ? (
        <div className="ad-actions-ligne">
          <button type="submit" className={`btn ${variante} btn-compact`} disabled={enCours}>
            {enCours ? "En cours…" : libelleBouton}
          </button>
        </div>
      ) : (
        <ul className="ad-liste">
          {commandes.map((commande) => (
            <li key={commande.id} className="ad-liste">
              <span className="ad-liste-titre">{commande.reference}</span>
              <span className="ad-liste-meta">
                reçue {commande.attente} · {commande.statut} · {commande.mode}
              </span>
              <div className="ad-actions-ligne">
                <button
                  type="submit"
                  name="commande_id"
                  value={commande.id}
                  className={`btn ${variante} btn-compact`}
                  disabled={enCours}
                >
                  {enCours ? "En cours…" : libelleBouton}
                </button>
                <Link href={`/system/commandes/${commande.id}`} className="lien-texte">
                  Détail de la commande
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MessageAction etat={message} />
    </form>
  );
}

/** Relance d'une commande qui attend depuis plus longtemps que le délai de relance. */
export function RelanceCommande({ commandeId, reference }: { commandeId: string; reference: string }) {
  const [etat, action, enCours] = useActionState(relancerCommandeAction, ETAT_INITIAL);

  return (
    <form action={action} className="ad-actions-ligne">
      <input type="hidden" name="commande_id" value={commandeId} />
      <input type="hidden" name="motif" value={`Relance de ${reference}`} />
      <button type="submit" className="btn btn-secondary btn-compact" disabled={enCours}>
        {enCours ? "Relance…" : "Relancer"}
      </button>
      <MessageAction etat={etat} />
    </form>
  );
}

/** Message de résultat d'une action : succès ou refus, toujours dans la langue de l'utilisateur. */
function MessageAction({ etat }: { etat: EtatQuart }) {
  if (etat.erreur) {
    return (
      <span className="alerte alerte-danger" role="alert">
        {etat.erreur}
      </span>
    );
  }
  if (etat.succes) {
    return (
      <span className="alerte alerte-succes" role="status">
        {etat.succes}
      </span>
    );
  }
  return null;
}
