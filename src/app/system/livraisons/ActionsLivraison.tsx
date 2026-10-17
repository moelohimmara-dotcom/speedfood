"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignerLivraisonAction, avancerLivraisonAdminAction, relancerRepartitionAction, type EtatActionLivraisonAdmin } from "@/lib/system-admin/livraisons";
import { estFinal, type ModeLivraison, type StatutLivraison } from "@/lib/livraison/statuts";
import { Button } from "@/components/ui";
import { useConfirmation } from "@/components/console/ConsoleProviders";

interface Props {
  livraison: { id: string; mode: ModeLivraison; statut: StatutLivraison; commandeReference: string };
  disponibles: { id: string; nom: string }[];
}

/** Boutons d'une ligne de livraison : affecter, relancer, faire avancer à la place du livreur, annuler. */
export function ActionsLivraison({ livraison, disponibles }: Props) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const [message, setMessage] = useState<EtatActionLivraisonAdmin | null>(null);
  const [choix, setChoix] = useState("");
  const [enCours, demarrer] = useTransition();

  if (estFinal(livraison.statut)) return <span className="ad-secondaire">—</span>;

  function lancer(travail: () => Promise<EtatActionLivraisonAdmin>) {
    setMessage(null);
    demarrer(async () => {
      const r = await travail();
      setMessage(r);
      router.refresh();
    });
  }

  const enRecherche = livraison.mode === "speedfood" && (livraison.statut === "a_assigner" || livraison.statut === "offre_envoyee");
  const suivante: Partial<Record<StatutLivraison, { vers: StatutLivraison; libelle: string }>> = livraison.mode === "speedfood"
    ? {
        assignee: { vers: "vers_restaurant", libelle: "Le livreur part au restaurant" },
        vers_restaurant: { vers: "recuperee", libelle: "Commande récupérée" },
        recuperee: { vers: "vers_client", libelle: "Parti chez le client" },
        vers_client: { vers: "livree", libelle: "Marquer livrée" },
      }
    : { assignee: { vers: "vers_client", libelle: "Parti livrer" }, vers_client: { vers: "livree", libelle: "Marquer livrée" } };
  const etape = suivante[livraison.statut];

  return (
    <div className="livraison-actions">
      {enRecherche ? (
        <>
          <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => relancerRepartitionAction(livraison.id))}>
            Relancer la recherche
          </Button>
          {disponibles.length > 0 ? (
            <span className="livraison-actions-groupe">
              <select aria-label={`Livreur pour la commande ${livraison.commandeReference}`} value={choix} onChange={(e) => setChoix(e.target.value)}>
                <option value="">Choisir un livreur</option>
                {disponibles.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
              <Button type="button" disabled={enCours || choix === ""} onClick={() => lancer(() => assignerLivraisonAction(livraison.id, choix))}>
                Affecter
              </Button>
            </span>
          ) : null}
        </>
      ) : null}
      {etape ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => avancerLivraisonAdminAction(livraison.id, etape.vers))}>
          {etape.libelle}
        </Button>
      ) : null}
      <Button
        type="button"
        variante="secondary"
        disabled={enCours}
        onClick={async () => {
          const reponse = await confirmer({
            titre: `Annuler la livraison de ${livraison.commandeReference} ?`,
            message: <p>Le livreur éventuel est libéré. La commande elle-même n&apos;est pas annulée.</p>,
            libelleAction: "Annuler la livraison",
            danger: true,
            niveau: "motif",
            libelleMotif: "Pourquoi annuler cette livraison ?",
          });
          if (reponse.confirme) lancer(() => avancerLivraisonAdminAction(livraison.id, "annulee", reponse.motif));
        }}
      >
        Annuler
      </Button>
      {message?.erreur ? <p className="field-error">{message.erreur}</p> : null}
      {message?.succes ? <p className="ad-secondaire" role="status">{message.succes}</p> : null}
    </div>
  );
}
