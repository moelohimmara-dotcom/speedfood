"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rembourserALaMainAction, reprendreVersementsAction, trancherLitigeAction, type EtatActionPaiementAdmin } from "@/lib/system-admin/paiements";
import { LIBELLE_MOYEN, MOYENS_REMBOURSEMENT } from "@/lib/paiement/en-ligne/remboursement-manuel";
import { Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

interface Props {
  paiementId: string;
  etat: string;
  versementsEnAttente: boolean;
  litigeAHumain: string | null;
  /** Les espèces (dernier recours) sont réservées au propriétaire : sans ce droit, le choix n'est pas proposé. */
  peutEspeces: boolean;
}

/** Actions d'une ligne de paiement : reprendre des versements, ou trancher un litige confié à un humain (motif obligatoire). */
export function ActionsPaiement({ paiementId, etat, versementsEnAttente, litigeAHumain, peutEspeces }: Props) {
  const router = useRouter();
  const notifier = useNotification();
  const [motif, setMotif] = useState("");
  const [remboursementOuvert, setRemboursementOuvert] = useState(false);
  const [moyen, setMoyen] = useState<string>("orange_money");
  const [reference, setReference] = useState("");
  const [recuPar, setRecuPar] = useState("");
  const [enCours, demarrer] = useTransition();

  function lancer(travail: () => Promise<EtatActionPaiementAdmin>) {
    demarrer(async () => {
      const r = await travail();
      if (r.erreur) notifier("erreur", r.erreur);
      else if (r.succes) {
        notifier("succes", r.succes);
        setMotif("");
        setReference("");
        setRecuPar("");
        setRemboursementOuvert(false);
      }
      router.refresh();
    });
  }

  const rien = !(etat === "libere" && versementsEnAttente) && !litigeAHumain;
  if (rien) return <span className="ad-secondaire">—</span>;

  return (
    <div className="paiement-admin-actions">
      {etat === "libere" && versementsEnAttente ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => reprendreVersementsAction(paiementId))}>
          Reprendre les versements
        </Button>
      ) : null}
      {litigeAHumain ? (
        <>
          <label className="sr-only" htmlFor={`motif-${litigeAHumain}`}>
            Motif de la décision
          </label>
          <input id={`motif-${litigeAHumain}`} type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de la décision" maxLength={300} />
          <div className="paiement-admin-boutons">
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => trancherLitigeAction(paiementId, litigeAHumain, "rembourser", motif))}>
              Rembourser le client
            </Button>
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => setRemboursementOuvert((ouvert) => !ouvert)} aria-expanded={remboursementOuvert}>
              Remboursé à la main
            </Button>
            <Button type="button" disabled={enCours} onClick={() => lancer(() => trancherLitigeAction(paiementId, litigeAHumain, "liberer", motif))}>
              Libérer l&apos;argent
            </Button>
          </div>
          {remboursementOuvert ? (
            <fieldset className="paiement-admin-remboursement">
              <legend>Comment le client a-t-il été remboursé ?</legend>
              <label htmlFor={`moyen-${litigeAHumain}`}>Moyen</label>
              <select id={`moyen-${litigeAHumain}`} value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                {MOYENS_REMBOURSEMENT.filter((m) => m !== "especes" || peutEspeces).map((m) => (
                  <option key={m} value={m}>
                    {LIBELLE_MOYEN[m]}
                  </option>
                ))}
              </select>
              <label htmlFor={`reference-${litigeAHumain}`}>{moyen === "especes" ? "Numéro du reçu signé (conseillé)" : "Référence de la transaction"}</label>
              <input id={`reference-${litigeAHumain}`} type="text" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} autoComplete="off" />
              {moyen === "especes" ? (
                <>
                  <label htmlFor={`recu-${litigeAHumain}`}>Nom de la personne qui a reçu l&apos;argent</label>
                  <input id={`recu-${litigeAHumain}`} type="text" value={recuPar} onChange={(e) => setRecuPar(e.target.value)} maxLength={80} autoComplete="off" />
                  <p className="ad-secondaire">Dernier recours : dans le motif ci-dessus, expliquez pourquoi un remboursement par mobile money était impossible.</p>
                </>
              ) : null}
              <Button type="button" disabled={enCours} onClick={() => lancer(() => rembourserALaMainAction(paiementId, litigeAHumain, { moyen, reference, recuPar, motif }))}>
                Enregistrer le remboursement
              </Button>
            </fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
