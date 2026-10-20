import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { listerMesAvis } from "@/lib/client/mes-commandes";
import { formaterDateCommande } from "@/lib/client/espace";

export const metadata: Metadata = { title: "Mes avis" };
export const dynamic = "force-dynamic";

/** Mes avis : ce que ce compte a publié sur des restaurants, avec la réponse éventuelle du restaurant. Un avis se laisse depuis le suivi d'une commande terminée. */
export default async function MesAvisPage() {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/avis");

  const avis = await listerMesAvis(user.id);

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes avis</h1>

      {avis.length === 0 ? (
        <Card>
          <p>Vous n&apos;avez pas encore laissé d&apos;avis.</p>
          <p className="aide-champ">Une fois une commande terminée, vous pouvez noter le restaurant depuis son suivi : « Mes commandes », puis « Voir le détail ».</p>
          <Link href="/compte/commandes" className="btn btn-primary">
            Mes commandes
          </Link>
        </Card>
      ) : (
        avis.map((a) => (
          <Card key={a.id} className="espace-commande">
            <div className="espace-commande-tete">
              <strong>
                <Link href={`/restaurants/${a.restaurantId}`}>{a.restaurantNom}</Link>
              </strong>
              <span role="img" aria-label={`${a.note} sur 5`}>
                {"★".repeat(a.note)}
                {"☆".repeat(5 - a.note)}
              </span>
            </div>
            <p className="espace-secondaire">{formaterDateCommande(a.creeLe)}</p>
            {a.commentaire ? <p>{a.commentaire}</p> : null}
            {a.statut === "commentaire_masque" ? <Badge ton="neutre">Commentaire masqué par la modération</Badge> : null}
            {a.reponse ? (
              <p className="espace-secondaire">
                <strong>Réponse du restaurant :</strong> {a.reponse}
              </p>
            ) : null}
          </Card>
        ))
      )}
    </main>
  );
}
