"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerPropositionAction } from "@/lib/commande/actions-restaurant";
import { valeursDeReprise } from "@/lib/commande/reprise";
import type { ValeursProposition } from "@/lib/contracts/commande";
import { Button, Input, Alert } from "@/components/ui";

interface Props {
  commandeId: string;
  sousTotalActuel: number;
  fraisActuels: number;
  /** Dernière proposition envoyée (la plus récente). Ses valeurs servent de point de départ. */
  derniereProposition?: {
    nouveauSousTotal: number;
    nouveauxFraisLivraison: number;
    conditionsModifiees: string | null;
  };
  onFermer: () => void;
}

/**
 * Formulaire de proposition révisée (prix, frais de livraison, conditions).
 * Une proposition crée une nouvelle version immuable : la commande reste en
 * attente et n'est préparée qu'après l'accord du client.
 *
 * Si la commande a déjà reçu une proposition, ses valeurs sont proposées comme
 * point de départ : ressaisir les mêmes chiffres après un refus du client est
 * le cas le plus fréquent, et les retaper à chaque fois est une source d'erreur.
 */
export function FormulaireProposition({
  commandeId,
  sousTotalActuel,
  fraisActuels,
  derniereProposition,
  onFermer,
}: Props) {
  const router = useRouter();
  // Une commande déjà proposée repart de ses derniers montants : ressaisir les mêmes
  // chiffres après un refus du client est le cas le plus fréquent.
  const initiales = valeursDeReprise({ sousTotalActuel, fraisActuels }, derniereProposition);
  const [sousTotal, setSousTotal] = useState(initiales.sousTotal);
  const [frais, setFrais] = useState(initiales.frais);
  const [conditions, setConditions] = useState(initiales.conditions);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [enCours, demarrer] = useTransition();

  function soumettre() {
    const erreurs: Record<string, string> = {};
    const nouveauSousTotal = Number.parseInt(sousTotal, 10);
    const nouveauxFrais = Number.parseInt(frais, 10);
    if (!Number.isInteger(nouveauSousTotal) || nouveauSousTotal < 0 || nouveauSousTotal > 10_000_000) {
      erreurs.montants = "Sous-total invalide (entier en GNF, 0 à 10 000 000).";
    }
    if (!Number.isInteger(nouveauxFrais) || nouveauxFrais < 0 || nouveauxFrais > 10_000_000) {
      erreurs.montants = "Frais de livraison invalides (entier en GNF, 0 à 10 000 000).";
    }
    if (conditions.trim().length > 500) {
      erreurs.conditions = "500 caractères maximum.";
    }
    const modifie =
      nouveauSousTotal !== sousTotalActuel ||
      nouveauxFrais !== fraisActuels ||
      conditions.trim().length > 0;
    if (!modifie) {
      erreurs.montants = "Changez le montant, les frais ou les conditions pour proposer quelque chose.";
    }
    setChamps(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return;
    }

    const confirme = window.confirm(
      "Envoyer cette proposition au client ? La préparation reprendra seulement après son accord."
    );
    if (!confirme) {
      return;
    }

    const valeurs: ValeursProposition = {
      nouveauSousTotal,
      nouveauxFraisLivraison: nouveauxFrais,
      conditionsModifiees: conditions.trim().length > 0 ? conditions.trim() : null,
    };

    setErreur(null);
    demarrer(async () => {
      const resultat = await creerPropositionAction(commandeId, valeurs);
      if (!resultat.ok) {
        setErreur(resultat.erreur.message);
        return;
      }
      onFermer();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        soumettre();
      }}
      noValidate
      style={{
        border: "1px solid var(--bordure)",
        borderRadius: "var(--radius-md)",
        padding: 12,
      }}
    >
      <p style={{ marginTop: 0, fontWeight: 700 }}>Proposer une modification</p>
      <p style={{ margin: "0 0 var(--space-3)", color: "var(--secondaire)", fontSize: "0.85rem" }}>
        Le client devra accepter cette nouvelle version avant toute préparation. En cas de refus ou
        d&apos;absence de réponse à l&apos;échéance, la commande sera annulée sans frais.
      </p>
      {initiales.reprise ? (
        <p className="aide-champ" style={{ margin: "0 0 var(--space-3)" }}>
          Repris de votre proposition précédente : modifiez ce qu&apos;il faut avant d&apos;envoyer.
        </p>
      ) : null}

      <Input
        label="Nouveau sous-total (GNF)"
        name="sousTotal"
        type="number"
        min={0}
        max={10_000_000}
        step={1}
        value={sousTotal}
        onChange={(e) => setSousTotal(e.target.value)}
        erreur={champs.montants}
      />
      <Input
        label="Nouveaux frais de livraison (GNF)"
        name="frais"
        type="number"
        min={0}
        max={10_000_000}
        step={1}
        value={frais}
        onChange={(e) => setFrais(e.target.value)}
      />
      <div className={`field ${champs.conditions ? "has-error" : ""}`}>
        <label htmlFor="conditions-proposition">Conditions ou précisions</label>
        <textarea
          id="conditions-proposition"
          name="conditions"
          maxLength={500}
          rows={3}
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="Ex. : un plat est remplacé par…, livraison possible seulement vers…"
        />
        {champs.conditions ? (
          <span className="field-error">{champs.conditions}</span>
        ) : null}
      </div>

      {erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
          {erreur}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Envoi…" : "Envoyer la proposition"}
        </Button>
        <Button type="button" variante="secondary" onClick={onFermer} disabled={enCours}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
