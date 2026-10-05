"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaiementSuivi } from "@/lib/contracts/commande";
import { declarerPaiementAction } from "@/lib/commande/actions";
import { LIBELLES_MODE, formaterMontantGnf, libelleStatutPaiement, type ModePaiement, type OptionPaiement } from "@/lib/paiement/regles";
import { Alert, Button, Card } from "@/components/ui";

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** Bloc d'une option mobile money : le code à saisir, copiable, avec les étapes et la déclaration « J'ai payé ». */
function OptionMobileMoney({
  option,
  total,
  restaurant,
  jeton,
  choisi,
}: {
  option: OptionPaiement;
  total: number;
  restaurant: string;
  jeton: string;
  choisi: boolean;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<{ ton: "info" | "danger"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  async function copier() {
    try {
      await navigator.clipboard.writeText(option.code ?? "");
      setMessage({ ton: "info", texte: "Code copié." });
    } catch {
      setMessage({ ton: "info", texte: "Copie impossible : recopiez le code affiché." });
    }
  }

  function declarer() {
    setMessage(null);
    demarrer(async () => {
      const r = await declarerPaiementAction(jeton, option.mode, reference);
      if (!r.ok) {
        setMessage({ ton: "danger", texte: r.erreur.message });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`pay-option${choisi ? " pay-option-choisie" : ""}`}>
      <h3 className="pay-option-titre">Payer avec {option.libelle}</h3>
      <ol className="pay-etapes">
        <li>Ouvrez {option.libelle} sur votre téléphone et choisissez « Paiement marchand ».</li>
        <li>
          Saisissez le code marchand : <strong className="pay-code">{option.code}</strong>{" "}
          <button type="button" className="pay-copier" onClick={copier}>
            Copier
          </button>
        </li>
        <li>
          Saisissez le montant : <strong>{formaterMontantGnf(total)}</strong>. Vérifiez que le nom affiché est « {restaurant} », puis validez avec votre code
          secret.
        </li>
      </ol>
      <p className="pay-secret">Ne donnez jamais votre code secret : Speedfood ne le demande jamais.</p>
      <div className="field">
        <label htmlFor={`ref-${option.mode}`}>Numéro de transaction (facultatif, reçu par SMS)</label>
        <input
          id={`ref-${option.mode}`}
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={40}
          autoComplete="off"
          placeholder="Ex. PP260105.1234.A56789"
        />
      </div>
      {message ? <Alert ton={message.ton}>{message.texte}</Alert> : null}
      <Button type="button" pleineLargeur disabled={enCours} onClick={declarer}>
        {enCours ? "Envoi…" : `J'ai payé avec ${option.libelle}`}
      </Button>
    </div>
  );
}

function OptionEspeces({ jeton, choisi }: { jeton: string; choisi: boolean }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className={`pay-option${choisi ? " pay-option-choisie" : ""}`}>
      <h3 className="pay-option-titre">Payer en espèces</h3>
      <p style={{ margin: "0 0 var(--space-3)" }}>Vous réglez au restaurant à la remise de la commande.</p>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="secondary"
        pleineLargeur
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          demarrer(async () => {
            const r = await declarerPaiementAction(jeton, "especes", "");
            if (!r.ok) {
              setErreur(r.erreur.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {enCours ? "Envoi…" : "Je paierai en espèces"}
      </Button>
    </div>
  );
}

/**
 * Règlement de la commande vu par le client. Rien à payer tant que le restaurant n'a pas accepté (la commande peut encore être
 * refusée ou son prix modifié). Après acceptation : le code marchand du restaurant, le montant et les étapes ; le client DÉCLARE
 * son paiement, le restaurateur le CONFIRME. Speedfood ne reçoit, ne détient ni ne vérifie aucun argent.
 */
export function PanneauPaiement({ jeton, paiement, total, restaurant }: { jeton: string; paiement: PaiementSuivi; total: number; restaurant: string }) {
  const { statut, mode, options } = paiement;

  if (statut === "recu") {
    return (
      <Card style={{ marginTop: "var(--space-4)", border: "2px solid var(--succes)" }}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>{libelleStatutPaiement(statut, mode)}</p>
        <p style={{ margin: "0 0 var(--space-3)", color: "var(--secondaire)" }}>
          {mode ? `${LIBELLES_MODE[mode]}` : "Paiement"}
          {paiement.recuLe ? ` · confirmé le ${formaterDate(paiement.recuLe)}` : ""}
          {paiement.reference ? ` · réf. ${paiement.reference}` : ""}
        </p>
        <Link href={`/suivi/${jeton}/recu`} className="btn btn-primary btn-block">
          Voir mon reçu
        </Link>
      </Card>
    );
  }

  if (options.length === 0) {
    return (
      <Card style={{ marginTop: "var(--space-4)" }}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Règlement</p>
        <p style={{ margin: 0, color: "var(--secondaire)" }}>
          Vous réglez directement avec le restaurant, selon ses modalités (espèces ou mobile money). Speedfood n&apos;encaisse rien. Quand le restaurant aura accepté
          votre commande, ses moyens de paiement s&apos;afficheront ici.
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: "var(--space-4)" }}>
      <p style={{ marginTop: 0, fontWeight: 700, fontSize: "1.1rem" }}>Payer {restaurant}</p>
      <p className="pay-montant">{formaterMontantGnf(total)}</p>
      <p style={{ margin: "0 0 var(--space-3)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
        Vous payez directement le restaurant : Speedfood ne reçoit jamais l&apos;argent. Pour une livraison, les frais sont à confirmer avec le restaurant : payez le montant
        convenu avec lui.
      </p>

      {statut === "declare" || statut === "especes" ? (
        <Alert ton="info" style={{ marginBottom: "var(--space-3)" }}>
          {libelleStatutPaiement(statut, mode)}
          {mode && mode !== "especes" && paiement.reference ? ` (réf. ${paiement.reference})` : ""}
          {paiement.declareLe ? ` · ${formaterDate(paiement.declareLe)}` : ""}.
        </Alert>
      ) : null}
      {statut === "non_recu" ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
          Le restaurant n&apos;a pas retrouvé votre paiement. Vérifiez le code et le montant, ou contactez-le, puis déclarez-le à nouveau.
        </Alert>
      ) : null}

      <div className="pay-options">
        {options.map((o) =>
          o.mode === "especes" ? (
            <OptionEspeces key={o.mode} jeton={jeton} choisi={mode === "especes"} />
          ) : (
            <OptionMobileMoney key={o.mode} option={o} total={total} restaurant={restaurant} jeton={jeton} choisi={mode === (o.mode as ModePaiement)} />
          )
        )}
      </div>
    </Card>
  );
}
