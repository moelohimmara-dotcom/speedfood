"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  INTERVALLE_VERIFICATION_MS,
  nouvellesCommandes,
  relanceSonDue,
  titreAlerte,
} from "@/lib/alertes/commandes";
import { depuisBase64Url } from "@/lib/push/vapid";

/**
 * Alertes de nouvelle commande, console ouverte (lot A de l'analyse du 4 octobre 2026).
 *
 * - Vérifie toutes les 15 s les commandes « à traiter » (route `/restaurant/alertes`, données minimales).
 * - À chaque arrivée : carillon (si le son est activé), titre d'onglet « (2) Nouvelle commande », notification du
 *   navigateur si elle est autorisée et que l'onglet est caché, annonce pour lecteur d'écran, rafraîchissement
 *   de la liste et de la pastille.
 * - Tant qu'une commande reste à traiter, le carillon est rejoué toutes les 2 minutes.
 * - Dit clairement quand les alertes sont en pause (connexion perdue, session expirée) : un restaurateur qui croit
 *   être alerté alors qu'il ne l'est plus perd des clients.
 *
 * Aucune donnée de client n'est lue ici. Le son démarre seulement après un geste de l'utilisateur (règle des
 * navigateurs) : le bouton « Son » sert aussi à l'activer.
 */

type Etat = "ok" | "reseau" | "session";
type EtatPush = "inconnu" | "nonconfigure" | "indisponible" | "refuse" | "inactif" | "actif";

