import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import type { ApercuCommandeRestaurant } from "@/lib/contracts/commande";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { Card, Alert } from "@/components/ui";
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

  const maintenant = new Date();
  const age = (c: ApercuCommandeRestaurant) => ancienneteLisible(new Date(c.creeLe), maintenant);
  const aTraiter = commandes.filter((c) => c.etatDerive === "en_attente");
  const enCours = commandes.filter((c) => ["attente_confirmation_client", "acceptee", "prete"].includes(c.etatDerive));
  const historique = commandes.filter((c) => ["terminee", "refusee", "annulee"].includes(c.etatDerive));

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Commandes</h1>

      {erreurChargement ? (
        <Alert ton="danger">{erreurChargement}</Alert>
      ) : commandes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Aucune commande pour l&apos;instant. Vos commandes clients apparaîtront ici dès qu&apos;un
            client en passera une.
          </p>
        </Card>
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
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} />
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
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} />
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
                  <CommandeCarte key={commande.id} commande={commande} age={age(commande)} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
