import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge, Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { lireMaReservation } from "@/lib/reservation/api-serveur";
import { formaterCreneau } from "@/lib/reservation/creneaux";
import { tonStatutReservation } from "@/lib/reservation/console";
import { peutAnnulerReservation } from "@/lib/reservation/liste";
import { libelleStatutReservation } from "@/lib/reservation/statuts";
import { BoutonAnnulerReservation } from "../BoutonAnnulerReservation";

export const metadata: Metadata = { title: "Ma réservation" };
export const dynamic = "force-dynamic";

/** Détail d'une réservation du compte, avec l'annulation (confirmation explicite) tant qu'elle est demandée ou confirmée et à venir. L'API ne rend que les réservations du compte. */
export default async function MaReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ envoyee?: string }> }) {
  const { id } = await params;
  const { envoyee } = await searchParams;
  const chemin = `/compte/reservations/${encodeURIComponent(id)}`;
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) redirect(`/entrer?suite=${encodeURIComponent(chemin)}`);

  const r = await lireMaReservation(id);
  if (!r.ok && r.genre === "connexion") redirect(`/entrer?suite=${encodeURIComponent(chemin)}`);
  if (!r.ok && r.code === "INTROUVABLE") notFound();

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte/reservations">← Mes réservations</Link>
      </p>
      <h1>Ma réservation</h1>
      {!r.ok ? (
        <Alert ton="info">{r.message}</Alert>
      ) : (
        <>
          {envoyee === "1" && r.donnees.statut === "demandee" ? <Alert ton="succes">Votre demande est envoyée. Le restaurant doit la confirmer. Aucun paiement.</Alert> : null}
          <Card className="reservation-carte">
            <div className="reservation-carte-tete">
              <strong>
                <Link href={`/restaurants/${r.donnees.restaurantId}`}>{r.donnees.restaurantNom}</Link>
              </strong>
              <Badge ton={tonStatutReservation(r.donnees.statut)}>{libelleStatutReservation(r.donnees.statut)}</Badge>
            </div>
            {r.donnees.motif ? <p className="reservation-motif">Message du restaurant : {r.donnees.motif}</p> : null}
            <dl className="reservation-detail">
              <dt>Jour et heure</dt>
              <dd>{formaterCreneau(r.donnees.creneau)} (heure de Conakry)</dd>
              <dt>Personnes</dt>
              <dd>{r.donnees.nbPersonnes}</dd>
              <dt>Nom</dt>
              <dd>{r.donnees.nom}</dd>
              <dt>Téléphone</dt>
              <dd>{r.donnees.telephone}</dd>
              {r.donnees.note ? (
                <>
                  <dt>Note</dt>
                  <dd>{r.donnees.note}</dd>
                </>
              ) : null}
              <dt>Référence</dt>
              <dd>{r.donnees.reference}</dd>
            </dl>
          </Card>
          {peutAnnulerReservation(r.donnees, new Date()) ? (
            <BoutonAnnulerReservation
              reservationId={r.donnees.id}
              resume={`${r.donnees.restaurantNom}, ${formaterCreneau(r.donnees.creneau)}, ${r.donnees.nbPersonnes} ${r.donnees.nbPersonnes === 1 ? "personne" : "personnes"}.`}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
