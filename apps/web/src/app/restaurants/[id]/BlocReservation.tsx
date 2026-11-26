import Link from "next/link";

/** Bloc « Réserver une table » de la fiche restaurant : affiché à tous (connectés ou non) quand l'API a confirmé que ce restaurant accepte les réservations. Ne demande rien ici : la page de réservation s'occupe de tout. */
export function BlocReservation({ restaurantId }: { restaurantId: string }) {
  return (
    <section className="reservation-bloc" aria-labelledby="reservation-bloc-titre">
      <div>
        <h2 id="reservation-bloc-titre" className="reservation-bloc-titre">
          Réserver une table
        </h2>
        <p className="reservation-bloc-texte">Choisissez un jour et une heure : le restaurant confirme votre demande. Aucun paiement.</p>
        <p className="reservation-bloc-texte">Il faut un compte : si vous n’êtes pas connecté, on vous le propose, puis vous revenez à votre réservation.</p>
      </div>
      <Link href={`/restaurants/${restaurantId}/reserver`} className="btn btn-primary">
        Réserver une table
      </Link>
    </section>
  );
}
