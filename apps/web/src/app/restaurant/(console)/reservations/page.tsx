import Link from "next/link";
import type { Metadata } from "next";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { OngletsSalle } from "@/components/restaurant/OngletsSalle";
import { Alert, Badge, Card } from "@/components/ui";
import { lireReglageReservation, listerReservationsRestaurant } from "@/lib/reservation/api-serveur";
import { formaterCreneau, formaterHeure, formaterJour } from "@/lib/reservation/creneaux";
import { jourPrecedent, jourSuivant, libelleCapacite, tonStatutReservation } from "@/lib/reservation/console";
import { lireJourReservation, type ReservationRestaurant } from "@/lib/contracts/reservation";
import { libelleStatutReservation } from "@/lib/reservation/statuts";
import { ActionsReservation } from "./ActionsReservation";
import { ReglageReservation } from "./ReglageReservation";

export const metadata: Metadata = { title: "Réservations" };
export const dynamic = "force-dynamic";

/**
 * Réservations de table : la liste d'UN jour (celui choisi, aujourd'hui par défaut), les décisions et les réglages. Tout vient de l'API, appelée par le serveur du site avec le
 * jeton de la session : le restaurant est celui du compte (jamais celui de l'adresse). Les boutons sont exactement les `actionsPossibles` renvoyées par l'API.
 * Service éteint ou en panne : un message clair, la console reste utilisable.
 */
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  await obtenirContexteRestaurant("/restaurant/reservations");
  const { jour } = await searchParams;
  const jourDemande = lireJourReservation(jour);

  const [liste, reglage] = await Promise.all([listerReservationsRestaurant(jourDemande), lireReglageReservation()]);
  const jourAffiche = liste.ok ? liste.donnees.jour : jourDemande;
  const precedent = jourAffiche ? jourPrecedent(jourAffiche) : null;
  const suivant = jourAffiche ? jourSuivant(jourAffiche) : null;
  const reservations = liste.ok ? [...liste.donnees.reservations].sort((a, b) => Date.parse(a.creneau) - Date.parse(b.creneau)) : [];
  const enAttente = reservations.filter((r) => r.statut === "demandee").length;

  return (
    <div>
      <PageHeader titre="Réservations" description="Les demandes de table de vos clients : confirmez-les ou refusez-les. Aucun paiement n'est demandé." />
      <OngletsSalle />

      {!liste.ok && !reglage.ok ? (
        <EtatVide icone="carte" titre="Réservations momentanément indisponibles" texte={liste.message} />
      ) : (
        <>
          <section aria-labelledby="console-reservation-titre-reglage">
            <h2 id="console-reservation-titre-reglage">Réglages</h2>
            {reglage.ok ? (
              <>
                <p className="console-reservation-secondaire">
                  {reglage.donnees.accepteReservation ? "Les clients peuvent vous demander une table." : "Les réservations sont fermées : le bouton n'apparaît pas sur votre page."} {libelleCapacite(reglage.donnees.capaciteCouverts)}.
                </p>
                <ReglageReservation key={`${reglage.donnees.accepteReservation}-${reglage.donnees.capaciteCouverts}`} accepte={reglage.donnees.accepteReservation} capacite={reglage.donnees.capaciteCouverts} />
              </>
            ) : (
              <Alert ton="info">{reglage.message}</Alert>
            )}
          </section>

          <section aria-labelledby="console-reservation-titre-jour">
            <h2 id="console-reservation-titre-jour">{jourAffiche ? `Réservations du ${formaterJour(jourAffiche)}` : "Réservations du jour"}</h2>
            <nav className="console-reservation-jours" aria-label="Choisir le jour">
              {precedent ? (
                <Link href={`/restaurant/reservations?jour=${precedent}`} className="btn btn-secondary btn-compact">
                  Jour précédent
                </Link>
              ) : null}
              <Link href="/restaurant/reservations" className="btn btn-secondary btn-compact">
                Aujourd&apos;hui
              </Link>
              {suivant ? (
                <Link href={`/restaurant/reservations?jour=${suivant}`} className="btn btn-secondary btn-compact">
                  Jour suivant
                </Link>
              ) : null}
              <form method="get" className="console-reservation-choix">
                <label htmlFor="console-reservation-jour">Aller au jour</label>
                <input id="console-reservation-jour" type="date" name="jour" defaultValue={jourAffiche ?? undefined} required />
                <button type="submit" className="btn btn-secondary btn-compact">
                  Afficher
                </button>
              </form>
            </nav>

            {!liste.ok ? <Alert ton="info">{liste.message}</Alert> : null}
            {liste.ok && reservations.length === 0 ? <p>Aucune réservation ce jour-là.</p> : null}
            {liste.ok && reservations.length > 0 ? (
              <>
                <p className="console-reservation-secondaire">
                  {reservations.length} {reservations.length === 1 ? "réservation" : "réservations"}
                  {enAttente > 0 ? ` dont ${enAttente} à traiter` : ""}.
                </p>
                <ul className="console-reservation-liste">
                  {reservations.map((r) => (
                    <li key={r.id}>
                      <CarteReservation reservation={r} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function CarteReservation({ reservation: r }: { reservation: ReservationRestaurant }) {
  const personnes = `${r.nbPersonnes} ${r.nbPersonnes === 1 ? "personne" : "personnes"}`;
  return (
    <Card className="console-reservation-carte">
      <div className="console-reservation-tete">
        <p className="console-reservation-heure">
          {formaterHeure(r.creneau)} · {personnes}
        </p>
        <Badge ton={tonStatutReservation(r.statut)}>{libelleStatutReservation(r.statut)}</Badge>
      </div>
      <p>
        <strong>{r.nom}</strong> ·{" "}
        <a href={`tel:${r.telephone}`} className="lien-texte">
          {r.telephone}
        </a>
      </p>
      {r.note ? <p className="console-reservation-secondaire">Note du client : {r.note}</p> : null}
      {r.motif ? <p className="console-reservation-secondaire">Motif donné : {r.motif}</p> : null}
      <p className="console-reservation-secondaire">Réservation {r.reference}</p>
      <ActionsReservation reservationId={r.id} actions={r.actionsPossibles} resume={`${r.nom}, ${formaterCreneau(r.creneau)}, ${personnes}.`} />
    </Card>
  );
}
