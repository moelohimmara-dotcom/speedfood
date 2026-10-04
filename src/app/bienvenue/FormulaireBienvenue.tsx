"use client";

import { useActionState, useState } from "react";
import { enregistrerProfilAction, type EtatProfil } from "@/lib/client/actions";
import { AVATARS, genererPseudo } from "@/lib/client/profil";
import { Alert } from "@/components/ui";

const etatInitial: EtatProfil = {};

/**
 * Bienvenue en deux étapes (1 : avatar, 2 : pseudo), avec une barre « plus qu'une étape ». Le pseudo est proposé au hasard
 * et se relance d'un bouton. Tout reste modifiable. Les petites animations sont coupées si la personne a demandé de
 * réduire les mouvements (voir `cadre.css`).
 */
export function FormulaireBienvenue({
  suite,
  pseudoInitial,
  avatarInitial,
}: {
  suite: string;
  pseudoInitial: string | null;
  avatarInitial: string | null;
}) {
  const [etat, action, enCours] = useActionState(enregistrerProfilAction, etatInitial);
  const [etape, setEtape] = useState<1 | 2>(avatarInitial ? 2 : 1);
  const [avatar, setAvatar] = useState<string>(avatarInitial ?? "");
  const [pseudo, setPseudo] = useState<string>(pseudoInitial ?? "");
  // Pseudo proposé au hasard, tiré une seule fois côté navigateur au premier passage à l'étape 2.
  const [propose, setPropose] = useState<string>("");

  function passerAuPseudo() {
    if (!avatar) {
      return;
    }
    if (!pseudo && !propose) {
      const nouveau = genererPseudo();
      setPropose(nouveau);
      setPseudo(nouveau);
    }
    setEtape(2);
  }

  function relancer() {
    const nouveau = genererPseudo();
    setPropose(nouveau);
    setPseudo(nouveau);
  }

  const emojiChoisi = AVATARS.find((a) => a.cle === avatar)?.emoji;

  return (
    <main className="bienvenue">
      <p className="bienvenue-etape" aria-live="polite">
        {etape === 1 ? "Étape 1 sur 2" : "Plus qu'une étape"}
      </p>
      <div className="bienvenue-barre" role="progressbar" aria-valuemin={0} aria-valuemax={2} aria-valuenow={etape} aria-label="Avancement">
        <span style={{ width: etape === 1 ? "50%" : "100%" }} />
      </div>

      <form action={action} className="bienvenue-carte">
        <input type="hidden" name="suite" value={suite} />
        <input type="hidden" name="avatar" value={avatar} />

        {etape === 1 ? (
          <>
            <h1>Qui êtes-vous à table ?</h1>
            <p className="bienvenue-sous">Choisissez votre avatar. Vous pourrez en changer quand vous voulez.</p>
            <div className="bienvenue-avatars" role="radiogroup" aria-label="Avatar">
              {AVATARS.map((a) => (
                <button
                  key={a.cle}
                  type="button"
                  role="radio"
                  aria-checked={avatar === a.cle}
                  aria-label={a.libelle}
                  className={`bienvenue-avatar${avatar === a.cle ? " choisi" : ""}`}
                  onClick={() => setAvatar(a.cle)}
                >
                  <span aria-hidden="true">{a.emoji}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-block" disabled={!avatar} onClick={passerAuPseudo}>
              Continuer
            </button>
          </>
        ) : (
          <>
            <div className="bienvenue-apercu" aria-hidden="true">
              {emojiChoisi}
            </div>
            <h1>Et votre pseudo ?</h1>
            <p className="bienvenue-sous">Voici une idée. Gardez-la, changez-la ou tirez-en une autre.</p>
            <div className="field">
              <label htmlFor="pseudo">Pseudo</label>
              <input
                id="pseudo"
                name="pseudo"
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                minLength={3}
                maxLength={24}
                autoComplete="nickname"
                required
              />
            </div>
            <button type="button" className="btn btn-secondary btn-compact" onClick={relancer}>
              🎲 Une autre idée
            </button>
            {etat.erreur ? (
              <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
                {etat.erreur}
              </Alert>
            ) : null}
            <div className="bienvenue-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEtape(1)}>
                Retour
              </button>
              <button type="submit" className="btn btn-primary" disabled={enCours || !avatar}>
                {enCours ? "Un instant…" : "C'est parti !"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
