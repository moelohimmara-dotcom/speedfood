import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge, Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { listerMesReservations } from "@/lib/reservation/api-serveur";
import { formaterCreneau } from "@/lib/reservation/creneaux";
import { tonStatutReservation } from "@/lib/reservation/console";
import { classerMesReservations } from "@/lib/reservation/liste";
import { type ReservationClient } from "@/lib/contracts/reservation";
import { libelleStatutReservation } from "@/lib/reservation/statuts";

export const metadata: Metadata = { title: "Mes réservations" };
export const dynamic = "force-dynamic";

/**
 * Mes réservations : les demandes de table du compte, lues auprès de l'API par le serveur du site (jeton de la session). Les à venir d'abord, puis les passées ou terminées.
 * Service éteint ou en panne : un message clair, jamais une page cassée.
 */
export default async function MesReservationsPage() {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/reservations");

  const r = await listerMesReservations();
  if (!r.ok && r.genre === "connexion") redirect("/entrer?suite=/compte/reservations");
  const { aVenir, passees } = r.ok ? classerMesReservations(r.donnees, new Date()) : { aVenir: [], passees: [] };

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes réservations</h1>

      {!r.ok ? <Alert ton="info">{r.message}</Alert> : null}

      {r.ok && r.donnees.length === 0 ? (
        <Card>
          <p>Vous n&apos;avez pas encore de réservation de table.</p>
          <p className="aide-champ">Depuis la page d&apos;un restaurant qui accepte les réservations, choisissez « Réserver une table ». Le restaurant confirme votre demande ; aucun paiement n&apos;est demandé.</p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      ) : null}

      {aVenir.length > 0 ? <h2>À venir</h2> : null}
      {aVenir.map((x) => (
        <CarteReservation key={x.id} reservation={x} />
      ))}

      {passees.length > 0 ? <h2>Passées et terminées</h2> : null}
      {passees.map((x) => (
        <CarteReservation key={x.id} reservation={x} />
      ))}
    </main>
  );
}

function CarteReservation({ reservation: x }: { reservation: ReservationClient }) {
  return (
    <Card className="reservation-carte">
      <div className="reservation-carte-tete">
        <strong>
          <Link href={`/restaurants/${x.restaurantId}`}>{x.restaurantNom}</Link>
        </strong>
        <Badge ton={tonStatutReservation(x.statut)}>{libelleStatutReservation(x.statut)}</Badge>
      </div>
      <p>
        <strong>{formaterCreneau(x.creneau)}</strong> · {x.nbPersonnes} {x.nbPersonnes === 1 ? "personne" : "personnes"}
      </p>
      <p className="reservation-secondaire">Réservation {x.reference}</p>
      {x.motif ? <p className="reservation-motif">Message du restaurant : {x.motif}</p> : null}
      <div>
        <Link href={`/compte/reservations/${x.id}`} className="btn btn-secondary btn-compact">
          Voir le détail
        </Link>
      </div>
    </Card>
  );
}
