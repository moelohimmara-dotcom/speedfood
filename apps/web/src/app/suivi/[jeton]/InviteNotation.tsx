"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card } from "@/components/ui";
import { rattacherCommandeAction } from "@/lib/notation/actions";

interface Props {
  /** `non_connecte` : inviter à se connecter ; `rattachable` : proposer de rattacher la commande au compte connecté. */
  mode: "non_connecte" | "rattachable";
  /** Jeton de la page `/suivi/<jeton>` ; absent sur `/suivi` (le cookie porte déjà la commande). */
  jeton?: string;
  restaurantNom: string;
}

/**
 * Invitation à noter une commande terminée : un visiteur sans session se connecte (la commande reste accessible via la session de suivi),
 * un visiteur connecté peut rattacher à son compte une commande passée sans compte.
 */
export function InviteNotation({ mode, jeton, restaurantNom }: Props) {
  const routeur = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function seConnecter() {
    setErreur(null);
    demarrer(async () => {
      try {
        // Sur la page à lien, on pose d'abord la session de suivi (cookie HttpOnly) : après la connexion on revient à `/suivi`, sans jamais
        // mettre le lien de suivi dans une adresse de redirection.
        if (jeton) {
          const r = await fetch("/api/suivi/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jeton }) });
          if (!r.ok) throw new Error("session");
        }
        routeur.push("/entrer?suite=/suivi");
      } catch {
        setErreur("Impossible d'ouvrir la connexion pour le moment. Réessayez dans un instant.");
      }
    });
  }

  function rattacher() {
    setErreur(null);
    demarrer(async () => {
      const r = await rattacherCommandeAction(jeton);
      if (r.ok) routeur.refresh();
      else setErreur(r.erreur);
    });
  }

  return (
    <Card className="u-mt-s4">
      <h2 className="notation-titre">Votre avis compte</h2>
      {mode === "non_connecte" ? (
        <>
          <p className="notation-aide">Notez votre repas chez {restaurantNom} : connectez-vous ou créez un compte (une minute). Votre commande vous attend ensuite.</p>
          <button type="button" className="btn btn-primary" disabled={enCours} onClick={seConnecter}>
            {enCours ? "Ouverture…" : "Me connecter pour noter"}
          </button>
        </>
      ) : (
        <>
          <p className="notation-aide">
            Cette commande a été passée sans compte. Pour la noter, rattachez-la à votre compte : seule la personne qui détient ce lien peut le faire, et une commande ne se rattache qu&apos;à un seul compte.
          </p>
          <button type="button" className="btn btn-primary" disabled={enCours} onClick={rattacher}>
            {enCours ? "Rattachement…" : "Rattacher cette commande à mon compte"}
          </button>
        </>
      )}
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
    </Card>
  );
}
