"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { validerConfirmation, type NiveauConfirmation } from "@/lib/console/confirmation";
import { DUREE_MS, ajouterNotification, retirerNotification, type Notification, type TonNotification } from "@/lib/console/notifications";

/**
 * Fondations de retour d'information des consoles (refonte, phase 1) : UNE confirmation et UNE zone de notifications, partagées par la
 * console d'administration et celle du restaurateur. Classes `sx-*` uniquement : ces composants ne dépendent d'aucune règle globale de
 * `.ad-app` (qui restyle `.btn`, les cases à cocher, les libellés…), donc ils ne cassent rien et rien ne les casse.
 *
 * Usage :
 *   const confirmer = useConfirmation();
 *   const reponse = await confirmer({ titre: "Retirer ce quartier ?", libelleAction: "Retirer", danger: true });
 *   if (reponse.confirme) …
 *   const notifier = useNotification();   notifier("succes", "Quartier retiré.");
 * La confirmation n'est qu'un confort d'interface : le serveur revalide toujours (droit, motif, phrase).
 */

export interface DemandeConfirmation {
  titre: string;
  message?: ReactNode;
  libelleAction: string;
  /** Action destructrice : bouton en couleur de danger. */
  danger?: boolean;
  niveau?: NiveauConfirmation;
  /** Niveau « motif » : étiquette du champ. */
  libelleMotif?: string;
  /** Niveau « saisie » : la phrase à recopier. */
  phrase?: string;
}

export interface ReponseConfirmation {
  confirme: boolean;
  /** Niveau « motif » : le motif saisi, normalisé. */
  motif?: string;
}

type Confirmer = (demande: DemandeConfirmation) => Promise<ReponseConfirmation>;
type Notifier = (ton: TonNotification, message: string) => void;

const ContexteConfirmation = createContext<Confirmer | null>(null);
const ContexteNotification = createContext<Notifier | null>(null);

export function useConfirmation(): Confirmer {
  const contexte = useContext(ContexteConfirmation);
  if (!contexte) throw new Error("useConfirmation doit être utilisé sous <ConsoleProviders>.");
  return contexte;
}

export function useNotification(): Notifier {
  const contexte = useContext(ContexteNotification);
  if (!contexte) throw new Error("useNotification doit être utilisé sous <ConsoleProviders>.");
  return contexte;
}

interface DemandeEnCours extends DemandeConfirmation {
  resoudre: (reponse: ReponseConfirmation) => void;
}

