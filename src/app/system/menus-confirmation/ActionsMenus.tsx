"use client";

import { useActionState, useState } from "react";
import {
  confirmerMenuDuJourAction,
  rappelerMenuAction,
  type EtatActionMenu,
} from "@/lib/system-admin/menus-confirmation-actions";
import { Button, Alert } from "@/components/ui";
import { ListeChoix } from "@/components/ui/ListeChoix";

/**
 * Lot L5 — actions de la liste des menus à reconfirmer.
 *
 * Deux gestes, tous deux réservés au rôle « Opérations » et « Super administrateur » (le serveur
 * revérifie la permission à chaque appel ; l'écran ne fait que masquer ce qui est refusé).
 */

export interface LigneActionMenu {
  restaurantId: string;
  nom: string;
  quartier: string;
  /** Numéro interne à joindre (jamais public) : l'équipe appelle, elle ne devine pas. */
  telephoneCommandes: string | null;
  /** Nombre de plats à reconfirmer. */
  platsAConfirmer: number;
  /** L'établissement a-t-il au moins un plat actif ? */
  aDesPlats: boolean;
}

const ETAT_INITIAL: EtatActionMenu = {};

export function ActionsMenus({ lignes, peutAgir }: { lignes: LigneActionMenu[]; peutAgir: boolean }) {
  const [etatConfirmation, actionConfirmation, confirmationEnCours] = useActionState(
    confirmerMenuDuJourAction,
    ETAT_INITIAL
  );
  const [etatRappel, actionRappel, rappelEnCours] = useActionState(rappelerMenuAction, ETAT_INITIAL);
  // Le canal du rappel est choisi par établissement : il part avec le formulaire.
  const [canaux, setCanaux] = useState<Record<string, string>>({});

  if (!peutAgir) {
    return (
      <p className="ad-aide-champ">
        Votre rôle système permet de consulter cette liste, mais pas de confirmer un menu ni d&apos;envoyer un rappel.
      </p>
    );
  }

  return (
    <>
      {etatConfirmation.succes ? <Alert ton="succes">{etatConfirmation.succes}</Alert> : null}
      {etatConfirmation.erreur ? <Alert ton="danger">{etatConfirmation.erreur}</Alert> : null}
      {etatRappel.succes ? <Alert ton="succes">{etatRappel.succes}</Alert> : null}
      {etatRappel.erreur ? <Alert ton="danger">{etatRappel.erreur}</Alert> : null}

      <ul className="ad-liste ad-liste-simple">
        {lignes.map((ligne) => (
          <li key={ligne.restaurantId} className="ad-case-ligne">
            <div>
              <p className="ad-liste-titre">{ligne.nom}</p>
              <p className="ad-liste-meta">
                {ligne.quartier || "Quartier non renseigné"}
                {ligne.telephoneCommandes ? ` · ${ligne.telephoneCommandes}` : " · aucun numéro à joindre"}
              </p>
            </div>
            <div className="ad-actions-ligne">
              <form action={actionConfirmation}>
                <input type="hidden" name="restaurant_id" value={ligne.restaurantId} />
                <Button type="submit" variante="secondary" disabled={confirmationEnCours || !ligne.aDesPlats}>
                  {confirmationEnCours ? "Confirmation…" : "Confirmer le menu"}
                </Button>
              </form>
              <form action={actionRappel} className="ad-actions-ligne">
                <input type="hidden" name="restaurant_id" value={ligne.restaurantId} />
                <ListeChoix
                  nom="canal"
                  options={[
                    { valeur: "interne", libelle: "Notification interne" },
                    { valeur: "appel", libelle: "Appel téléphonique" },
                  ]}
                  valeur={canaux[ligne.restaurantId] ?? "interne"}
                  onChange={(valeur) => setCanaux((actuels) => ({ ...actuels, [ligne.restaurantId]: valeur }))}
                  placeholder="Canal du rappel"
                  libelleAccessible={`Canal du rappel pour ${ligne.nom}`}
                />
                <Button type="submit" variante="secondary" disabled={rappelEnCours}>
                  {rappelEnCours ? "Rappel…" : "Rappeler"}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
