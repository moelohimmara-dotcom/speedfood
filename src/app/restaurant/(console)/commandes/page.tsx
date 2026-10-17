import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { ApercuCommandeRestaurant } from "@/lib/contracts/commande";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { minutesDepuis, enRetard } from "@/lib/alertes/commandes";
import { HISTORIQUE_PAS, limiteHistorique } from "@/lib/commande/a-traiter";
import { Alert } from "@/components/ui";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { CommandeCarte } from "./CommandeCarte";
import { livraisonsDesCommandes } from "@/lib/livraison/vues";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";

/**
 * Console restaurant — commandes (bloc 7).
 *
 * Lecture via la session du membre : la RLS `membres_lecture_leurs_commandes`
 * garantit que le restaurant ne voit que ses propres commandes. Les actions
 * (accepter/refuser/prête/terminée/annuler, proposition révisée) sont dans
 * CommandeCarte et validées côté serveur.
 *
 * Présentation : par urgence plutôt qu'en liste chronologique unique. « À traiter » en tête (c'est
 * là qu'une commande ratée coûte un client), puis « En cours », puis l'historique replié.
 */
export const metadata: Metadata = { title: "Commandes" };

export default async function CommandesPage({ searchParams }: { searchParams: Promise<{ historique?: string | string[] }> }) {
  const { historique: historiqueDemande } = await searchParams;
  const limite = limiteHistorique(historiqueDemande);
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");

  let commandes: ApercuCommandeRestaurant[] = [];
  let erreurChargement: string | null = null;
  try {
    commandes = await chargerApercusCommandes(supabase, membership.restaurant_id);
  } catch (erreur) {
    erreurChargement =
      erreur instanceof ErreurMetier
        ? erreur.message
        : "Impossible de charger les commandes. Réessayez dans un instant.";
  }

  const { data: restaurantLigne } = await supabase.from("restaurants").select("nom").eq("id", membership.restaurant_id).maybeSingle();
  const restaurantNom = restaurantLigne?.nom ?? "Votre restaurant";

  const maintenant = new Date();
  const age = (c: ApercuCommandeRestaurant) => ancienneteLisible(new Date(c.creeLe), maintenant);
  // Seules les commandes à traiter attendent une réponse : on affiche leur attente exacte quand elle devient longue.
  const attente = (c: ApercuCommandeRestaurant) =>
    c.etatDerive === "en_attente" && enRetard(c.creeLe, maintenant) ? minutesDepuis(c.creeLe, maintenant) : null;
  // La commande la plus en retard doit être la première : on traite d'abord celle qui attend depuis le plus longtemps.
  const aTraiter = commandes.filter((c) => c.etatDerive === "en_attente").sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const enCours = commandes.filter((c) => ["attente_confirmation_client", "acceptee", "prete"].includes(c.etatDerive));
  const historiqueComplet = commandes.filter((c) => ["terminee", "refusee", "annulee"].includes(c.etatDerive));
  // L'historique grossit sans fin : on n'en montre qu'une fenêtre (les plus récentes), le reste se déplie par pas.
  const historique = historiqueComplet.slice(0, limite);
  const restantes = historiqueComplet.length - historique.length;

  // Documents : seulement pour les commandes réellement affichées (une liste d'identifiants trop longue ferait échouer la requête).
  const affichees = [...aTraiter, ...enCours, ...historique];
  const { data: docs } = affichees.length
    ? await supabase.from("documents_commande").select("order_id, type, numero").in("order_id", affichees.map((c) => c.id))
    : { data: [] as { order_id: string; type: string; numero: string }[] };
  // Livraisons (lues avec la session du restaurateur : la RLS ne lui montre que les siennes). Table absente = aucune livraison.
  const livraisons = await livraisonsDesCommandes(supabase as unknown as SupabaseClient, affichees.map((c) => c.id)).catch(() => new Map());
  // Notes privées déjà données aux clients (lecture tolérante : sans migration de notation, aucune note).
  const notesClients = new Map<string, { note: number; etiquettes: string[] }>();
  try {
    const { data: notes } = await supabase
      .from("avis" as never)
      .select("order_id, note, etiquettes")
      .eq("cible", "client")
      .eq("auteur", "restaurant")
      .in("order_id", historique.map((c) => c.id));
    for (const n of (notes ?? []) as unknown as { order_id: string; note: number; etiquettes: string[] }[]) {
      notesClients.set(n.order_id, { note: n.note, etiquettes: n.etiquettes ?? [] });
    }
  } catch {
    // Pas de notes à afficher.
  }
  const documentsDe = (id: string) => {
    const r: { recu?: string; facture?: string } = {};
    for (const d of docs ?? []) {
      if (d.order_id === id && (d.type === "recu" || d.type === "facture")) r[d.type] = d.numero;
    }
    return r;
  };

  return (
    <div>
      <PageHeader titre="Commandes" description="Les commandes à traiter d'abord (la plus ancienne en premier), puis celles en cours, puis l'historique." />

      {erreurChargement ? (
        <Alert ton="danger">{erreurChargement}</Alert>
      ) : commandes.length === 0 ? (
        <EtatVide
          icone="commandes"
          titre="Aucune commande pour l'instant"
          texte="Vos commandes clients apparaîtront ici dès qu'un client en passera une."
        />
      ) : (
        <>
          <section aria-labelledby="titre-a-traiter" className="cmd-section">
            <h2 id="titre-a-traiter" className="cmd-section-titre">
              À traiter <span className="cmd-compteur cmd-compteur-alerte">{aTraiter.length}</span>
            </h2>
            {aTraiter.length === 0 ? (
              <p className="cmd-vide">Rien à traiter pour l&apos;instant.</p>
            ) : (
              <div className="cmd-liste">
                {aTraiter.map((commande) => (
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} livraison={livraisons.get(commande.id) ?? null} noteClient={notesClients.get(commande.id) ?? null} />
                ))}
              </div>
            )}
          </section>

          {enCours.length > 0 ? (
            <section aria-labelledby="titre-en-cours" className="cmd-section">
              <h2 id="titre-en-cours" className="cmd-section-titre">
                En cours <span className="cmd-compteur">{enCours.length}</span>
              </h2>
              <div className="cmd-liste">
                {enCours.map((commande) => (
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} livraison={livraisons.get(commande.id) ?? null} noteClient={notesClients.get(commande.id) ?? null} />
                ))}
              </div>
            </section>
          ) : null}

          {historique.length > 0 ? (
            <details className="cmd-section cmd-historique" id="historique" open={historiqueDemande !== undefined}>
              <summary className="cmd-section-titre">
                Terminées et annulées <span className="cmd-compteur">{historiqueComplet.length}</span>
              </summary>
              <div className="cmd-liste">
                {historique.map((commande) => (
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} livraison={livraisons.get(commande.id) ?? null} noteClient={notesClients.get(commande.id) ?? null} />
                ))}
              </div>
              {restantes > 0 ? (
                <p className="cmd-suite">
                  <Link href={`/restaurant/commandes?historique=${limite + HISTORIQUE_PAS}#historique`} className="btn btn-secondary" scroll={false}>
                    Afficher {Math.min(HISTORIQUE_PAS, restantes)} de plus ({restantes} restante{restantes > 1 ? "s" : ""})
                  </Link>
                </p>
              ) : null}
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
