import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge, Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { definirAdresseParDefautAction, supprimerAdresseAction } from "@/lib/client/actions-espace";
import { FormulaireAdresse } from "./FormulaireAdresse";

export const metadata: Metadata = { title: "Mes adresses" };
export const dynamic = "force-dynamic";

/** Mes adresses : cinq au plus, une par défaut. Lues avec la session du client (la RLS ne lui montre que les siennes) ; proposées à la commande en livraison. */
export default async function MesAdressesPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/adresses");

  const { data } = await (supabase as unknown as SupabaseClient).from("client_adresses").select("id, libelle, adresse, par_defaut").order("cree_le", { ascending: true }).limit(5);
  const adresses = (data ?? []) as Array<{ id: string; libelle: string; adresse: string; par_defaut: boolean }>;

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes adresses</h1>

      {adresses.length === 0 ? (
        <Card>
          <p>Aucune adresse enregistrée.</p>
          <p className="aide-champ">Enregistrez celles où l&apos;on vous livre : vous les choisirez d&apos;un geste en commandant.</p>
        </Card>
      ) : (
        adresses.map((a) => (
          <Card key={a.id} className="espace-commande">
            <div className="espace-commande-tete">
              <strong>{a.libelle}</strong>
              {a.par_defaut ? <Badge ton="succes">Par défaut</Badge> : null}
            </div>
            <p className="espace-secondaire">{a.adresse}</p>
            <div className="espace-commande-actions">
              {a.par_defaut ? null : (
                <form action={definirAdresseParDefautAction.bind(null, a.id)}>
                  <button type="submit" className="btn btn-secondary btn-compact">
                    Utiliser par défaut
                  </button>
                </form>
              )}
              <form action={supprimerAdresseAction.bind(null, a.id)}>
                <button type="submit" className="btn btn-secondary btn-compact">
                  Supprimer
                </button>
              </form>
            </div>
          </Card>
        ))
      )}

      {adresses.length < 5 ? (
        <Card>
          <h2>Ajouter une adresse</h2>
          <FormulaireAdresse />
        </Card>
      ) : (
        <p className="aide-champ">Vous avez atteint les 5 adresses : supprimez-en une pour en ajouter.</p>
      )}
    </main>
  );
}
