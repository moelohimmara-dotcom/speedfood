import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { clientLivraison } from "@/lib/livraison/lecture";
import { gammesDesRestaurants } from "@/lib/decouverte/aide-choix-service";
import { demandesDuRestaurant } from "@/lib/decouverte/gamme-gestion";
import { LIBELLES_GAMME } from "@/lib/decouverte/aide-choix";
import { FormulaireGamme } from "./FormulaireGamme";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Positionnement prix" };
export const dynamic = "force-dynamic";

const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

/**
 * « Positionnement » : la gamme de prix que Speedfood affiche pour ce restaurant, comment elle est calculée, ce qui améliore la
 * visibilité dans l'assistant « Aide-moi à choisir », et la demande de changement de gamme (validée par l'équipe Speedfood).
 */
export default async function PositionnementPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/positionnement");
  const id = membership.restaurant_id;
  const [{ data: resto }, { restaurants, reglages }, demandes] = await Promise.all([
    supabase.from("restaurants").select("nom, publie, latitude, longitude").eq("id", id).maybeSingle(),
    gammesDesRestaurants(),
    demandesDuRestaurant(id).catch(() => []),
  ]);
  if (!resto) return null;
  const moi = restaurants.find((r) => r.id === id) ?? null;
  const enAttente = demandes.find((d) => d.statut === "en_attente") ?? null;
  const dernieres = demandes.filter((d) => d.statut !== "en_attente").slice(0, 3);
  const { data: notes } = await clientLivraison().from("restaurants").select("avis_total").eq("id", id).maybeSingle();
  const avisTotal = (notes as { avis_total?: number } | null)?.avis_total ?? 0;

  const conseils: string[] = [];
  if (resto.latitude === null || resto.longitude === null) conseils.push("Placez votre restaurant sur la carte (Mon restaurant → Profil) : sans position, vous n'apparaissez que pour les clients qui choisissent votre quartier ou votre commune.");
  if (!moi || moi.nbPlatsDisponibles < 3) conseils.push("Gardez au moins 3 plats disponibles avec leur prix : la gamme et le budget du client se jugent sur vos prix réels.");
  if (!resto.publie) conseils.push("Votre restaurant n'est pas encore publié : il n'apparaît pas dans l'assistant.");
  if (avisTotal < 5) conseils.push("Votre note s'affiche à partir de 5 avis de clients : encouragez-les à noter leur commande.");

  return (
    <div className="positionnement-grille">
      <PageHeader titre="Positionnement prix" description="Comment Speedfood présente votre restaurant aux clients qui cherchent selon leur budget et leur position." />

      <Panneau titre="Votre gamme actuelle">
        {moi?.effective ? (
          <>
            <p className="positionnement-gamme">{LIBELLES_GAMME[moi.effective]}</p>
            <p className="notation-aide">
              {moi.validee ? "Gamme validée par l'équipe Speedfood à votre demande." : "Calculée automatiquement d'après vos prix réels."}
            </p>
          </>
        ) : (
          <p>Aucune gamme pour le moment : il faut au moins un plat disponible avec un prix.</p>
        )}
        {moi && moi.prixTypique !== null ? (
          <ul className="positionnement-liste">
            <li>Prix typique de vos plats disponibles : <strong>{gnf(moi.prixTypique)}</strong> (médiane de {moi.nbPlatsDisponibles} plat{moi.nbPlatsDisponibles > 1 ? "s" : ""})</li>
            <li>Plat le moins cher : {gnf(moi.prixMin ?? 0)} · le plus cher : {gnf(moi.prixMax ?? 0)}</li>
          </ul>
        ) : null}
        <p className="notation-aide">
          Repères actuels (prix typique) : Économique jusqu&apos;à {gnf(reglages.seuils.economiqueJusqua)} · Intermédiaire jusqu&apos;à {gnf(reglages.seuils.intermediaireJusqua)} · Haut de gamme jusqu&apos;à{" "}
          {gnf(reglages.seuils.hautDeGammeJusqua)} · Premium au-delà. <Link href="/aide-au-choix" className="lien-texte">Voir l&apos;assistant côté client</Link>
        </p>
      </Panneau>

      <Panneau titre="Demander une autre gamme">
        {enAttente ? (
          <p>
            Votre demande pour la gamme <strong>{LIBELLES_GAMME[enAttente.gammeDemandee]}</strong> est en cours d&apos;examen par l&apos;équipe Speedfood (envoyée le{" "}
            {new Date(enAttente.creeLe).toLocaleDateString("fr-FR", { dateStyle: "medium" })}).
          </p>
        ) : (
          <FormulaireGamme actuelle={moi?.effective ?? null} />
        )}
        {dernieres.length > 0 ? (
          <ul className="positionnement-liste">
            {dernieres.map((d) => (
              <li key={d.id}>
                {LIBELLES_GAMME[d.gammeDemandee]} : <strong>{d.statut === "acceptee" ? "acceptée" : "refusée"}</strong>
                {d.motifDecision ? ` — ${d.motifDecision}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Panneau>

      <Panneau titre="Pour être mieux proposé">
        {conseils.length === 0 ? (
          <p>Votre fiche est complète pour l&apos;assistant. Rien à corriger pour le moment.</p>
        ) : (
          <ul className="positionnement-liste">
            {conseils.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <p className="notation-aide">Aucun restaurant ne paie pour être mieux placé : l&apos;ordre dépend du budget, de la distance et de vos prix réels.</p>
      </Panneau>
    </div>
  );
}
