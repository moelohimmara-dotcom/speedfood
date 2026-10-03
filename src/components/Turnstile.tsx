"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const URL_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Props {
  siteKey: string;
  /** Reçoit le jeton à usage unique, ou `null` s'il expire ou échoue. */
  onToken: (jeton: string | null) => void;
  /** À incrémenter pour obtenir un jeton neuf (un jeton ne se valide qu'une fois). */
  renouveler: number;
}

/** Widget Cloudflare Turnstile en rendu explicite (documentation officielle). */
export function Turnstile({ siteKey, onToken, renouveler }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const identifiant = useRef<string | null>(null);
  const rappel = useRef(onToken);
  useEffect(() => {
    rappel.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let annule = false;

    function monter() {
      if (annule || !conteneur.current || !window.turnstile || identifiant.current) {
        return;
      }
      identifiant.current = window.turnstile.render(conteneur.current, {
        sitekey: siteKey,
        language: "fr",
        callback: (jeton: string) => rappel.current(jeton),
        "expired-callback": () => rappel.current(null),
        "error-callback": () => rappel.current(null),
      });
    }

    if (window.turnstile) {
      monter();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!script) {
        script = document.createElement("script");
        script.src = URL_SCRIPT;
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", monter);
    }

    return () => {
      annule = true;
      if (identifiant.current && window.turnstile) {
        window.turnstile.remove(identifiant.current);
      }
      identifiant.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (renouveler > 0 && identifiant.current && window.turnstile) {
      window.turnstile.reset(identifiant.current);
      rappel.current(null);
    }
  }, [renouveler]);

  return <div ref={conteneur} style={{ margin: "0 0 var(--space-4)" }} />;
}
