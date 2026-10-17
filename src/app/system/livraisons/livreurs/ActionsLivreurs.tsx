"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { basculerLivreurAction, creerLivreurPourCompteAction, creerLivreursDemoAction, supprimerLivreursDemoAction, type EtatActionLivraisonAdmin } from "@/lib/system-admin/livraisons";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatActionLivraisonAdmin = {};

/** Lier un compte existant à une fiche livreur (super administrateur). */
function FormulaireLivreurReel() {
  const [etat, action, enCours] = useActionState(creerLivreurPourCompteAction, etatInitial);
  return (
    <form action={action} className="livraison-formulaire-livreur">
      <h2 className="ad-sous-titre">Créer un livreur avec un vrai compte</h2>
      <div className="field">
        <label htmlFor="liv-email">Adresse e-mail du compte</label>
        <input id="liv-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="liv-nom">Nom affiché</label>
        <input id="liv-nom" name="nom" required minLength={2} maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="liv-tel">Téléphone (facultatif)</label>
        <input id="liv-tel" name="telephone" inputMode="tel" maxLength={20} />
      </div>
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer le livreur"}
      </Button>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <p className="ad-secondaire" role="status">{etat.succes}</p> : null}
    </form>
  );
}

/** Création et suppression des livreurs de démonstration, et liaison d'un compte réel. */
export function ActionsLivreurs({ nombreSimules, peutLierUnCompte = false }: { nombreSimules: number; peutLierUnCompte?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<EtatActionLivraisonAdmin | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(travail: () => Promise<EtatActionLivraisonAdmin>) {
    setMessage(null);
    demarrer(async () => {
      setMessage(await travail());
      router.refresh();
    });
  }

  return (
    <div className="livraison-actions" style={{ marginBottom: "var(--space-4)" }}>
      <Button type="button" disabled={enCours} onClick={() => lancer(creerLivreursDemoAction)}>
        Créer 3 livreurs de démonstration
      </Button>
      {nombreSimules > 0 ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(supprimerLivreursDemoAction)}>
          Supprimer les livreurs de démonstration libres
        </Button>
      ) : null}
      {message?.erreur ? <Alert ton="danger">{message.erreur}</Alert> : null}
      {message?.succes ? <p className="ad-secondaire" role="status">{message.succes}</p> : null}
      {peutLierUnCompte ? <FormulaireLivreurReel /> : null}
    </div>
  );
}

/** Mettre un livreur en ligne ou hors ligne. */
export function BoutonLivreur({ livreurId, nom, enLigne }: { livreurId: string; nom: string; enLigne: boolean }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Button
        type="button"
        variante="secondary"
        disabled={enCours}
        aria-label={`${enLigne ? "Mettre hors ligne" : "Mettre en ligne"} ${nom}`}
        onClick={() =>
          demarrer(async () => {
            const r = await basculerLivreurAction(livreurId, !enLigne);
            setErreur(r.erreur ?? null);
            router.refresh();
          })
        }
      >
        {enLigne ? "Mettre hors ligne" : "Mettre en ligne"}
      </Button>
      {erreur ? <p className="field-error">{erreur}</p> : null}
    </>
  );
}