/** Le navigateur sait-il recevoir des notifications push (Service Worker + PushManager + Notification) ? */
function pushSupporte(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

async function envoyerAbonnement(methode: "POST" | "DELETE", corps: unknown): Promise<Response> {
  return fetch("/restaurant/alertes/abonnement", {
    method: methode,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}

const CLE_SON = "speedfood.alerte-commandes.son";
const abonnesSon = new Set<() => void>();
const abonnerSon = (notifier: () => void) => {
  abonnesSon.add(notifier);
  return () => {
    abonnesSon.delete(notifier);
  };
};
function sonActif(): boolean {
  try {
    return window.localStorage.getItem(CLE_SON) !== "0";
  } catch {
    return true;
  }
}
function ecrireSon(actif: boolean): void {
  try {
    window.localStorage.setItem(CLE_SON, actif ? "1" : "0");
  } catch {
    // Stockage indisponible : le choix vaut pour cette page seulement.
  }
  for (const notifier of abonnesSon) {
    notifier();
  }
}

const abonnesNotif = new Set<() => void>();
const abonnerNotif = (notifier: () => void) => {
  abonnesNotif.add(notifier);
  return () => {
    abonnesNotif.delete(notifier);
  };
};
function permissionNotif(): string {
  return typeof Notification === "undefined" ? "indisponible" : Notification.permission;
}

type ContexteAudio = AudioContext;

function creerContexteAudio(): ContexteAudio | null {
  const Constructeur =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructeur ? new Constructeur() : null;
}

/** Deux notes montantes, deux fois : reconnaissable sans être agressif. */
function jouerCarillon(ctx: ContexteAudio): void {
  const t = ctx.currentTime;
  const notes: Array<[number, number]> = [
    [880, 0],
    [1175, 0.22],
    [880, 0.62],
    [1175, 0.84],
  ];
  for (const [frequence, delai] of notes) {
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.type = "sine";
    oscillateur.frequency.value = frequence;
    gain.gain.setValueAtTime(0.0001, t + delai);
    gain.gain.exponentialRampToValueAtTime(0.35, t + delai + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delai + 0.38);
    oscillateur.connect(gain).connect(ctx.destination);
    oscillateur.start(t + delai);
    oscillateur.stop(t + delai + 0.42);
  }
}

export function AlerteCommandes({ clePublique }: { clePublique: string | null }) {
  const router = useRouter();
  const son = useSyncExternalStore(abonnerSon, sonActif, () => true);
  const permission = useSyncExternalStore(abonnerNotif, permissionNotif, () => "indisponible");

  const [etat, setEtat] = useState<Etat>("ok");
  const [derniereVerification, setDerniereVerification] = useState<string | null>(null);
  const [nombreAlertes, setNombreAlertes] = useState(0);
  const [annonce, setAnnonce] = useState("");
  const [sonBloque, setSonBloque] = useState(false);
  const [alertesJouees, setAlertesJouees] = useState(0);
  const [etatPush, setEtatPush] = useState<EtatPush>("inconnu");
  const [messagePush, setMessagePush] = useState("");
  const [pushEnCours, setPushEnCours] = useState(false);

  const connues = useRef<Set<string> | null>(null);
  const contexte = useRef<ContexteAudio | null>(null);
  const dernierSon = useRef<number | null>(null);
  const dernierRafraichissement = useRef(0);
  const titreInitial = useRef<string | null>(null);
  const sonRef = useRef(son);
  useEffect(() => {
    sonRef.current = son;
  }, [son]);

  const jouer = useCallback((): boolean => {
    if (!sonRef.current) {
      return false;
    }
    if (!contexte.current) {
      contexte.current = creerContexteAudio();
    }
    const ctx = contexte.current;
    if (!ctx) {
      return false;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    if (ctx.state !== "running") {
      setSonBloque(true);
      return false;
    }
    setSonBloque(false);
    jouerCarillon(ctx);
    dernierSon.current = Date.now();
    setAlertesJouees((n) => n + 1);
    return true;
  }, []);

  // Le premier geste dans la page autorise le son (les navigateurs interdisent de le démarrer seul).
  useEffect(() => {
    const debloquer = () => {
      if (!contexte.current) {
        contexte.current = creerContexteAudio();
      }
      if (contexte.current?.state === "suspended") {
        void contexte.current.resume().then(() => setSonBloque(false));
      } else if (contexte.current?.state === "running") {
        setSonBloque(false);
      }
    };
    window.addEventListener("pointerdown", debloquer, { once: true });
    window.addEventListener("keydown", debloquer, { once: true });
    return () => {
      window.removeEventListener("pointerdown", debloquer);
      window.removeEventListener("keydown", debloquer);
    };
  }, []);

  // Titre d'onglet : « (n) Nouvelle commande » tant que l'onglet est caché et qu'une alerte est en cours.
  useEffect(() => {
    if (nombreAlertes <= 0) {
      return;
    }
    if (titreInitial.current === null) {
      titreInitial.current = document.title;
    }
    const base = titreInitial.current;
    let clignote = false;
    const minuterie = window.setInterval(() => {
      clignote = !clignote;
      document.title = clignote ? titreAlerte(base, nombreAlertes) : base;
    }, 1000);
    document.title = titreAlerte(base, nombreAlertes);
    const acquitter = () => {
      if (document.visibilityState === "visible") {
        setNombreAlertes(0);
      }
    };
    document.addEventListener("visibilitychange", acquitter);
    window.addEventListener("focus", acquitter);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", acquitter);
      window.removeEventListener("focus", acquitter);
      if (titreInitial.current !== null) {
        document.title = titreInitial.current;
        titreInitial.current = null;
      }
    };
  }, [nombreAlertes]);

  useEffect(() => {
    let annule = false;
    const detecter = async () => {
      let resultat: EtatPush;
      if (!clePublique) {
        resultat = "nonconfigure";
      } else if (!pushSupporte()) {
        resultat = "indisponible";
      } else if (Notification.permission === "denied") {
        resultat = "refuse";
      } else {
        try {
          const enregistrement = await navigator.serviceWorker.getRegistration("/sw.js");
          const abonnement = await enregistrement?.pushManager.getSubscription();
          resultat = abonnement ? "actif" : "inactif";
          if (abonnement) {
            // Rafraîchit l'abonnement côté serveur (appareil repris par un autre compte, abonnement supprimé après des échecs).
            void envoyerAbonnement("POST", abonnement.toJSON()).catch(() => undefined);
          }
        } catch {
          resultat = "inactif";
        }
      }
      if (!annule) {
        setEtatPush(resultat);
      }
    };
    void detecter();
    return () => {
      annule = true;
    };
  }, [clePublique]);

  const activerPush = async () => {
    if (!clePublique || !pushSupporte()) {
      return;
    }
    setPushEnCours(true);
    setMessagePush("");
    try {
      const permission = await Notification.requestPermission();
      for (const notifier of abonnesNotif) {
        notifier();
      }
      if (permission !== "granted") {
        setEtatPush(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const enregistrement = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const abonnement =
        (await enregistrement.pushManager.getSubscription()) ??
        (await enregistrement.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: depuisBase64Url(clePublique),
        }));
      const reponse = await envoyerAbonnement("POST", abonnement.toJSON());
      if (!reponse.ok) {
        await abonnement.unsubscribe();
        setEtatPush("inactif");
        setMessagePush(
          reponse.status === 409
            ? "Trop d'appareils sont déjà enregistrés sur ce compte (10 au maximum)."
            : "L'activation a échoué. Réessayez dans un instant."
        );
        return;
      }
      setEtatPush("actif");
      setMessagePush("Alerte activée. Utilisez « Envoyer un essai » pour vérifier.");
    } catch {
      setMessagePush("Ce navigateur n'a pas pu activer l'alerte. Réessayez, ou utilisez Chrome, Edge ou Firefox.");
    } finally {
      setPushEnCours(false);
    }
  };

  const desactiverPush = async () => {
    setPushEnCours(true);
    setMessagePush("");
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration("/sw.js");
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        const endpoint = abonnement.endpoint;
        await abonnement.unsubscribe();
        await envoyerAbonnement("DELETE", { endpoint }).catch(() => undefined);
      }
      setEtatPush("inactif");
      setMessagePush("Alerte page fermée désactivée sur cet appareil.");
    } catch {
      setMessagePush("La désactivation a échoué. Réessayez.");
    } finally {
      setPushEnCours(false);
    }
  };

  const essaiPush = async () => {
    setPushEnCours(true);
    setMessagePush("");
    try {
      const reponse = await fetch("/restaurant/alertes/test", { method: "POST", credentials: "same-origin" });
      if (reponse.status === 429) {
        setMessagePush("Trop d'essais : patientez quelques minutes.");
      } else if (!reponse.ok) {
        setMessagePush("L'essai n'a pas pu partir. Réessayez dans un instant.");
      } else {
        const donnees = (await reponse.json()) as { abonnes: number; envoyes: number };
        setMessagePush(
          donnees.envoyes > 0
            ? `Essai envoyé à ${donnees.envoyes} appareil${donnees.envoyes > 1 ? "s" : ""}. Vous devriez voir « Nouvelle commande ».`
            : "Aucun appareil n'a reçu l'essai : désactivez puis réactivez l'alerte."
        );
      }
    } catch {
      setMessagePush("L'essai n'a pas pu partir : vérifiez votre connexion.");
    } finally {
      setPushEnCours(false);
    }
  };

  const verifier = useCallback(async () => {
    try {
      const reponse = await fetch("/restaurant/alertes", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const type = reponse.headers.get("content-type") ?? "";
      if (!reponse.ok || !type.includes("application/json")) {
        // 401, ou redirection vers la connexion / la double authentification (page HTML).
        setEtat(reponse.status === 401 || !type.includes("application/json") ? "session" : "reseau");
        return;
      }
      const donnees = (await reponse.json()) as { aTraiter: number; ids: string[] };
      setEtat("ok");
      setDerniereVerification(
        new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );

      if (connues.current === null) {
        // Première lecture : l'existant n'est pas « nouveau », on ne sonne pas à l'ouverture de la console.
        connues.current = new Set(donnees.ids);
        return;
      }

      const nouvelles = nouvellesCommandes(connues.current, donnees.ids);
      connues.current = new Set(donnees.ids);

      if (nouvelles.length > 0) {
        jouer();
        setAnnonce(
          nouvelles.length === 1
            ? "Nouvelle commande reçue. Elle est à traiter."
            : `${nouvelles.length} nouvelles commandes reçues. Elles sont à traiter.`
        );
        if (document.visibilityState !== "visible") {
          setNombreAlertes(donnees.aTraiter);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const titre = nouvelles.length === 1 ? "Nouvelle commande" : `${nouvelles.length} nouvelles commandes`;
            const options = {
              body: "Ouvrez Speedfood pour répondre au client.",
              tag: "speedfood-commande",
              icon: "/icons/icon-192.png",
              badge: "/icons/badge-96.png",
            };
            // Chrome sur Android interdit `new Notification()` : il faut passer par le Service Worker (disponible aussi ailleurs).
            const afficher = async () => {
              const enregistrement = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/sw.js") : undefined;
              if (enregistrement) {
                await enregistrement.showNotification(titre, options);
              } else {
                new Notification(titre, options);
              }
            };
            afficher().catch(() => {
              // Navigateur sans notifications locales : le titre d'onglet et le son restent actifs.
            });
          }
        }
        dernierRafraichissement.current = Date.now();
        router.refresh();
      } else if (document.visibilityState === "visible" && donnees.aTraiter > 0) {
        // Au plus une fois par minute : met à jour les âges (« il y a 12 min ») et la mise en évidence des retards.
        if (Date.now() - dernierRafraichissement.current >= 60_000) {
          dernierRafraichissement.current = Date.now();
          router.refresh();
        }
        if (relanceSonDue(donnees.aTraiter, dernierSon.current, Date.now())) {
          jouer();
        }
      } else if (donnees.aTraiter > 0 && relanceSonDue(donnees.aTraiter, dernierSon.current, Date.now())) {
        jouer();
      }
    } catch {
      setEtat("reseau");
    }
  }, [jouer, router]);

  useEffect(() => {
    let arrete = false;
    let minuterie: number | undefined;
    const boucle = async () => {
      await verifier();
      if (!arrete) {
        minuterie = window.setTimeout(boucle, INTERVALLE_VERIFICATION_MS);
      }
    };
    void boucle();
    const auRetour = () => {
      if (document.visibilityState === "visible") {
        void verifier();
      }
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("online", auRetour);
    return () => {
      arrete = true;
      if (minuterie !== undefined) {
        window.clearTimeout(minuterie);
      }
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("online", auRetour);
    };
  }, [verifier]);

  const basculerSon = () => {
    const futur = !son;
    ecrireSon(futur);
    if (futur) {
      if (!contexte.current) {
        contexte.current = creerContexteAudio();
      }
      sonRef.current = true;
      jouer();
    }
  };

  const demanderNotifications = async () => {
    if (typeof Notification === "undefined") {
      return;
    }
    try {
      await Notification.requestPermission();
    } finally {
      for (const notifier of abonnesNotif) {
        notifier();
      }
    }
  };

  const libelleEtat =
    etat === "ok"
      ? `Alertes actives${derniereVerification ? ` · vérifié à ${derniereVerification}` : ""}`
      : etat === "reseau"
        ? "Connexion perdue : alertes en pause"
        : "Session expirée : reconnectez-vous";

  return (
    <section className="alerte-commandes" aria-label="Alertes de nouvelle commande" data-alertes-jouees={alertesJouees}>
      <details className="alerte-commandes-details">
        <summary className="alerte-commandes-resume">
          <span className={`alerte-commandes-point alerte-commandes-point-${etat}`} aria-hidden="true" />
          <span>{libelleEtat}</span>
        </summary>
        <div className="alerte-commandes-actions">
          <button type="button" className="btn btn-secondary btn-compact" aria-pressed={son} onClick={basculerSon}>
            Son : {son ? "activé" : "désactivé"}
          </button>
          {son ? (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                if (!contexte.current) {
                  contexte.current = creerContexteAudio();
                }
                jouer();
              }}
            >
              Tester le son
            </button>
          ) : null}
          {permission === "default" ? (
            <button type="button" className="btn btn-secondary btn-compact" onClick={demanderNotifications}>
              Notifications du navigateur
            </button>
          ) : null}
        </div>
        {etatPush !== "nonconfigure" && etatPush !== "inconnu" ? (
          <div className="alerte-commandes-push">
            <p className="alerte-commandes-note">
              <strong>Alerte page fermée</strong> :{" "}
              {etatPush === "actif"
                ? "activée sur cet appareil."
                : etatPush === "indisponible"
                  ? "indisponible sur ce navigateur. Sur Android, ouvrez Speedfood dans Chrome (pas dans WhatsApp ou Facebook). Sur iPhone, ajoutez d'abord Speedfood à l'écran d'accueil."
                  : etatPush === "refuse"
                    ? "notifications refusées : autorisez-les dans les réglages du navigateur pour le site."
                    : "désactivée. Recevez l'alerte même quand cette page est fermée."}
            </p>
            <div className="alerte-commandes-actions">
              {etatPush === "inactif" ? (
                <button type="button" className="btn btn-primary btn-compact" disabled={pushEnCours} onClick={activerPush}>
                  Être alerté page fermée
                </button>
              ) : null}
              {etatPush === "actif" ? (
                <>
                  <button type="button" className="btn btn-secondary btn-compact" disabled={pushEnCours} onClick={essaiPush}>
                    Envoyer un essai
                  </button>
                  <button type="button" className="btn btn-secondary btn-compact" disabled={pushEnCours} onClick={desactiverPush}>
                    Désactiver
                  </button>
                </>
              ) : null}
            </div>
            {messagePush ? (
              <p className="alerte-commandes-note" role="status">
                {messagePush}
              </p>
            ) : null}
          </div>
        ) : null}
        {permission === "granted" ? <p className="alerte-commandes-note">Notifications du navigateur : activées.</p> : null}
        {permission === "denied" ? (
          <p className="alerte-commandes-note">Notifications refusées dans le navigateur : modifiez l&apos;autorisation du site pour les recevoir.</p>
        ) : null}
        {sonBloque && son ? (
          <p className="alerte-commandes-note">Le navigateur bloque le son tant que vous n&apos;avez pas touché la page : touchez « Tester le son ».</p>
        ) : null}
        <p className="alerte-commandes-note">
          L&apos;alerte ne fonctionne que page ouverte. Gardez cet onglet ouvert et le volume du téléphone ou de l&apos;ordinateur activé.
        </p>
      </details>
      {etat !== "ok" ? (
        <p className="alerte-commandes-probleme" role="alert">
          {etat === "reseau"
            ? "Vous ne recevez plus d'alertes de nouvelle commande tant que la connexion n'est pas revenue."
            : "Vous ne recevez plus d'alertes : reconnectez-vous pour les reprendre."}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {annonce}
      </p>
    </section>
  );
}
