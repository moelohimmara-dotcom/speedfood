"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  avancerMaCourseAction,
  basculerEnLigneAction,
  envoyerPositionAction,
  lireMonEtatAction,
  repondreOffreLivreurAction,
} from "@/lib/livraison/actions-livreur";
import type { EtatLivreur } from "@/lib/livraison/livreur";
import { liensCarte } from "@/lib/parametres/assistance-format";
import { Alert, Button, Card } from "@/components/ui";

const INTERVALLE_ETAT_MS = 4000;
const INTERVALLE_POSITION_MS = 8000;

function secondesRestantes(expireLe: string): number {
  return Math.max(0, Math.ceil((new Date(expireLe).getTime() - Date.now()) / 1000));
}

/** Console du livreur : rafraîchie toutes les 4 secondes ; la position est envoyée toutes les 8 secondes tant que le livreur est en ligne ou en course. */
export function ConsoleLivreur({ etatInitial }: { etatInitial: EtatLivreur }) {
  const [etat, setEtat] = useState<EtatLivreur>(etatInitial);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurPosition, setErreurPosition] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [reste, setReste] = useState<number>(etatInitial.offre ? secondesRestantes(etatInitial.offre.expireLe) : 0);
  const [enCours, demarrer] = useTransition();
  const derniereEnvoi = useRef(0);

  const rafraichir = useCallback(async () => {
    const e = await lireMonEtatAction().catch(() => null);
    if (e) setEtat(e);
  }, []);

  // Rafraîchissement régulier (aussi au retour sur l'onglet).
  useEffect(() => {
    const minuteur = setInterval(() => {
      if (!document.hidden) void rafraichir();
    }, INTERVALLE_ETAT_MS);
    const visible = () => {
      if (!document.hidden) void rafraichir();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [rafraichir]);

  // Compte à rebours de l'offre.
  useEffect(() => {
    const t = setInterval(() => setReste(etat.offre ? secondesRestantes(etat.offre.expireLe) : 0), 500);
    return () => clearInterval(t);
  }, [etat.offre]);

  // Position : tant que le livreur est en ligne ou en course, la page doit rester ouverte.
  const actif = etat.livreur.statut !== "hors_ligne";
  useEffect(() => {
    if (!actif || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setErreurPosition(null);
        const maintenant = Date.now();
        if (maintenant - derniereEnvoi.current < INTERVALLE_POSITION_MS) return;
        derniereEnvoi.current = maintenant;
        void envoyerPositionAction(p.coords.latitude, p.coords.longitude);
      },
      () => setErreurPosition("Position indisponible : autorisez la localisation pour recevoir des courses."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [actif]);

  function lancer(travail: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    demarrer(async () => {
      const r = await travail();
      if (!r.ok && r.message) setMessage(r.message);
      await rafraichir();
    });
  }

  const { livreur, offre, course } = etat;

  return (
    <div className="livreur-contenu">
      <Card>
        <p className="livreur-ligne">
          <strong>{livreur.nom}</strong> · {livreur.statut === "disponible" ? "En ligne" : livreur.statut === "en_course" ? "En course" : "Hors ligne"}
        </p>
        {livreur.statut !== "en_course" ? (
          <Button type="button" variante={livreur.statut === "disponible" ? "secondary" : "primary"} disabled={enCours} onClick={() => lancer(() => basculerEnLigneAction(livreur.statut !== "disponible"))}>
            {livreur.statut === "disponible" ? "Me mettre hors ligne" : "Me mettre en ligne"}
          </Button>
        ) : null}
        {actif ? <p className="aide-champ">Gardez cette page ouverte et l&apos;écran allumé : sinon la position n&apos;est plus envoyée et vous ne recevez plus de courses.</p> : null}
        {actif && !etat.positionConnue ? <p className="aide-champ">En attente de votre position…</p> : null}
        {erreurPosition ? <Alert ton="danger">{erreurPosition}</Alert> : null}
      </Card>

      {offre && reste > 0 ? (
        <Card>
          <h2 className="livreur-titre">Nouvelle course</h2>
          <p className="livreur-ligne">
            <strong>{offre.restaurantNom}</strong>
            {offre.distanceRestaurantKm !== null ? ` · à ${offre.distanceRestaurantKm.toLocaleString("fr-FR")} km de vous` : ""}
          </p>
          <p className="livreur-ligne">
            {offre.distanceCourseKm !== null ? `Course de ${offre.distanceCourseKm.toLocaleString("fr-FR")} km` : "Course"}
            {offre.fraisGnf > 0 ? ` · frais de livraison ${offre.fraisGnf.toLocaleString("fr-FR")} GNF` : ""}
          </p>
          <p className="livreur-compte-a-rebours" role="timer" aria-live="off">
            {reste} s pour répondre
          </p>
          <div className="livreur-actions">
            <Button type="button" disabled={enCours} onClick={() => lancer(() => repondreOffreLivreurAction(offre.offreId, "acceptee"))}>
              Accepter
            </Button>
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => repondreOffreLivreurAction(offre.offreId, "refusee"))}>
              Refuser
            </Button>
          </div>
        </Card>
      ) : null}

      {course ? (
        <Card>
          <h2 className="livreur-titre">Course en cours</h2>
          <p className="livreur-ligne">
            <strong>{course.restaurantNom}</strong> · commande {course.commandeReference}
          </p>
          <p className="livreur-ligne">{course.libelle}</p>
          {course.statut === "vers_restaurant" && course.commandeStatut !== "prete" ? (
            <p className="aide-champ">La commande n&apos;est pas encore prête : le restaurant la prépare.</p>
          ) : null}

          {course.restaurantPoint && (course.statut === "assignee" || course.statut === "vers_restaurant") ? (
            <p>
              <a className="btn btn-secondary" href={liensCarte(course.restaurantPoint.latitude, course.restaurantPoint.longitude).itineraire} target="_blank" rel="noopener noreferrer">
                Itinéraire vers le restaurant
              </a>
            </p>
          ) : null}
          {course.arriveePoint && (course.statut === "recuperee" || course.statut === "vers_client") ? (
            <p>
              <a className="btn btn-secondary" href={liensCarte(course.arriveePoint.latitude, course.arriveePoint.longitude).itineraire} target="_blank" rel="noopener noreferrer">
                Itinéraire vers le client
              </a>
            </p>
          ) : null}

          {course.client ? (
            <div className="livreur-client">
              <p className="livreur-ligne">
                <strong>{course.client.nom}</strong>
              </p>
              <p className="livreur-ligne">{course.client.adresse ?? "Adresse non précisée"}</p>
              <p className="livreur-ligne">
                <a href={`tel:${course.client.telephone}`}>{course.client.telephone}</a>
              </p>
            </div>
          ) : null}

          <div className="livreur-actions">
            {course.statut === "assignee" ? (
              <Button type="button" disabled={enCours} onClick={() => lancer(() => avancerMaCourseAction("vers_restaurant"))}>
                Je pars au restaurant
              </Button>
            ) : null}
            {course.statut === "vers_restaurant" ? (
              <Button type="button" disabled={enCours || course.commandeStatut !== "prete"} onClick={() => lancer(() => avancerMaCourseAction("recuperee"))}>
                J&apos;ai récupéré la commande
              </Button>
            ) : null}
            {course.statut === "recuperee" ? (
              <Button type="button" disabled={enCours} onClick={() => lancer(() => avancerMaCourseAction("vers_client"))}>
                Je pars chez le client
              </Button>
            ) : null}
            {course.statut === "vers_client" ? (
              <>
                <label className="commande-livraison-code">
                  Code du client (4 chiffres)
                  <input inputMode="numeric" maxLength={4} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <Button
                  type="button"
                  disabled={enCours || code.length !== 4}
                  onClick={() =>
                    lancer(async () => {
                      const r = await avancerMaCourseAction("livree", code);
                      if (r.ok) setCode("");
                      return r;
                    })
                  }
                >
                  Livrée
                </Button>
                <Button type="button" variante="secondary" disabled={enCours} onClick={() => lancer(() => avancerMaCourseAction("echec", undefined, "Client injoignable ou absent"))}>
                  Client injoignable
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!offre && !course && livreur.statut === "disponible" ? <p className="aide-champ">Aucune course pour le moment. Vous serez prévenu ici dès qu&apos;une offre arrive.</p> : null}
      {message ? <Alert ton="danger">{message}</Alert> : null}
    </div>
  );
}
