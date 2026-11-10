import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { creerClientPublic } from "@/lib/db/public";
import { creerClientServeur } from "@/lib/db/server";
import { lireDisponibiliteReservation } from "@/lib/reservation/api-serveur";
import { FormulaireReservation } from "./FormulaireReservation";

export const metadata: Metadata = { title: "Réserver une table", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Page « Réserver une table » : connexion exigée (retour ici ensuite), puis l'API dit si le restaurant accepte les réservations. L'API est appelée par le SERVEUR du site avec le
 * jeton de la session ; service éteint ou en panne = message clair, jamais une page cassée. Le nom et le téléphone du profil ne sont que des valeurs de départ, modifiables.
 */
export default async function ReserverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!REGEX_UUID.test(id)) notFound();
  const retour = `/restaurants/${id.toLowerCase()}`;
  const suite = `/entrer?suite=${encodeURIComponent(`${retour}/reserver`)}`;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(suite);

  const { data: restaurant } = await creerClientPublic().from("restaurants").select("nom").eq("id", id.toLowerCase()).maybeSingle();
  if (!restaurant) notFound();

  const dispo = await lireDisponibiliteReservation(id);
  if (!dispo.ok && dispo.genre === "connexion") redirect(suite);

  const { data: profil } = await supabase.from("client_profils").select("nom_commande, telephone").eq("utilisateur_id", user.id).maybeSingle();

  return (
    <main className="reservation-page">
      <LienRetour href={retour}>Retour au restaurant</LienRetour>
      <h1>Réserver une table</h1>
      <p className="reservation-intro">{restaurant.nom}</p>
      {!dispo.ok ? (
        <Alert ton="info">{dispo.message}</Alert>
      ) : !dispo.donnees.accepteReservation ? (
        <Alert ton="info">Ce restaurant n&apos;accepte pas les réservations de table pour le moment.</Alert>
      ) : (
        <FormulaireReservation
          restaurantId={id.toLowerCase()}
          restaurantNom={restaurant.nom}
          nbPersonnesMax={dispo.donnees.nbPersonnesMax}
          maintenantIso={new Date().toISOString()}
          nomInitial={profil?.nom_commande ?? ""}
          telephoneInitial={profil?.telephone ?? ""}
        />
      )}
    </main>
  );
}
