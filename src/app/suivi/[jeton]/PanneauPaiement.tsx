"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaiementEnLigneSuivi, PaiementSuivi } from "@/lib/contracts/commande";
import { declarerPaiementAction } from "@/lib/commande/actions";
import { declarerPaiementSessionAction } from "@/lib/commande/actions-session";
import { payerEnLigneAction, payerEnLigneSessionAction, simulerPaiementAction, simulerPaiementSessionAction } from "@/lib/paiement/en-ligne/actions";
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
  session = false,
  choisi,
}: {
  option: OptionPaiement;
  total: number;
  restaurant: string;
  jeton?: string;
  session?: boolean;
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
      const r = session
        ? await declarerPaiementSessionAction(option.mode, reference)
        : jeton
          ? await declarerPaiementAction(jeton, option.mode, reference)
          : { ok: false as const, erreur: { code: "INTROUVABLE" as const, message: "Lien de suivi introuvable." } };
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

const NOMS_OPERATEUR = { orange_money: "Orange Money", mtn_momo: "MTN MoMo" } as const;

/**
 * Paiement en ligne via Speedfood : recommandé, optionnel. Le client choisit son opérateur, valide sur son téléphone ; le restaurant (et le
 * livreur) sont payés dès que la commande est remise. Les frais du paiement mobile sont à la charge de Speedfood.
 */
function OptionEnLigne({ jeton, session = false, enLigne, total }: { jeton?: string; session?: boolean; enLigne: PaiementEnLigneSuivi; total: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function payer(operateur: "orange_money" | "mtn_momo") {
    setMessage(null);
    demarrer(async () => {
      const r = session ? await payerEnLigneSessionAction(operateur) : jeton ? await payerEnLigneAction(jeton, operateur) : null;
      if (!r || !r.ok) {
        setMessage(r && !r.ok ? r.erreur.message : "Lien de suivi introuvable.");
        return;
      }
      // Un vrai prestataire peut renvoyer une adresse de paiement ; seules les adresses sécurisées sont suivies.
      if (r.urlPaiement && r.urlPaiement.startsWith("https://")) {
        window.location.assign(r.urlPaiement);
        return;
      }
      router.refresh();
    });
  }

  function simuler() {
    setMessage(null);
    demarrer(async () => {
      const r = session ? await simulerPaiementSessionAction() : jeton ? await simulerPaiementAction(jeton) : null;
      if (!r || !r.ok) {
        setMessage(r && !r.ok ? r.erreur.message : "Lien de suivi introuvable.");
        return;
      }
      router.refresh();
    });
  }

  const { etat } = enLigne;

  if (etat === "en_attente" || etat === "cree") {
    const nom = enLigne.operateur ? NOMS_OPERATEUR[enLigne.operateur] : "votre opérateur";
    return (
      <div className="pay-option pay-option-choisie pay-enligne">
        <h3 className="pay-option-titre">Paiement en ligne en cours</h3>
        <p className="suivi-pay-texte">
          Validez le paiement de <strong>{formaterMontantGnf(enLigne.totalGnf ?? total)}</strong> sur votre téléphone ({nom}). Cette page se met à jour toute seule.
        </p>
        {enLigne.simulation ? (
          <>
            <p className="pay-enligne-demo">Mode démonstration : aucun argent réel n&apos;est prélevé.</p>
            <Button type="button" pleineLargeur disabled={enCours} onClick={simuler}>
              {enCours ? "Validation…" : "Simuler la validation sur mon téléphone"}
            </Button>
          </>
        ) : null}
        {message ? <Alert ton="danger">{message}</Alert> : null}
      </div>
    );
  }

  if (etat === "echoue" || etat === "expire" || etat === "annule") {
    return (
      <Alert ton="danger">
        Le paiement en ligne n&apos;a pas abouti. Aucun montant n&apos;a été prélevé : choisissez un autre mode ci-dessous ou contactez le restaurant.
      </Alert>
    );
  }
  if (etat === "rembourse") return <Alert ton="info">Votre paiement en ligne a été remboursé.</Alert>;
  if (!enLigne.disponible) return null;

  return (
    <div className="pay-option pay-enligne">
      <h3 className="pay-option-titre">
        Payer en ligne avec Speedfood <span className="pay-enligne-badge">Recommandé</span>
      </h3>
      <p className="suivi-pay-texte">
        Payez depuis votre téléphone, sans code à recopier. Le restaurant est payé dès que votre commande vous est remise. Les frais du paiement mobile sont offerts par
        Speedfood.
      </p>
      {enLigne.simulation ? <p className="pay-enligne-demo">Mode démonstration : aucun argent réel n&apos;est prélevé.</p> : null}
      <div className="pay-enligne-operateurs">
        <Button type="button" disabled={enCours} onClick={() => payer("orange_money")}>
          {enCours ? "Envoi…" : "Orange Money"}
        </Button>
        <Button type="button" disabled={enCours} onClick={() => payer("mtn_momo")}>
          {enCours ? "Envoi…" : "MTN MoMo"}
        </Button>
      </div>
      {message ? <Alert ton="danger">{message}</Alert> : null}
    </div>
  );
}

function OptionEspeces({ jeton, session = false, choisi }: { jeton?: string; session?: boolean; choisi: boolean }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  return (
    <div className={`pay-option${choisi ? " pay-option-choisie" : ""}`}>
      <h3 className="pay-option-titre">Payer en espèces</h3>
      <p className="suivi-pay-texte">Vous réglez au restaurant à la remise de la commande.</p>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
      <Button
        type="button"
        variante="secondary"
        pleineLargeur
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          demarrer(async () => {
            const r = session
              ? await declarerPaiementSessionAction("especes", "")
              : jeton
                ? await declarerPaiementAction(jeton, "especes", "")
                : { ok: false as const, erreur: { code: "INTROUVABLE" as const, message: "Lien de suivi introuvable." } };
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
export function PanneauPaiement({ jeton, session = false, paiement, total, restaurant }: { jeton?: string; session?: boolean; paiement: PaiementSuivi; total: number; restaurant: string }) {
  const { statut, mode, options, enLigne } = paiement;
  const enLigneEnCours = enLigne.etat === "cree" || enLigne.etat === "en_attente";
  const afficheEnLigne = enLigne.disponible || enLigne.etat !== null;

  if (statut === "recu") {
    return (
      <Card className="suivi-bloc suivi-paye">
        <p className="suivi-resto-nom">{libelleStatutPaiement(statut, mode)}</p>
        <p className="suivi-pay-texte suivi-pay-secondaire">
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

  if (options.length === 0 && !afficheEnLigne) {
    return (
      <Card className="suivi-bloc">
        <p className="suivi-resto-nom">Règlement</p>
        <p className="suivi-pay-sans-marge suivi-pay-secondaire">
          Vous réglez directement avec le restaurant, selon ses modalités (espèces ou mobile money). Speedfood n&apos;encaisse rien. Quand le restaurant aura accepté
          votre commande, ses moyens de paiement s&apos;afficheront ici.
        </p>
      </Card>
    );
  }

  return (
    <Card className="suivi-bloc">
      <p className="suivi-prop-titre">Payer {restaurant}</p>
      <p className="pay-montant">{formaterMontantGnf(total)}</p>
      {afficheEnLigne ? <OptionEnLigne jeton={jeton} session={session} enLigne={enLigne} total={total} /> : null}
      {enLigneEnCours ? null : (
        <p className="suivi-prop-aide">
          {afficheEnLigne ? "Ou payez directement le restaurant : dans ce cas Speedfood ne reçoit pas l'argent. " : "Vous payez directement le restaurant : Speedfood ne reçoit jamais l'argent. "}
          Pour une livraison, les frais sont à confirmer avec le restaurant : payez le montant convenu avec lui.
        </p>
      )}

      {statut === "declare" || statut === "especes" ? (
        <Alert ton="info" className="suivi-prop-erreur">
          {libelleStatutPaiement(statut, mode)}
          {mode && mode !== "especes" && paiement.reference ? ` (réf. ${paiement.reference})` : ""}
          {paiement.declareLe ? ` · ${formaterDate(paiement.declareLe)}` : ""}.
        </Alert>
      ) : null}
      {statut === "non_recu" ? (
        <Alert ton="danger" className="suivi-prop-erreur">
          Le restaurant n&apos;a pas retrouvé votre paiement. Vérifiez le code et le montant, ou contactez-le, puis déclarez-le à nouveau.
        </Alert>
      ) : null}

      <div className="pay-options">
        {(enLigneEnCours ? [] : options).map((o) =>
          o.mode === "especes" ? (
            <OptionEspeces key={o.mode} jeton={jeton} session={session} choisi={mode === "especes"} />
          ) : (
            <OptionMobileMoney key={o.mode} option={o} total={total} restaurant={restaurant} jeton={jeton} session={session} choisi={mode === (o.mode as ModePaiement)} />
          )
        )}
      </div>
    </Card>
  );
}
