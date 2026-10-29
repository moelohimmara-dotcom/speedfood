"use client";

import { useEffect, useState } from "react";
import { depuisBase64Url } from "@/lib/push/vapid";
import { Alert, Button } from "@/components/ui";

type Etat = "inconnu" | "nonconfigure" | "indisponible" | "refuse" | "inactif" | "actif";

const PORTEE = "/compte/";
const SCRIPT = "/sw-client.js";

function pushSupporte(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

async function envoyer(methode: "POST" | "DELETE", corps: unknown): Promise<Response> {
  return fetch("/compte/alertes/abonnement", { method: methode, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
}

/**
 * Alertes de suivi sur CET appareil. Le Service Worker du client (`/sw-client.js`, portée `/compte/`) est distinct de celui des restaurateurs. Le
 * push arrive vide ; le texte est demandé à notre serveur avec la session du client.
 */
export function AlertesAppareil({ clePublique }: { clePublique: string | null }) {
  const [etat, setEtat] = useState<Etat>("inconnu");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      let resultat: Etat;
      if (!clePublique) resultat = "nonconfigure";
      else if (!pushSupporte()) resultat = "indisponible";
      else if (Notification.permission === "denied") resultat = "refuse";
      else {
        try {
          const enregistrement = await navigator.serviceWorker.getRegistration(PORTEE);
          const abonnement = await enregistrement?.pushManager.getSubscription();
          resultat = abonnement ? "actif" : "inactif";
        } catch {
          resultat = "inactif";
        }
      }
      if (!annule) setEtat(resultat);
    })();
    return () => {
      annule = true;
    };
  }, [clePublique]);

  async function activer() {
    if (!clePublique || !pushSupporte()) return;
    setEnCours(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const enregistrement = await navigator.serviceWorker.register(SCRIPT, { scope: PORTEE });
      await navigator.serviceWorker.ready;
      const abonnement = (await enregistrement.pushManager.getSubscription()) ?? (await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: depuisBase64Url(clePublique) }));
      const reponse = await envoyer("POST", abonnement.toJSON());
      if (!reponse.ok) {
        await abonnement.unsubscribe();
        setEtat("inactif");
        setMessage(reponse.status === 409 ? "Vous avez déjà 5 appareils enregistrés : retirez-en un depuis un autre appareil." : "L'activation a échoué. Réessayez dans un instant.");
        return;
      }
      setEtat("actif");
      setMessage("Alertes activées sur cet appareil.");
    } catch {
      setMessage("Ce navigateur n'a pas pu activer les alertes. Essayez avec Chrome, Edge ou Firefox.");
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    setMessage(null);
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration(PORTEE);
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        const endpoint = abonnement.endpoint;
        await abonnement.unsubscribe();
        await envoyer("DELETE", { endpoint }).catch(() => undefined);
      }
      setEtat("inactif");
      setMessage("Alertes désactivées sur cet appareil.");
    } catch {
      setMessage("La désactivation a échoué. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  if (etat === "inconnu") return null;
  return (
    <div className="espace-alertes">
      <h2>Alertes sur cet appareil</h2>
      {etat === "nonconfigure" ? <p className="aide-champ">Les alertes ne sont pas encore disponibles sur Speedfood.</p> : null}
      {etat === "indisponible" ? <p className="aide-champ">Ce navigateur ne sait pas recevoir d&apos;alertes. Sur iPhone, ajoutez d&apos;abord Speedfood à l&apos;écran d&apos;accueil.</p> : null}
      {etat === "refuse" ? <Alert ton="info">Les notifications sont bloquées pour ce site : autorisez-les dans les réglages de votre navigateur, puis revenez ici.</Alert> : null}
      {etat === "inactif" ? (
        <>
          <p className="aide-champ">Recevez une alerte quand votre commande est acceptée, prête ou terminée. Le contenu ne passe jamais par Google ni Apple : seul un signal vide est envoyé.</p>
          <Button type="button" disabled={enCours} onClick={activer}>
            {enCours ? "Activation…" : "Activer les alertes ici"}
          </Button>
        </>
      ) : null}
      {etat === "actif" ? (
        <>
          <p>Les alertes sont activées sur cet appareil.</p>
          <Button type="button" variante="secondary" disabled={enCours} onClick={desactiver}>
            {enCours ? "Désactivation…" : "Désactiver sur cet appareil"}
          </Button>
        </>
      ) : null}
      {message ? (
        <p role="status" className="aide-champ">
          {message}
        </p>
      ) : null}
    </div>
  );
}