export function ConsoleProviders({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prochainId = useRef(1);
  const [demande, setDemande] = useState<DemandeEnCours | null>(null);

  const notifier = useCallback<Notifier>((ton, message) => {
    const id = prochainId.current++;
    setNotifications((liste) => ajouterNotification(liste, { ton, message }, id));
  }, []);

  const confirmer = useCallback<Confirmer>(
    (nouvelle) =>
      new Promise<ReponseConfirmation>((resolve) => {
        // Une seule confirmation à la fois : une demande restée ouverte est refusée, jamais confirmée en silence.
        setDemande((precedente) => {
          precedente?.resoudre({ confirme: false });
          return { ...nouvelle, resoudre: resolve };
        });
      }),
    []
  );

  const fermer = useCallback((reponse: ReponseConfirmation) => {
    setDemande((courante) => {
      courante?.resoudre(reponse);
      return null;
    });
  }, []);

  const retirer = useCallback((id: number) => setNotifications((liste) => retirerNotification(liste, id)), []);

  return (
    <ContexteNotification.Provider value={notifier}>
      <ContexteConfirmation.Provider value={confirmer}>
        {children}
        {demande ? <BoiteConfirmation key={demande.titre + demande.libelleAction} demande={demande} onFermer={fermer} /> : null}
        <ZoneNotifications notifications={notifications} onRetirer={retirer} />
      </ContexteConfirmation.Provider>
    </ContexteNotification.Provider>
  );
}

function BoiteConfirmation({ demande, onFermer }: { demande: DemandeEnCours; onFermer: (r: ReponseConfirmation) => void }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const idChamp = useId();
  const idErreur = useId();
  const niveau = demande.niveau ?? "simple";
  const [saisie, setSaisie] = useState("");
  const [tentative, setTentative] = useState(false);
  const validation = validerConfirmation(niveau, saisie, demande.phrase);

  useEffect(() => {
    const d = dialogue.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Fermer la boîte AVANT de la retirer : `close()` rend le focus à l'élément qui l'avait ouverte (retirée du DOM encore ouverte, elle le perdrait).
  const fermer = (reponse: ReponseConfirmation) => {
    dialogue.current?.close();
    onFermer(reponse);
  };

  const valider = () => {
    if (!validation.ok) {
      setTentative(true);
      return;
    }
    fermer({ confirme: true, motif: validation.motif });
  };

  return (
    <dialog
      ref={dialogue}
      className="sx-dialogue"
      aria-labelledby={idTitre}
      // Échap (ou fermeture par le navigateur) = refus.
      onCancel={(e) => {
        e.preventDefault();
        fermer({ confirme: false });
      }}
    >
      <div className="sx-dialogue-corps">
        <h2 id={idTitre} className="sx-dialogue-titre">
          {demande.titre}
        </h2>
        {demande.message ? <div className="sx-dialogue-message">{demande.message}</div> : null}
        {niveau !== "simple" ? (
          <div className="sx-champ">
            <label htmlFor={idChamp}>{niveau === "motif" ? (demande.libelleMotif ?? "Motif") : `Pour confirmer, recopiez « ${demande.phrase} »`}</label>
            {niveau === "motif" ? (
              <textarea id={idChamp} rows={3} value={saisie} onChange={(e) => setSaisie(e.target.value)} aria-invalid={tentative && !validation.ok ? true : undefined} aria-describedby={tentative && !validation.ok ? idErreur : undefined} />
            ) : (
              <input id={idChamp} type="text" value={saisie} autoComplete="off" onChange={(e) => setSaisie(e.target.value)} aria-invalid={tentative && !validation.ok ? true : undefined} aria-describedby={tentative && !validation.ok ? idErreur : undefined} />
            )}
            {tentative && !validation.ok ? (
              <p id={idErreur} className="sx-champ-erreur" role="alert">
                {validation.erreur}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="sx-actions">
          {/* Le focus initial va au refus : une confirmation ne doit jamais s'obtenir d'une simple touche Entrée. */}
          <button type="button" className="sx-btn" autoFocus onClick={() => fermer({ confirme: false })}>
            Annuler
          </button>
          <button type="button" className={`sx-btn ${demande.danger ? "sx-btn-danger" : "sx-btn-primaire"}`} onClick={valider}>
            {demande.libelleAction}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ZoneNotifications({ notifications, onRetirer }: { notifications: Notification[]; onRetirer: (id: number) => void }) {
  return (
    <div className="sx-notifications" role="region" aria-label="Notifications">
      {notifications.map((n) => (
        <Notice key={n.id} notification={n} onRetirer={onRetirer} />
      ))}
    </div>
  );
}

function Notice({ notification, onRetirer }: { notification: Notification; onRetirer: (id: number) => void }) {
  useEffect(() => {
    const minuteur = window.setTimeout(() => onRetirer(notification.id), DUREE_MS[notification.ton]);
    return () => window.clearTimeout(minuteur);
  }, [notification.id, notification.ton, onRetirer]);
  return (
    // Un échec est annoncé tout de suite (alert) ; un succès poliment (status).
    <div className={`sx-notification sx-notification-${notification.ton}`} role={notification.ton === "erreur" ? "alert" : "status"}>
      <span className="sx-notification-texte">{notification.message}</span>
      <button type="button" className="sx-notification-fermer" aria-label="Fermer la notification" onClick={() => onRetirer(notification.id)}>
        ×
      </button>
    </div>
  );
}

/** Mémoïse un lot de fonctions de retour d'information pour un composant : `{ confirmer, notifier }`. */
export function useRetourInformation() {
  const confirmer = useConfirmation();
  const notifier = useNotification();
  return useMemo(() => ({ confirmer, notifier }), [confirmer, notifier]);
}
