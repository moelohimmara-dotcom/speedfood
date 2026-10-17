"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  basculerLivreurAction,
  creerLivreurPourCompteAction,
  creerLivreursDemoAction,
  supprimerLivreursDemoAction,
  type EtatActionLivraisonAdmin,
} from "@/lib/system-admin/livraisons";
import { Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

const etatInitial: EtatActionLivraisonAdmin = {};

/** Formulaire « livreur avec un vrai compte » : compte existant lié à une fiche livreur (super administrateur). */
function FormulaireLivreurReel({ onCree }: { onCree: () => void }) {
  const notifier = useNotification();
  const router = useRouter();
  const [etat, action, enCours] = useActionState(creerLivreurPourCompteAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) {
      notifier("succes", etat.succes);
      formulaire.current?.reset();
      router.refresh();
      onCree();
    }
    // `onCree` et `notifier` sont stables pour l'usage ; on ne réagit qu'à un nouveau résultat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="livreurs-formulaire">
      <div className="field">
        <label htmlFor="liv-email">Adresse e-mail du compte</label>
        <input id="liv-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="livreurs-formulaire-ligne">
        <div className="field">
          <label htmlFor="liv-nom">Nom affiché</label>
          <input id="liv-nom" name="nom" required minLength={2} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="liv-tel">Téléphone (facultatif)</label>
          <input id="liv-tel" name="telephone" inputMode="tel" maxLength={20} />
        </div>
      </div>
      {etat.erreur ? (
        <p className="field-error" role="alert">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer le livreur"}
      </Button>
    </form>
  );
}

/** Bouton « Ajouter des livreurs » : une fenêtre avec les deux façons d'en créer, chacune expliquée. */
export function AjouterLivreurs({ peutLierUnCompte }: { peutLierUnCompte: boolean }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();

  function creerDemo() {
    demarrer(async () => {
      const r = await creerLivreursDemoAction();
      if (r.erreur) notifier("erreur", r.erreur);
      else {
        notifier("succes", r.succes ?? "Livreurs créés.");
        dialogue.current?.close();
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" aria-haspopup="dialog" onClick={() => dialogue.current?.showModal()}>
        Ajouter des livreurs
      </Button>
      <dialog ref={dialogue} className="ad-dialogue" aria-labelledby="livreurs-ajout-titre">
        <div className="ad-dialogue-corps">
          <h2 id="livreurs-ajout-titre">Ajouter des livreurs</h2>

          <section className="livreurs-choix" aria-labelledby="livreurs-choix-demo">
            <h3 id="livreurs-choix-demo">Livreurs de démonstration</h3>
            <p className="ad-secondaire">
              3 livreurs simulés, en ligne, placés dans des quartiers de Conakry. Ils répondent seuls aux offres et roulent vers le restaurant
              puis le client : idéal pour essayer la livraison.
            </p>
            <Button type="button" disabled={enCours} onClick={creerDemo}>
              {enCours ? "Création…" : "Créer 3 livreurs de démonstration"}
            </Button>
          </section>

          {peutLierUnCompte ? (
            <section className="livreurs-choix" aria-labelledby="livreurs-choix-reel">
              <h3 id="livreurs-choix-reel">Livreur avec un vrai compte</h3>
              <p className="ad-secondaire">
                Lie un compte existant à une fiche livreur : cette personne ouvre ensuite <strong>/livreur</strong> avec son compte, se met en ligne
                et répond elle-même aux offres. Elle doit d&apos;abord avoir créé son compte.
              </p>
              <FormulaireLivreurReel onCree={() => dialogue.current?.close()} />
            </section>
          ) : null}

          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogue.current?.close()}>
              Fermer
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Supprime les livreurs de démonstration libres, après confirmation. */
export function SupprimerLivreursDemo({ nombre }: { nombre: number }) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  if (nombre === 0) return null;
  return (
    <Button
      type="button"
      variante="secondary"
      disabled={enCours}
      onClick={async () => {
        const reponse = await confirmer({
          titre: "Supprimer les livreurs de démonstration ?",
          message: <p>Seuls ceux qui ne sont pas en course sont supprimés. Les livraisons déjà terminées gardent leur historique.</p>,
          libelleAction: "Supprimer",
          danger: true,
        });
        if (!reponse.confirme) return;
        demarrer(async () => {
          const r = await supprimerLivreursDemoAction();
          notifier(r.erreur ? "erreur" : "succes", r.erreur ?? r.succes ?? "Terminé.");
          router.refresh();
        });
      }}
    >
      Supprimer les livreurs de démonstration
    </Button>
  );
}

/** Mettre un livreur en ligne ou hors ligne. */
export function BoutonLivreur({ livreurId, nom, enLigne }: { livreurId: string; nom: string; enLigne: boolean }) {
  const router = useRouter();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  return (
    <Button
      type="button"
      variante="secondary"
      disabled={enCours}
      aria-label={`${enLigne ? "Mettre hors ligne" : "Mettre en ligne"} ${nom}`}
      onClick={() =>
        demarrer(async () => {
          const r = await basculerLivreurAction(livreurId, !enLigne);
          if (r.erreur) notifier("erreur", r.erreur);
          router.refresh();
        })
      }
    >
      {enLigne ? "Mettre hors ligne" : "Mettre en ligne"}
    </Button>
  );
}
