"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmerActivationMfaAction,
  demarrerActivationMfaAction,
  desactiverMfaAction,
  type EtatActivationMfa,
} from "@/lib/auth/mfa";
import { Alert, Button } from "@/components/ui";

interface Props {
  actif: boolean;
  facteurId: string | null;
  sessionRenforcee: boolean;
}

export function ActivationMfa({ actif, facteurId, sessionRenforcee }: Props) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [etape, setEtape] = useState<EtatActivationMfa | null>(null);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmationDesactivation, setConfirmationDesactivation] = useState(false);

  function commencer() {
    setErreur(null);
    demarrer(async () => {
      const resultat = await demarrerActivationMfaAction();
      if (resultat.erreur) {
        setErreur(resultat.erreur);
        return;
      }
      setEtape(resultat);
    });
  }

  function confirmer() {
    if (!etape?.facteurId) return;
    setErreur(null);
    demarrer(async () => {
      const resultat = await confirmerActivationMfaAction(etape.facteurId as string, code);
      if (resultat.erreur) {
        setErreur(resultat.erreur);
        return;
      }
      setEtape(null);
      setCode("");
      router.refresh();
    });
  }

  function desactiver() {
    if (!facteurId) return;
    setErreur(null);
    demarrer(async () => {
      const resultat = await desactiverMfaAction(facteurId);
      if (resultat.erreur) {
        setErreur(resultat.erreur);
        return;
      }
      setConfirmationDesactivation(false);
      router.refresh();
    });
  }

  if (actif) {
    return (
      <div>
        <p style={{ marginTop: 0 }}>
          <strong>Active.</strong> {sessionRenforcee ? "Cette session est protégée par votre code." : ""}
        </p>
        {!confirmationDesactivation ? (
          <Button type="button" variante="secondary" onClick={() => setConfirmationDesactivation(true)}>
            Désactiver la double authentification
          </Button>
        ) : (
          <div>
            <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
              Votre compte ne sera plus protégé que par son mot de passe. Confirmer la désactivation ?
            </Alert>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variante="danger" disabled={enCours} onClick={desactiver}>
                {enCours ? "Désactivation…" : "Oui, désactiver"}
              </Button>
              <Button type="button" variante="secondary" onClick={() => setConfirmationDesactivation(false)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
        {erreur ? (
          <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
            {erreur}
          </Alert>
        ) : null}
      </div>
    );
  }

  if (!etape) {
    return (
      <div>
        <p style={{ marginTop: 0 }}>La double authentification n&apos;est pas activée.</p>
        <Button type="button" disabled={enCours} onClick={commencer}>
          {enCours ? "Préparation…" : "Activer la double authentification"}
        </Button>
        {erreur ? (
          <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
            {erreur}
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <ol style={{ paddingLeft: "1.2rem", marginTop: 0 }}>
        <li>Ouvrez votre application d&apos;authentification et ajoutez un compte en scannant ce code.</li>
      </ol>
      {etape.qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- image SVG fournie par Supabase (data URI), pas un asset du site.
        <img src={etape.qr} alt="Code QR à scanner avec l'application d'authentification" width={200} height={200} />
      ) : null}
      <p style={{ fontSize: "0.85rem", color: "var(--secondaire)" }}>
        Impossible de scanner ? Saisissez cette clé dans l&apos;application, et <strong>conservez-la dans un gestionnaire de
        mots de passe</strong> : c&apos;est votre seul moyen de récupération si vous perdez le téléphone.
      </p>
      <code style={{ display: "block", wordBreak: "break-all", padding: 8, background: "var(--surface)", borderRadius: "var(--radius-md)" }}>
        {etape.secret}
      </code>
      <ol start={2} style={{ paddingLeft: "1.2rem" }}>
        <li>Saisissez le code à 6 chiffres affiché dans l&apos;application pour confirmer.</li>
      </ol>
      <div className="field" style={{ marginBottom: "var(--space-3)" }}>
        <label htmlFor="code-mfa">Code à 6 chiffres</label>
        <input
          id="code-mfa"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-3)" }}>
          {erreur}
        </Alert>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="button" disabled={enCours} onClick={confirmer}>
          {enCours ? "Vérification…" : "Confirmer et activer"}
        </Button>
        <Button type="button" variante="secondary" onClick={() => setEtape(null)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
