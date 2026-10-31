import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { NoteResume } from "@/components/notation/NoteResume";
import { listerAvisRestaurant } from "@/lib/notation/gestion";
import { moyenneAffichee } from "@/lib/notation/regles";
import { libelleEtiquette } from "@/lib/notation/lecture-publique";
import { FormulaireReponse } from "./FormulaireReponse";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Avis des clients" };
export const dynamic = "force-dynamic";

/** Avis publics laissés par les clients sur CE restaurant ; une réponse publique par avis, non modifiable. */
export default async function AvisRestaurantPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/avis");
  const { data: resto } = await supabase.from("restaurants").select("avis_somme, avis_total").eq("id", membership.restaurant_id).maybeSingle();
  const r = resto as { avis_somme: number; avis_total: number } | null;
  const avis = await listerAvisRestaurant(membership.restaurant_id);

  return (
    <div>
      <PageHeader titre="Avis des clients" description="Ce que vos clients publient sur votre restaurant. Vous pouvez répondre une fois à chaque avis ; un avis abusif se signale à l'équipe Speedfood." />
      {r ? <NoteResume moyenne={moyenneAffichee(r.avis_somme, r.avis_total)} total={r.avis_total} /> : null}
      {avis.length === 0 ? (
        <EtatVide icone="etoile" titre="Aucun avis pour le moment" texte="Les clients peuvent noter une commande terminée. Leurs avis apparaîtront ici." />
      ) : (
        <ul className="notation-avis-liste">
          {avis.map((a) => (
            <li key={a.id} className="notation-avis-item">
              <p className="notation-avis-entete">
                <span className="notation-avis-etoiles" role="img" aria-label={`${a.note} sur 5`}>
                  {"★".repeat(a.note)}
                  <span className="notation-avis-etoiles-vides">{"★".repeat(5 - a.note)}</span>
                </span>{" "}
                <strong>{a.prenom}</strong>
                <span className="notation-aide"> · {new Date(a.date).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
              </p>
              {a.etiquettes.length > 0 ? (
                <p className="notation-avis-etiquettes">
                  {a.etiquettes.map((e) => (
                    <span key={e} className="notation-pastille">
                      {libelleEtiquette(e)}
                    </span>
                  ))}
                </p>
              ) : null}
              {a.statut === "commentaire_masque" ? (
                <p className="notation-aide">Le commentaire a été masqué par l&apos;équipe Speedfood ; la note est conservée.</p>
              ) : a.commentaire ? (
                <p className="notation-avis-texte">{a.commentaire}</p>
              ) : null}
              {a.reponse ? (
                <p className="notation-avis-reponse">
                  <strong>Votre réponse :</strong> {a.reponse}
                </p>
              ) : a.statut === "publie" ? (
                <FormulaireReponse avisId={a.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
