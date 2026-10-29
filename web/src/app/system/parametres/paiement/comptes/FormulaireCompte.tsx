"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerCompteVersementAction, verifierCompteVersementAction, type EtatActionPaiementAdmin } from "@/lib/system-admin/paiements";
import { Alert, Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

const etatInitial: EtatActionPaiementAdmin = {};

interface Props {
  type: "restaurant" | "livreur";
  id: string;
  nom: string;
  etat: "absent" | "non_verifie" | "verifie";
}

/** Une ligne par bénéficiaire : saisie du compte (le numéro ne s'affiche plus ensuite) et vérification. */
export function FormulaireCompte({ type, id, nom, etat }: Props) {
  const router = useRouter();
  const notifier = useNotification();
  const [retour, action, enCours] = useActionState(enregistrerCompteVersementAction, etatInitial);
  const [verification, demarrer] = useTransition();

  return (
    <form action={action} className="paiement-compte-ligne">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <p className="paiement-compte-nom">
        {nom} <span className="ad-secondaire">· {etat === "verifie" ? "compte vérifié" : etat === "non_verifie" ? "à vérifier" : "aucun compte"}</span>
      </p>
      <div className="paiement-compte-champs">
        <label className="sr-only" htmlFor={`op-${id}`}>
          Opérateur
        </label>
        <select id={`op-${id}`} name="operateur" defaultValue="orange_money">
          <option value="orange_money">Orange Money</option>
          <option value="mtn_momo">MTN MoMo</option>
        </select>
        <label className="sr-only" htmlFor={`num-${id}`}>
          Numéro mobile money
        </label>
        <input id={`num-${id}`} name="numero" inputMode="tel" autoComplete="off" placeholder="Numéro mobile money" required />
        <label className="sr-only" htmlFor={`tit-${id}`}>
          Titulaire du compte
        </label>
        <input id={`tit-${id}`} name="titulaire" autoComplete="off" placeholder="Nom du titulaire" required maxLength={80} />
        <Button type="submit" variante="secondary" disabled={enCours}>
          {etat === "absent" ? "Enregistrer" : "Remplacer"}
        </Button>
        {etat === "non_verifie" ? (
          <Button
            type="button"
            disabled={verification}
            onClick={() =>
              demarrer(async () => {
                const r = await verifierCompteVersementAction(type, id);
                notifier(r.erreur ? "erreur" : "succes", r.erreur ?? r.succes ?? "");
                router.refresh();
              })
            }
          >
            Marquer vérifié
          </Button>
        ) : null}
      </div>
      {retour.erreur ? <Alert ton="danger">{retour.erreur}</Alert> : null}
      {retour.succes ? <Alert ton="info">{retour.succes}</Alert> : null}
    </form>
  );
}
