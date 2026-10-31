"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function InitialiserSessionSuivi() {
  const router = useRouter();
  const [fragment, setFragment] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setFragment(window.location.hash.slice(1)));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const jeton = fragment;
    if (fragment === null || !jeton) return;
    let annule = false;
    fetch("/api/suivi/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jeton }),
    })
      .then((reponse) => {
        if (!reponse.ok) throw new Error("Lien de suivi introuvable.");
        window.history.replaceState(null, "", "/suivi");
        if (!annule) router.refresh();
      })
      .catch((cause: unknown) => {
        if (!annule) setErreur(cause instanceof Error ? cause.message : "Impossible d'ouvrir le suivi.");
      });
    return () => {
      annule = true;
    };
  }, [fragment, router]);

  return (
    <main className="suivi-page">
      {fragment === "" ? (
        <>
          <h1>Lien de suivi introuvable</h1>
          <p role="alert">Ouvrez le lien reçu après votre commande pour afficher son suivi.</p>
        </>
      ) : (
        <>
          <h1>Ouverture du suivi…</h1>
          {erreur ? <p role="alert">{erreur}</p> : <p>Votre commande va s&apos;afficher dans un instant.</p>}
        </>
      )}
    </main>
  );
}
