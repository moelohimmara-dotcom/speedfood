import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { ouvrirSuiviCommandeAction } from "@/lib/client/actions-espace";
import { COMMANDES_MAX_AFFICHEES, listerMesCommandes } from "@/lib/client/mes-commandes";
import { formaterDateCommande, formaterMontantClient, libellePaiementClient, libelleStatutCommandeClient } from "@/lib/client/espace";
import { libelleMode } from "@/lib/commande/mode";

export const metadata: Metadata = { title: "Mes commandes" };
export const dynamic = "force-dynamic";

/**
 * Mes commandes : les commandes rattachées au compte, les plus récentes d'abord. Le suivi et le reçu s'ouvrent par une action serveur qui pose le
 * cookie de suivi : le lien secret d'une commande n'apparaît jamais dans la page.
 */
export default async function MesCommandesPage() {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/commandes");

  const commandes = await listerMesCommandes(user.id);
  const enCours = commandes.filter((c) => libelleStatutCommandeClient(c.statut, c.mode).enCours);
  const passees = commandes.filter((c) => !libelleStatutCommandeClient(c.statut, c.mode).enCours);

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes commandes</h1>

      {commandes.length === 0 ? (
        <Card>
          <p>Vous n&apos;avez pas encore de commande liée à ce compte.</p>
          <p className="aide-champ">
            Les commandes passées en étant connecté apparaissent ici. Une commande passée sans compte peut être rattachée au vôtre depuis sa page de suivi.
          </p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      ) : null}

      {enCours.length > 0 ? <h2>En cours</h2> : null}
      {enCours.map((c) => (
        <CarteCommande key={c.id} commande={c} />
      ))}

      {passees.length > 0 ? <h2>Passées</h2> : null}
      {passees.map((c) => (
        <CarteCommande key={c.id} commande={c} />
      ))}

      {commandes.length >= COMMANDES_MAX_AFFICHEES ? <p className="aide-champ">Vos {COMMANDES_MAX_AFFICHEES} commandes les plus récentes sont affichées.</p> : null}
    </main>
  );
}

function CarteCommande({ commande: c }: { commande: Awaited<ReturnType<typeof listerMesCommandes>>[number] }) {
  const statut = libelleStatutCommandeClient(c.statut, c.mode);
  const paiement = libellePaiementClient(c.paiementStatut, c.paiementMode);
  return (
    <Card className="espace-commande">
      <div className="espace-commande-tete">
        <strong>
          <Link href={`/restaurants/${c.restaurantId}`}>{c.restaurantNom}</Link>
        </strong>
        <Badge ton={statut.ton === "attention" ? "neutre" : statut.ton}>{statut.libelle}</Badge>
      </div>
      <p className="espace-secondaire">
        Commande {c.reference} · {formaterDateCommande(c.creeLe)} · {libelleMode(c.mode)}
      </p>
      <p>
        <strong>{formaterMontantClient(c.totalGnf)}</strong>
        {paiement ? <span className="espace-secondaire"> · {paiement}</span> : null}
      </p>
      <div className="espace-commande-actions">
        <form action={ouvrirSuiviCommandeAction.bind(null, c.id, "suivi")}>
          <button type="submit" className={statut.enCours ? "btn btn-primary btn-compact" : "btn btn-secondary btn-compact"}>
            {statut.enCours ? "Suivre ma commande" : "Voir le détail"}
          </button>
        </form>
        {c.paiementStatut === "recu" ? (
          <form action={ouvrirSuiviCommandeAction.bind(null, c.id, "recu")}>
            <button type="submit" className="btn btn-secondary btn-compact">
              Mon reçu
            </button>
          </form>
        ) : null}
        <Link href={`/restaurants/${c.restaurantId}`} className="btn btn-secondary btn-compact">
          Commander à nouveau
        </Link>
      </div>
    </Card>
  );
}
