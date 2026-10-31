import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { calculerAlertes, listerSignalementsEnAttente } from "@/lib/notation/gestion";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../SousNav";
import { ActionsModeration } from "./ActionsModeration";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Avis (administration)" };
export const dynamic = "force-dynamic";

const LIBELLES_ALERTE = {
  restaurant_sous_seuil: "Restaurant sous 3,5 sur 5",
  livreur_sous_seuil: "Livreur sous 3,5 sur 5",
  livreur_trois_mauvaises: "Livreur : trois mauvaises notes de suite",
} as const;

/** Modération des avis publics (signalements) et alertes de qualité. Permission `commande.support`. */
export default async function AvisAdminPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const [signalements, alertes] = await Promise.all([listerSignalementsEnAttente().catch(() => []), calculerAlertes().catch(() => [])]);

  return (
    <div>
      <PageHeader titre="Avis" description="Les avis sont publiés tout de suite et modérés après coup : examinez les signalements, masquez un commentaire ou annulez une note, toujours avec un motif." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      <Panneau titre={`Signalements à examiner (${signalements.length})`}>
        {signalements.length === 0 ? (
          <EtatVide icone="etoile" titre="Aucun signalement" texte="Quand un client ou un restaurant signale un avis, il apparaît ici." />
        ) : (
          <ul className="notation-avis-liste">
            {signalements.map((s) => (
              <li key={s.id} className="notation-avis-item">
                <p className="notation-avis-entete">
                  <strong>{s.restaurantNom}</strong> · {s.note} sur 5 · signalé le {new Date(s.date).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                  {s.statutAvis !== "publie" ? <span className="notation-pastille">{s.statutAvis === "annule" ? "Note annulée" : "Commentaire masqué"}</span> : null}
                </p>
                <p className="notation-avis-texte">{s.commentaire ?? "(pas de commentaire)"}</p>
                <p className="notation-aide">Motif du signalement : {s.motif}</p>
                <ActionsModeration avisId={s.avisId} statut={s.statutAvis} />
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre={`Alertes de qualité (${alertes.length})`}>
        {alertes.length === 0 ? (
          <EtatVide icone="coche" titre="Aucune alerte" texte="Un restaurant ou un livreur apparaît ici sous 3,5 sur 5 avec 5 notes au moins." />
        ) : (
          <ul className="notation-avis-liste">
            {alertes.map((a, i) => (
              <li key={i} className="notation-avis-item">
                <p className="notation-avis-entete">
                  <strong>{a.cible}</strong> · {LIBELLES_ALERTE[a.type]}
                </p>
                <p className="notation-aide">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Panneau>
    </div>
  );
}
