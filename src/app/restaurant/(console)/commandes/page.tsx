import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { ApercuCommandeRestaurant } from "@/lib/contracts/commande";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { minutesDepuis, enRetard } from "@/lib/alertes/commandes";
import { Alert } from "@/components/ui";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { CommandeCarte } from "./CommandeCarte";
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

export default async function CommandesPage() {
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

  const { data: docs } = commandes.length
    ? await supabase.from("documents_commande").select("order_id, type, numero").in("order_id", commandes.map((c) => c.id))
    : { data: [] as { order_id: string; type: string; numero: string }[] };
  const documentsDe = (id: string) => {
    const r: { recu?: string; facture?: string } = {};
    for (const d of docs ?? []) {
      if (d.order_id === id && (d.type === "recu" || d.type === "facture")) r[d.type] = d.numero;
    }
    return r;
  };

  const maintenant = new Date();
  const age = (c: ApercuCommandeRestaurant) => ancienneteLisible(new Date(c.creeLe), maintenant);
  // Seules les commandes à traiter attendent une réponse : on affiche leur attente exacte quand elle devient longue.
  const attente = (c: ApercuCommandeRestaurant) =>
    c.etatDerive === "en_attente" && enRetard(c.creeLe, maintenant) ? minutesDepuis(c.creeLe, maintenant) : null;
  const aTraiter = commandes.filter((c) => c.etatDerive === "en_attente");
  const enCours = commandes.filter((c) => ["attente_confirmation_client", "acceptee", "prete"].includes(c.etatDerive));
  const historique = commandes.filter((c) => ["terminee", "refusee", "annulee"].includes(c.etatDerive));

  return (
    <div>
      <PageHeader titre="Commandes" description="Les nouvelles commandes d'abord, puis celles en cours, puis l'historique." />

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
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} />
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
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} />
                ))}
              </div>
            </section>
          ) : null}

          {historique.length > 0 ? (
            <details className="cmd-section cmd-historique">
              <summary className="cmd-section-titre">
                Terminées et annulées <span className="cmd-compteur">{historique.length}</span>
              </summary>
              <div className="cmd-liste">
                {historique.map((commande) => (
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} retardMinutes={attente(commande)} restaurantNom={restaurantNom} documents={documentsDe(commande.id)} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
