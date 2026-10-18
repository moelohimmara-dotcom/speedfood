"use client";

import { useState, useTransition } from "react";
import { Alert, Card } from "@/components/ui";
import { signalerAuPersonnelAction } from "@/lib/table/actions";
import { LIBELLES_REGLEMENT } from "@/lib/table/regles";
import type { VueTable } from "@/lib/table/service";

const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;
const LIBELLE_STATUT: Record<string, string> = {
  en_attente: "En attente de validation",
  acceptee: "En préparation",
  prete: "Prête",
  terminee: "Servie",
  refusee: "Refusée",
  annulee: "Annulée",
};

/** Ardoise de la table vue par le convive : toutes les commandes de la table, le total, et les appels au personnel. */
export function BlocTable({ jeton, vue }: { jeton?: string; vue: VueTable }) {
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const ouverte = vue.session.statut === "ouverte";

  function signaler(quoi: "serveur" | "addition") {
    setMessage(null);
    demarrer(async () => {
      const r = await signalerAuPersonnelAction(jeton, quoi);
      setMessage(r.ok ? { ton: "succes", texte: quoi === "serveur" ? "Le personnel a été prévenu." : "L'addition a été demandée : le serveur vous l'apporte." } : { ton: "danger", texte: r.erreur });
    });
  }

  return (
    <Card style={{ marginTop: "var(--space-4)" }}>
      <h2 className="table-titre">Table {vue.session.tableNumero}</h2>
      <ul className="table-commandes">
        {vue.commandes.map((c) => (
          <li key={c.id} className="table-commande">
            <p className="table-commande-entete">
              <strong>{c.client}</strong> · {LIBELLE_STATUT[c.statut] ?? c.statut}
              <span className="table-commande-montant">{gnf(c.sousTotal)}</span>
            </p>
            <p className="table-commande-lignes">{c.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}</p>
          </li>
        ))}
      </ul>
      <p className="table-total">
        <span>Addition de la table</span>
        <strong>{gnf(vue.total)}</strong>
      </p>

      {ouverte ? (
        <>
          <p className="table-aide">Vous réglerez à la fin du repas, auprès du serveur. Speedfood n&apos;encaisse rien.</p>
          {message ? <Alert ton={message.ton}>{message.texte}</Alert> : null}
          <div className="table-actions">
            <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => signaler("serveur")}>
              Appeler le serveur
            </button>
            <button type="button" className="btn btn-primary" disabled={enCours} onClick={() => signaler("addition")}>
              Demander l&apos;addition
            </button>
          </div>
        </>
      ) : (
        <p className="table-aide">
          Table réglée{vue.session.paiementMode ? ` (${LIBELLES_REGLEMENT[vue.session.paiementMode]})` : ""}. Merci de votre visite !
        </p>
      )}
    </Card>
  );
}
