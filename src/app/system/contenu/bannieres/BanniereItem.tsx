"use client";

import { useState, useTransition } from "react";
import {
  basculerPublicationBanniereAction,
  supprimerBanniereAction,
  type Banniere,
} from "@/lib/system-admin/contenus";
import { Card, Badge, Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

/** `indisponible` : explication d'un palier insuffisant pour publier/dépublier/supprimer (le serveur refuse de toute façon). */
export function BanniereItem({ banniere, indisponible }: { banniere: Banniere; indisponible?: string }) {
  const [enTransition, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const confirmer = useConfirmation();
  const notifier = useNotification();
  const publie = banniere.statut === "publie";

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {banniere.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img
            src={banniere.image_url}
            alt=""
            style={{ width: 96, height: 54, objectFit: "cover", borderRadius: "var(--radius-md)", flexShrink: 0 }}
          />
        ) : null}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{banniere.titre}</strong>
            <Badge ton={publie ? "succes" : "neutre"}>{publie ? "Publiée" : "Brouillon"}</Badge>
          </div>
          {banniere.texte ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>{banniere.texte}</p>
          ) : null}
          {indisponible ? (
            <p className="ad-palier-note" id={`banniere-${banniere.id}-limite`}>
              {indisponible}
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Button
          type="button"
          variante="secondary"
          disabled={enTransition || Boolean(indisponible)}
          aria-describedby={indisponible ? `banniere-${banniere.id}-limite` : undefined}
          onClick={() =>
            demarrerTransition(async () => {
              const retour = await basculerPublicationBanniereAction(banniere.id, !publie);
              setErreur(retour.erreur ?? null);
            })
          }
        >
          {publie ? "Dépublier" : "Publier"}
        </Button>
        <Button
          type="button"
          variante="danger"
          className="ad-action-discrete"
          disabled={enTransition || Boolean(indisponible)}
          aria-describedby={indisponible ? `banniere-${banniere.id}-limite` : undefined}
          onClick={async () => {
            const reponse = await confirmer({ titre: `Supprimer la bannière « ${banniere.titre} » ?`, libelleAction: "Supprimer", danger: true });
            if (!reponse.confirme) return;
            demarrerTransition(async () => {
              const retour = await supprimerBanniereAction(banniere.id);
              setErreur(retour.erreur ?? null);
              if (!retour.erreur) notifier("succes", `La bannière « ${banniere.titre} » a été supprimée.`);
            });
          }}
        >
          Supprimer
        </Button>
      </div>
      {erreur ? (
        <p role="alert" className="ad-action-erreur">
          {erreur}
        </p>
      ) : null}
    </Card>
  );
}
