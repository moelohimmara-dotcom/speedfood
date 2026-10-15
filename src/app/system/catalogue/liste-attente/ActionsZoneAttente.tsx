"use client";

import { useActionState, useRef } from "react";
import { Alert, Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";
import { marquerZonePrevenueAction, supprimerContactsZoneAction, type EtatAttente } from "@/lib/system-admin/liste-attente";

const etatInitial: EtatAttente = {};

/**
 * Actions sur une zone de la liste d'attente : export (lien), marquer comme prévenues, supprimer les contacts. La suppression est
 * irréversible : elle demande une confirmation qui dit combien de personnes n'ont pas encore été prévenues, et chaque action affiche son résultat.
 */
export function ActionsZoneAttente({ niveau, id, nom, personnes, prevenues }: { niveau: string; id: string; nom: string; personnes: number; prevenues: number }) {
  const [etatPrevenue, actionPrevenue, prevenueEnCours] = useActionState(marquerZonePrevenueAction, etatInitial);
  const [etatSuppression, actionSuppression, suppressionEnCours] = useActionState(supprimerContactsZoneAction, etatInitial);
  const nonPrevenues = personnes - prevenues;
  const confirmer = useConfirmation();
  const dejaConfirme = useRef(false);

  async function confirmerSuppression(e: React.FormEvent<HTMLFormElement>) {
    // Confirmé une fois : l'envoi est rejoué par requestSubmit et passe sans nouvelle question.
    if (dejaConfirme.current) {
      dejaConfirme.current = false;
      return;
    }
    e.preventDefault();
    const formulaire = e.currentTarget;
    const avertissement =
      nonPrevenues > 0 ? ` ${nonPrevenues} personne${nonPrevenues > 1 ? "s n'ont" : " n'a"} pas encore été prévenue${nonPrevenues > 1 ? "s" : ""} : exportez leurs contacts d'abord.` : "";
    const reponse = await confirmer({
      titre: `Supprimer définitivement les ${personnes} contact${personnes > 1 ? "s" : ""} de ${nom} ?`,
      message: <p>Cette action est irréversible.{avertissement}</p>,
      libelleAction: "Supprimer les contacts",
      danger: true,
    });
    if (!reponse.confirme) return;
    dejaConfirme.current = true;
    formulaire.requestSubmit();
  }

  return (
    <div className="attente-actions">
      <div className="ad-actions-ligne">
        <a className="btn btn-secondary" href={`/system/catalogue/liste-attente/export?niveau=${niveau}&id=${id}`}>
          Exporter (CSV)<span className="sr-only"> {nom}</span>
        </a>
        <form action={actionPrevenue}>
          <input type="hidden" name="niveau" value={niveau} />
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variante="secondary" disabled={prevenueEnCours || nonPrevenues === 0}>
            Marquer comme prévenues<span className="sr-only"> {nom}</span>
          </Button>
        </form>
        <form action={actionSuppression} onSubmit={confirmerSuppression}>
          <input type="hidden" name="niveau" value={niveau} />
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variante="danger" disabled={suppressionEnCours}>
            Supprimer les contacts<span className="sr-only"> {nom}</span>
          </Button>
        </form>
      </div>
      <div role="status" aria-live="polite">
        {etatPrevenue.succes ? <Alert ton="succes">{etatPrevenue.succes}</Alert> : null}
        {etatSuppression.succes ? <Alert ton="succes">{etatSuppression.succes}</Alert> : null}
      </div>
      {etatPrevenue.erreur ? <Alert ton="danger">{etatPrevenue.erreur}</Alert> : null}
      {etatSuppression.erreur ? <Alert ton="danger">{etatSuppression.erreur}</Alert> : null}
    </div>
  );
}
