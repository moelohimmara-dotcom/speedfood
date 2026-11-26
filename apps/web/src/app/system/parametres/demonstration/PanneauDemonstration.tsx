"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  changerVisibiliteDemonstrationAction,
  supprimerDemonstrationAction,
  type EtatDemonstration,
  type ResultatDemonstration,
} from "@/lib/system-admin/demonstration";
import { PHRASE_SUPPRESSION_DEMO } from "@/lib/system-admin/demonstrationRegles";
import { Alert, Button } from "@/components/ui";
import { Panneau } from "@/components/admin/blocs";

const etatInitial: ResultatDemonstration = {};

export function PanneauDemonstration({ etat, sessionRenforcee, mfaActive }: { etat: EtatDemonstration; sessionRenforcee: boolean; mfaActive: boolean }) {
  const [retour, setRetour] = useState<ResultatDemonstration | null>(null);
  const [enCours, demarrer] = useTransition();
  const [suppression, action, supprEnCours] = useActionState(supprimerDemonstrationAction, etatInitial);
  const vide = etat.restaurants === 0;

  return (
    <div className="u-d-grid-g-s5">
      <Panneau titre="État actuel">
        {vide ? (
          <p className="u-mt-0">Aucun contenu de démonstration n&apos;est chargé.</p>
        ) : (
          <ul className="u-mt-0">
            <li><strong>{etat.restaurants}</strong> restaurants dont <strong>{etat.visibles}</strong> visibles du public</li>
            <li><strong>{etat.plats}</strong> plats, <strong>{etat.avis}</strong> avis, <strong>{etat.commandes}</strong> commandes d&apos;historique, <strong>{etat.livreurs}</strong> livreurs</li>
          </ul>
        )}
        {!vide ? (
          <div className="u-d-flex-g-s3">
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => demarrer(async () => setRetour(await changerVisibiliteDemonstrationAction(true)))}>
              Réafficher au public
            </Button>
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => demarrer(async () => setRetour(await changerVisibiliteDemonstrationAction(false)))}>
              Masquer au public
            </Button>
          </div>
        ) : null}
        {retour?.erreur ? <Alert ton="danger">{retour.erreur}</Alert> : null}
        {retour?.succes ? <Alert ton="succes">{retour.succes}</Alert> : null}
      </Panneau>

      {!vide ? (
        <Panneau titre="Supprimer toute la démonstration">
          {suppression.succes ? (
            <Alert ton="succes">{suppression.succes}</Alert>
          ) : !mfaActive ? (
            <p className="u-mt-0">
              Pour votre sécurité, la suppression exige la double authentification. <Link href="/compte/securite" className="lien-texte">L&apos;activer</Link>
            </p>
          ) : !sessionRenforcee ? (
            <p className="u-mt-0">Déconnectez-vous puis reconnectez-vous avec le code de votre application : la session doit être renforcée.</p>
          ) : (
            <form action={action} className="ad-reinit-form">
              <Alert ton="danger">
                Supprime définitivement les faux restaurants, plats, avis, commandes d&apos;historique et livreurs. Les vrais restaurants et les vraies commandes ne sont pas touchés. Action enregistrée dans le journal d&apos;audit.
              </Alert>
              <div className="field">
                <label htmlFor="motif-demo">Pourquoi ? (10 caractères au moins)</label>
                <textarea id="motif-demo" name="motif" rows={2} maxLength={500} required />
              </div>
              <div className="field">
                <label htmlFor="phrase-demo">
                  Recopiez exactement : <strong>{PHRASE_SUPPRESSION_DEMO}</strong>
                </label>
                <input id="phrase-demo" name="phrase" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
              </div>
              {suppression.erreur ? <Alert ton="danger">{suppression.erreur}</Alert> : null}
              <Button type="submit" variante="danger" disabled={supprEnCours}>
                {supprEnCours ? "Suppression en cours…" : "Supprimer la démonstration"}
              </Button>
            </form>
          )}
        </Panneau>
      ) : null}
    </div>
  );
}
